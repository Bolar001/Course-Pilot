const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // Serve the frontend from the parent directory

// File Upload Setup
// File Upload Setup (Memory Storage for Serverless)
const upload = multer({ storage: multer.memoryStorage() });

// --- IN-MEMORY DATABASE (Academic Focus) ---
// --- PERSISTENCE LAYER ---
const DB_FILE = 'db.json';
let users = {};

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            users = JSON.parse(data);
            console.log("📂 Database loaded.");
        } else {
            console.log("📂 New database created.");
            saveDB();
        }
    } catch (e) {
        console.error("Database load error:", e);
        users = {};
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("Database save error:", e);
    }
}

// Load immmediately
loadDB();

// Helper to get/create user
function getUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            profile: {
                name: userId.split('@')[0],
                focusAreas: [],
                examMode: false,
                studyPace: 'moderate', // slow, moderate, fast
                preferredTime: 'morning'
            },
            timetable: [],
            quizHistory: []
        };
        saveDB();
    }
    return users[userId];
}

// Helper: Generate Study Timetable
function generateTimetable(user) {
    // Advanced Heuristic:
    // 1. Exam Mode: Doubles slots for Core subjects.
    // 2. Weakness: Adds "Recovery" slots.
    // 3. User Edits: We should ideally respect pinned slots (future).

    const slots = [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Added Weekend for serious students
    const times = ["9:00 AM", "2:00 PM", "6:00 PM", "8:00 PM"];

    let subjectQueue = [];

    // Prioritization Logic
    Object.keys(user.subjects).forEach(subCode => {
        const sub = user.subjects[subCode];
        let weight = 1;

        if (sub.isCore) weight += 1; // Core = 2
        if (user.profile.examMode && sub.isCore) weight += 2; // Exam Mode Core = 4!
        if (sub.weaknesses.length > 0) weight += 1; // Weakness = +1

        for (let i = 0; i < weight; i++) {
            let focus = "General Study";
            if (i === 0 && sub.weaknesses.length > 0) focus = "Weakness: " + sub.weaknesses[0];
            else if (user.profile.examMode) focus = "Exam Practice (High Yield)";
            else if (sub.isCore) focus = "Core Deep Dive";

            subjectQueue.push({ code: subCode, focus });
        }
    });

    // Distribute
    let qIdx = 0;
    // Simple distribution for demo (in reality, use studyPace to limit slots per day)
    const maxSlotsPerDay = user.profile.studyPace === 'fast' ? 4 : (user.profile.studyPace === 'slow' ? 2 : 3);

    days.forEach(day => {
        let dailyCount = 0;
        times.forEach(time => {
            if (dailyCount < maxSlotsPerDay && qIdx < subjectQueue.length) {
                const item = subjectQueue[qIdx];
                slots.push({ day, time, subject: item.code, focus: item.focus });
                qIdx++;
                dailyCount++;
            }
        });
    });

    user.timetable = slots;
    return slots;
}

// Helper: Update Academic Memory
function updateMemory(email, subjectId, action, data) {
    const user = getUser(email);

    if (!user.subjects[subjectId]) {
        user.subjects[subjectId] = {
            isCore: data.isCore || false,
            lecturer: data.lecturer || "Unknown", // Lecturer Awareness
            courseCode: data.courseCode || subjectId,
            weaknesses: [],
            quizHistory: [],
            materials: [], // NEW: Material History
            lastActive: Date.now()
        };
    }
    const subState = user.subjects[subjectId];
    if (data.lecturer) subState.lecturer = data.lecturer; // Update if provided later
    subState.lastActive = Date.now();

    if (action === 'upload_notes') {
        // Store material metadata
        if (!subState.materials) subState.materials = [];
        // Avoid duplicates by name
        const exists = subState.materials.find(m => m.name === data.fileName);
        if (!exists) {
            subState.materials.push({
                name: data.fileName,
                preview: data.preview,
                date: new Date()
            });
        }
    } else if (action === 'quiz_result') {
        subState.quizHistory.push({ score: data.score, date: new Date() });
        // Detect Weakness if score is low
        if (data.score < 60) {
            const topic = data.focusTopic || "General";
            if (!subState.weaknesses.includes(topic)) {
                subState.weaknesses.push(topic);
            }
        }
    } else if (action === 'explain_concept') {
        // Frequent explanations might indicate weakness
        const topic = data.focusTopic || "General";
        // heuristic: track request?
    }

    // Always regenerate timetable to reflect new priorities
    generateTimetable(user);
    saveDB(); // PERSIST

    return subState;
}

// --- AGENT DECISION LOOP (Academic) ---
function decideNextAction(email, currentSubject) {
    const user = getUser(email);
    const subState = user.subjects[currentSubject];
    if (!subState) return null;

    // 1. Critical Weakness in Core Subject
    if (subState.isCore && subState.weaknesses.length > 0) {
        return {
            type: "suggestion",
            message: `⚠️ Focus Needed: You identified weaknesses in **${subState.weaknesses[0]}** for this Core Course.`,
            action: "explain_weakness"
        };
    }

    // 2. Falling Behind (Low Quiz Average)
    const avgScore = subState.quizHistory.length ? subState.quizHistory.reduce((a, b) => a.score + b, 0) / subState.quizHistory.length : 100;
    if (avgScore < 50) {
        return {
            type: "suggestion",
            message: `📉 multiple quiz scores are low (${Math.round(avgScore)}%). Shall we review the foundational concepts?`,
            action: "review_basics"
        };
    }

    // 3. Timetable Reminder
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const todaysPlan = user.timetable.find(t => t.day === today && t.subject === currentSubject);
    if (todaysPlan) {
        return {
            type: "suggestion",
            message: `📅 You are on track! This session aligns with your timetable focus: ${todaysPlan.focus}.`,
            action: "continue_track"
        };
    }

    return null;
}

// --- SMART CHUNKING (RAG-lite) for Large Textbooks ---
function extractRelevantChunk(fullText, focusTopic) {
    if (!focusTopic || focusTopic.trim() === "") return fullText.substring(0, 20000); // Default: First 20k chars

    const lowerText = fullText.toLowerCase();
    const lowerFocus = focusTopic.toLowerCase();
    const idx = lowerText.indexOf(lowerFocus);

    if (idx === -1) {
        return "NOTE: 'Focus Topic' not found in text. Showing Introduction.\n\n" + fullText.substring(0, 15000);
    }

    // Extract window: 2000 chars before, 15000 chars after
    const start = Math.max(0, idx - 2000);
    const end = Math.min(fullText.length, idx + 15000);
    return `...Context found for '${focusTopic}'...\n` + fullText.substring(start, end);
}

async function generateAIResponse(text, promptType) {
    // 1. Check for Real API Key
    if (process.env.AI_API_KEY && process.env.AI_API_KEY.startsWith("gsk_")) {
        console.log(`[AI] using REAL Llama 3 API for ${promptType}...`);
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [{
                    role: "user",
                    content: `You are Course Pilot, an intelligent academic assistant.
                    Goal: Help the student succeed by providing clear, accurate, and supportive guidance.
                    
                    Instructions:
                    1. **Explain First**: Always explain concepts in plain, simple English BEFORE showing equations.
                    2. **Math Format**: Use LaTeX for formulas (wrapped in $) but keep them simple. Avoid excessive notation.
                    3. **Visuals**: If the text refers to a Figure/Diagram (e.g. "Figure 1"), Describe what the student should be seeing in that diagram based on the context.
                    4. **Tone**: Be encouraging. If a concept is hard, break it down.
                    
                    User Query: ${promptType}
                    Document Context: ${text.substring(0, 12000)}`
                }]
            }, { headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` } });
            return response.data.choices[0].message.content;
        } catch (e) {
            console.error("[AI Error]", e.message);
            if (e.response) {
                console.error("[AI Error Detail]", JSON.stringify(e.response.data));
            }
            return "Error connecting to Llama 3. Falling back to simulation.";
        }
    }

    // 2. Fallback to Simulation (if no key)
    console.log(`[AI] No API Key found. Using SIMULATION for ${promptType}...`);
    return `[Simulation Mode] (Add API Key to .env for Real AI)<br><br>Here is your ${promptType} for the uploaded material.`;
}

// --- MOCK WHATSAPP FUNCTION (Replace with Real API Call) ---
async function sendWhatsAppMessage(phone, text) {
    console.log(`[WhatsApp] Sending to ${phone}: ${text.substring(0, 50)}...`);
    return true;
}

// 1. Upload & Parse Endpoint
// 1. Upload & Parse Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { userId, subjectId } = req.body; // Extract metadata

        let text = "";
        // Simple PDF text extraction
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(dataBuffer);
            text = data.text;
        } else {
            text = "Image processing usually requires Vision API (e.g. Llama 3.2 Vision). For this demo, we assume text was extracted.";
        }

        // Cleanup
        fs.unlinkSync(req.file.path);

        const preview = text.substring(0, 200);

        // Update Memory
        let materials = [];
        if (userId && subjectId) {
            const subState = updateMemory(userId, subjectId, 'upload_notes', { fileName: req.file.originalname, preview: text.substring(0, 1000) });
            materials = subState.materials || [];
        }

        res.json({ success: true, textPreview: preview, fullTextLength: text.length, materials: materials });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// 2. AI Generation Endpoint
app.post('/api/ai', async (req, res) => {
    try {
        const { text, type, userId, subjectId, focusTopic, isCore, lecturer } = req.body;
        const uId = userId || "guest@edu.com";
        const sId = subjectId || "General";

        // Update Memory (Academic)
        let subState = null;
        if (type === 'quiz') {
            subState = updateMemory(uId, sId, 'init', { isCore: !!isCore, lecturer: lecturer });
        } else {
            subState = updateMemory(uId, sId, 'upload_notes', { isCore: !!isCore, lecturer: lecturer });
        }

        const user = getUser(uId);

        // Enforce Math Support & Specific Focus
        const mathInstruction = "Use LaTeX for all math expressions (e.g. $ \\int x dx $).";
        const focusInstruction = focusTopic ? `Focus ONLY on: "${focusTopic}". Ignore other chapters.` : "";
        const jsonInstruction = type === 'quiz' ? "RETURN ONLY RAW JSON ARRAY. Generate 10 high-quality object questions covering the context extensively. DO NOT use markdown code blocks (no ```json). Format: [{question: string, options: string[], answer: string, explanation: string}]. Ensure ONE correct answer." : "";

        // Lecturer & Exam Layer
        const examModeInstruction = user.profile.examMode
            ? "EXAM MODE ACTIVE: Prioritize high-yield past questions, be concise, focus on solving techniques."
            : "Normal Mode: Explain concepts in depth.";

        const lecturerInstruction = subState.lecturer && subState.lecturer !== "Unknown"
            ? `Adapt to the style of Lecturer: ${subState.lecturer}.`
            : "";

        // NEW: Smart Chunking
        const chunkedText = extractRelevantChunk(text, focusTopic);

        const enhancedPrompt = `${type}. ${focusInstruction} ${mathInstruction} ${jsonInstruction}\nCONTEXT: ${examModeInstruction} ${lecturerInstruction}`;

        const result = await generateAIResponse(chunkedText, enhancedPrompt);

        // Agent Reasoning
        const nextAction = decideNextAction(uId, sId);

        res.json({
            result: result,
            suggestion: nextAction,
            weaknesses: user.subjects[sId] ? user.subjects[sId].weaknesses : [],
            timetable: user.timetable,
            examMode: user.profile.examMode
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI generation failed' });
    }
});

// 3. Report Quiz Result
app.post('/api/report_quiz', async (req, res) => {
    const { userId, subjectId, score, focusTopic } = req.body;
    updateMemory(userId, subjectId, 'quiz_result', { score, focusTopic });
    const user = getUser(userId);
    res.json({ success: true, timetable: user.timetable, weaknesses: user.subjects[subjectId].weaknesses });
});

// 3b. Chat Endpoint (NEW)
app.post('/api/chat', async (req, res) => {
    try {
        console.log("[Chat] Request received for:", req.body.userId);
        const { message, userId, subjectId, focusTopic, isCore, lecturer, textContext } = req.body;
        const uId = userId || "guest@edu.com";
        const sId = subjectId || "General";

        // Update Memory (Interaction)
        updateMemory(uId, sId, 'chat', {});
        const user = getUser(uId);

        // Context Construction
        const isMathContext = (subjectId && (subjectId.includes('MTH') || subjectId.includes('PHY') || subjectId.includes('ENG'))) || (message && message.match(/math|calc|integral|deriv|equation|formula/i));
        const mathInstruction = isMathContext ? "Use LaTeX for all math expressions (e.g. $ \\int x dx $)." : "";
        const focusInstruction = focusTopic ? `Focus ONLY on: "${focusTopic}".` : "";
        const lecturerInstruction = lecturer && lecturer !== "Unknown" ? `Adapt to the style of Lecturer: ${lecturer}.` : "";

        console.log("[Chat] Trace 1: Context Constructed");
        let contextText = textContext || "";
        const chunkedText = extractRelevantChunk(contextText, focusTopic);
        console.log("[Chat] Trace 2: Chunked Text (Length: " + chunkedText.length + ")");

        const prompt = `${message}. ${focusInstruction} ${mathInstruction} ${lecturerInstruction}`;
        console.log("[Chat] Trace 3: Prompt Constructed");

        console.log("[Chat] Generating AI response...");
        const result = await generateAIResponse(chunkedText, prompt);
        console.log("[Chat] AI response generated.");

        // Agent Reasoning (Suggestions)
        console.log("[Chat] Trace 4: Deciding Action");
        const nextAction = decideNextAction(uId, sId);
        console.log("[Chat] Trace 5: Sending Response");

        res.json({
            result: result,
            suggestion: nextAction,
            weaknesses: (user.subjects[sId] && user.subjects[sId].weaknesses) ? user.subjects[sId].weaknesses : []
        });
    } catch (error) {
        console.log("[Chat Error Log]:", error.message);
        console.error(error);
        res.status(500).json({ error: 'Chat generation failed', details: error.message, stack: error.stack });
    }
});

// 4. Toggle Exam Mode
app.post('/api/toggle_exam', async (req, res) => {
    const { userId, enabled } = req.body;
    const user = getUser(userId);
    user.profile.examMode = enabled;
    generateTimetable(user); // Re-plan immediately
    saveDB(); // PERSIST
    res.json({ success: true, examMode: user.profile.examMode, timetable: user.timetable });
});

// 5. Update Timetable (Manual Edits)
app.post('/api/update_timetable', async (req, res) => {
    const { userId, newTimetable } = req.body;
    const user = getUser(userId);
    user.timetable = newTimetable; // Trust user edit
    saveDB(); // PERSIST
    res.json({ success: true });
});

// 5b. Get Analytics
app.get('/api/analytics', (req, res) => {
    const { userId } = req.query;
    const user = getUser(userId);
    res.json({
        history: user.quizHistory || [],
        weaknesses: user.subjects ? Object.values(user.subjects).flatMap(s => s.weaknesses) : []
    });
});

// 6. Mock Handwritten Notes (SAM)
// 6. Real Vision Analysis (Llama 3.2 Vision)
// 6. Mock Handwritten Notes (SAM) - Reverted due to Groq API Decommissioning
// 6. Real Vision Analysis (Multi-Provider Support)
app.post('/api/upload_handwritten', upload.single('file'), async (req, res) => {
    try {
        const geminiKey = process.env.GEMINI_API_KEY;
        const openAIKey = process.env.OPENAI_API_KEY;

        // Use parsing from Memory Buffer
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        // No file cleanup needed for memory storage

        // OPTION 1: GOOGLE GEMINI (Recommended for Hackathon - Free Tier)
        if (geminiKey) {
            try {
                console.log("[Vision] Using Google Gemini 1.5 Flash...");
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
                    {
                        contents: [{
                            parts: [
                                { text: "Transcribe this handwritten note exactly. If there are math equations, convert them to LaTeX format. If there are diagrams, describe them in detail." },
                                { inline_data: { mime_type: mimeType, data: base64Image } }
                            ]
                        }]
                    }
                );

                if (!response.data.candidates || !response.data.candidates.length) {
                    console.error("[Vision] No candidates returned.");
                    throw new Error("No candidates returned from Gemini.");
                }

                const text = response.data.candidates[0].content.parts[0].text;
                if (!text) {
                    console.error("[Vision] Text is undefined in candidate.");
                    throw new Error("Gemini returned a candidate but no text.");
                }

                return res.json({ success: true, textPreview: text, isHandwritten: true });
            } catch (apiError) {
                console.error("[Vision API Error]", apiError.response ? JSON.stringify(apiError.response.data) : apiError.message);

                // Return the actual error to the user
                let errorMsg = "Vision API Error: ";
                if (apiError.response && apiError.response.data && apiError.response.data.error) {
                    errorMsg += apiError.response.data.error.message;
                } else {
                    errorMsg += apiError.message;
                }

                return res.json({
                    success: true,
                    textPreview: `⚠️ **Analysis Failed**\n\n${errorMsg}\n\n*Please check your GEMINI_API_KEY in server/.env*`,
                    isHandwritten: false
                });
            }
        }

        // OPTION 2: OPENAI (GPT-4o)
        if (openAIKey) {
            try {
                console.log("[Vision] Using OpenAI GPT-4o...");
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Transcribe this handwritten note exactly. If there are math equations, convert them to LaTeX format. If there are diagrams, describe them in detail." },
                                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                            ]
                        }
                    ],
                    max_tokens: 1000
                }, { headers: { Authorization: `Bearer ${openAIKey}` } });

                return res.json({ success: true, textPreview: response.data.choices[0].message.content, isHandwritten: true });
            } catch (apiError) {
                console.error("[Vision API Error]", apiError.message);
                console.log("[Vision] API Failed. Falling back to Simulation Mode.");
            }
        }

        // FAILSAFE: No Provider Configured
        console.log("[Vision] No API Key configured.");
        return res.json({
            success: true,
            textPreview: "⚠️ **Configuration Error**\n\nNo Vision API Key found. Please add `GEMINI_API_KEY` to your `.env` file.",
            isHandwritten: false
        });

    } catch (error) {
        console.error("[Vision System Error]", error);
        res.status(500).json({ error: "Vision processing failed completely." });
    }
});

// 7. WhatsApp Send Endpoint
app.post('/api/whatsapp', async (req, res) => {
    try {
        const { phone, content } = req.body;
        await sendWhatsAppMessage(phone, content);
        res.json({ success: true, message: "Sent to WhatsApp" });
    } catch (error) {
        res.status(500).json({ error: 'WhatsApp send failed' });
    }
});

// Export for Vercel/Serverless
module.exports = app;

// Only start server if running directly (dev/local)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Course Pilot Server running at http://localhost:${port}`);
        console.log(`Open http://localhost:${port}/index.html to start your flight plan`);
    });
}
