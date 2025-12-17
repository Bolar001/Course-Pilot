const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // Serve the frontend from the parent directory

// File Upload Setup (Memory Storage for Serverless)
const upload = multer({ storage: multer.memoryStorage() });

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
    const slots = [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const times = ["9:00 AM", "2:00 PM", "6:00 PM", "8:00 PM"];

    let subjectQueue = [];

    // Prioritization Logic
    if (user.subjects) {
        Object.keys(user.subjects).forEach(subCode => {
            const sub = user.subjects[subCode];
            let weight = 1;

            if (sub.isCore) weight += 1;
            if (user.profile.examMode && sub.isCore) weight += 2;
            if (sub.weaknesses.length > 0) weight += 1;

            for (let i = 0; i < weight; i++) {
                let focus = "General Study";
                if (i === 0 && sub.weaknesses.length > 0) focus = "Weakness: " + sub.weaknesses[0];
                else if (user.profile.examMode) focus = "Exam Practice (High Yield)";
                else if (sub.isCore) focus = "Core Deep Dive";

                subjectQueue.push({ code: subCode, focus });
            }
        });
    }

    // Distribute
    let qIdx = 0;
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

    if (!user.subjects) user.subjects = {}; // Ensure defined

    if (!user.subjects[subjectId]) {
        user.subjects[subjectId] = {
            isCore: data.isCore || false,
            lecturer: data.lecturer || "Unknown",
            courseCode: data.courseCode || subjectId,
            weaknesses: [],
            quizHistory: [],
            materials: [],
            lastActive: Date.now()
        };
    }
    const subState = user.subjects[subjectId];
    if (data.lecturer) subState.lecturer = data.lecturer;
    subState.lastActive = Date.now();

    if (action === 'upload_notes') {
        if (!subState.materials) subState.materials = [];
        const exists = subState.materials.find(m => m.name === data.fileName);
        if (!exists) {
            subState.materials.push({
                name: data.fileName,
                preview: data.preview,
                lessonTitle: data.lessonTitle,
                date: new Date()
            });
        }
    } else if (action === 'quiz_result') {
        subState.quizHistory.push({ score: data.score, date: new Date() });
        if (data.score < 60) {
            const topic = data.focusTopic || "General";
            if (!subState.weaknesses.includes(topic)) {
                subState.weaknesses.push(topic);
            }
        }
    }

    generateTimetable(user);
    saveDB();

    return subState;
}

// --- AGENT DECISION LOOP (Academic) ---
function decideNextAction(email, currentSubject) {
    const user = getUser(email);
    if (!user.subjects) return null;
    const subState = user.subjects[currentSubject];
    if (!subState) return null;

    if (subState.isCore && subState.weaknesses.length > 0) {
        return {
            type: "suggestion",
            message: `⚠️ Focus Needed: You identified weaknesses in **${subState.weaknesses[0]}** for this Core Course.`,
            action: "explain_weakness"
        };
    }

    const avgScore = subState.quizHistory.length ? subState.quizHistory.reduce((a, b) => a.score + b, 0) / subState.quizHistory.length : 100;
    if (avgScore < 50) {
        return {
            type: "suggestion",
            message: `📉 Multiple quiz scores are low (${Math.round(avgScore)}%). Shall we review the foundational concepts?`,
            action: "review_basics"
        };
    }

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
    if (!focusTopic || focusTopic.trim() === "") return fullText.substring(0, 20000);

    const lowerText = fullText.toLowerCase();
    const lowerFocus = focusTopic.toLowerCase();
    const idx = lowerText.indexOf(lowerFocus);

    if (idx === -1) {
        return "NOTE: 'Focus Topic' not found in text. Showing Introduction.\n\n" + fullText.substring(0, 15000);
    }

    const start = Math.max(0, idx - 2000);
    const end = Math.min(fullText.length, idx + 15000);
    return `...Context found for '${focusTopic}'...\n` + fullText.substring(start, end);
}

async function generateAIResponse(text, promptType) {
    if (process.env.AI_API_KEY && process.env.AI_API_KEY.startsWith("gsk_")) {
        console.log(`[AI] using REAL Llama 3 API for ${promptType}...`);

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile",
                    messages: [{
                        role: "user",
                        content: `You are Course Pilot, an intelligent academic assistant.
    Goal: Help the student succeed by providing clear, accurate, and supportive guidance.

        Instructions:
        1. **Summarization Focus**: When asked to summarize, YOU MUST extract ALL key concepts, definitions, and important details. Do not act lazy. A good summary captures the essence of the entire section.
        2. **Explain First**: Always explain concepts in plain, simple English BEFORE showing equations.
        3. **Math Format**: Use LaTeX for formulas (wrapped in $) but keep them simple. Avoid excessive notation.
        4. **Visuals**: If the text refers to a Figure / Diagram (e.g. "Figure 1"), Describe what the student should be seeing in that diagram based on the context.
        5. **Tone**: Be encouraging. If a concept is hard, break it down.
        6. **Informal Language & Abbreviations**: You must understand informal typing, slang (like "u", "ur", "gonna"), and abbreviations (e.g., "eqn", "wrt"). Treat them as their formal equivalents. Do not correct the student's grammar; focus on the meaning.
        
        User Query: ${promptType}
        Document Context: ${text.substring(0, 12000)}`
                    }]
                }, { headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` } });
                return response.data.choices[0].message.content;
            } catch (e) {
                console.error(`[AI Error] Attempt ${attempt} failed:`, e.message);
                if (e.response && e.response.status === 429) {
                    console.log(`[AI] Rate limited. Waiting ${attempt * 2}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                    continue; // Retry
                }

                // If it's the last attempt, or a non-retryable error (like 401), allow specific fallback or throw
                if (attempt === maxRetries) {
                    console.error("[AI] All retries failed.");
                    if (e.response) {
                        console.error("[AI Error Detail]", JSON.stringify(e.response.data));
                    }
                    return "⚠️ **Connection Error**: The AI provider is currently overwhelmed or unreachable. Please try again in a moment.";
                }
            }
        }
    }

    console.log(`[AI] No API Key found. Using SIMULATION for ${promptType}...`);
    return `[Simulation Mode] (Add API Key to .env for Real AI)<br><br>Here is your ${promptType} for the uploaded material.`;
}

async function sendWhatsAppMessage(phone, text) {
    console.log(`[WhatsApp] Sending to ${phone}: ${text.substring(0, 50)}...`);
    return true;
}

// Helper function to run local OCR worker
// DISABLED: Tesseract.js is incompatible with Node v24 (MessagePort crash).
async function runLocalOCR(imageBuffer) {
    throw new Error("Local OCR is disabled on this server environment.");
}

// 1. Upload & Parse Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { userId, subjectId, lessonTitle } = req.body;

        let text = "";
        if (req.file.mimetype === 'application/pdf') {
            const data = await pdfParse(req.file.buffer);
            text = data.text;
        } else if (req.file.mimetype.startsWith('image/')) {
            console.log("[Server] Processing image with Local OCR (Worker)...");
            try {
                text = await runLocalOCR(req.file.buffer);
                console.log("[Server] OCR Complete. Length:", text.length);
            } catch (err) {
                text = "⚠️ Image Text Extraction Failed (Local OCR Error).";
            }
        } else {
            text = "Image processing usually requires Vision API. For this demo, we assume text was extracted.";
        }

        const preview = text.substring(0, 200);

        // Update Memory
        let materials = [];
        if (userId && subjectId) {
            const subState = updateMemory(userId, subjectId, 'upload_notes', {
                fileName: req.file.originalname,
                preview: text.substring(0, 1000),
                lessonTitle: lessonTitle || "General Note"
            });
            materials = subState.materials || [];
        }

        res.json({ success: true, textPreview: preview, fullTextLength: text.length, materials: materials });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// 1b. Fetch Materials Endpoint (NEW)
app.get('/api/materials/:userId/:subjectId', (req, res) => {
    const { userId, subjectId } = req.params;
    const user = getUser(userId);
    if (!user.subjects || !user.subjects[subjectId]) {
        return res.json({ materials: [] });
    }
    const sorted = (user.subjects[subjectId].materials || []).reverse();
    res.json({ materials: sorted });
});

// 2. AI Generation Endpoint
app.post('/api/ai', async (req, res) => {
    try {
        const { text, type, userId, subjectId, focusTopic, isCore, lecturer } = req.body;
        const uId = userId || "guest@edu.com";
        const sId = subjectId || "General";

        let subState = null;
        if (type === 'quiz') {
            subState = updateMemory(uId, sId, 'init', { isCore: !!isCore, lecturer: lecturer });
        } else {
            subState = updateMemory(uId, sId, 'upload_notes', { isCore: !!isCore, lecturer: lecturer });
        }

        const user = getUser(uId);

        const mathInstruction = "Use LaTeX for all math expressions (e.g. $ \\int x dx $).";
        const focusInstruction = focusTopic ? `Focus ONLY on: "${focusTopic}". Ignore other chapters.` : "";
        const jsonInstruction = type === 'quiz' ? "RETURN ONLY RAW JSON ARRAY. Generate 10 high-quality object questions covering the context extensively. DO NOT use markdown code blocks (no ```json). Format: [{question: string, options: string[], answer: string, explanation: string}]. Ensure ONE correct answer." : "";

        const examModeInstruction = user.profile.examMode
            ? "EXAM MODE ACTIVE: Prioritize high-yield past questions, be concise, focus on solving techniques."
            : "Normal Mode: Explain concepts in depth.";

        const lecturerInstruction = subState.lecturer && subState.lecturer !== "Unknown"
            ? `Adapt to the style of Lecturer: ${subState.lecturer}.`
            : "";

        const chunkedText = extractRelevantChunk(text, focusTopic);
        const enhancedPrompt = `${type}. ${focusInstruction} ${mathInstruction} ${jsonInstruction}\nCONTEXT: ${examModeInstruction} ${lecturerInstruction}`;

        const result = await generateAIResponse(chunkedText, enhancedPrompt);
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

        updateMemory(uId, sId, 'chat', {});
        const user = getUser(uId);

        const isMathContext = (subjectId && (subjectId.includes('MTH') || subjectId.includes('PHY') || subjectId.includes('ENG'))) || (message && message.match(/math|calc|integral|deriv|equation|formula/i));
        const mathInstruction = isMathContext ? "Use LaTeX for all math expressions (e.g. $ \\int x dx $)." : "";
        const focusInstruction = focusTopic ? `Focus ONLY on: "${focusTopic}".` : "";
        const lecturerInstruction = lecturer && lecturer !== "Unknown" ? `Adapt to the style of Lecturer: ${lecturer}.` : "";

        let contextText = textContext || "";
        const chunkedText = extractRelevantChunk(contextText, focusTopic);

        const prompt = `${message}. ${focusInstruction} ${mathInstruction} ${lecturerInstruction}`;

        console.log("[Chat] Generating AI response...");
        const result = await generateAIResponse(chunkedText, prompt);

        const nextAction = decideNextAction(uId, sId);

        res.json({
            result: result,
            suggestion: nextAction,
            weaknesses: (user.subjects[sId] && user.subjects[sId].weaknesses) ? user.subjects[sId].weaknesses : []
        });
    } catch (error) {
        console.error("[Chat Error]", error);
        res.status(500).json({ error: 'Chat generation failed', details: error.message });
    }
});

// 4. Toggle Exam Mode
app.post('/api/toggle_exam', async (req, res) => {
    const { userId, enabled } = req.body;
    const user = getUser(userId);
    user.profile.examMode = enabled;
    generateTimetable(user);
    saveDB();
    res.json({ success: true, examMode: user.profile.examMode, timetable: user.timetable });
});

// 5. Update Timetable (Manual Edits)
app.post('/api/update_timetable', async (req, res) => {
    const { userId, newTimetable } = req.body;
    const user = getUser(userId);
    user.timetable = newTimetable;
    saveDB();
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

module.exports = app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Course Pilot Server running at http://localhost:${port}`);
        console.log(`Open http://localhost:${port}/index.html to start your flight plan`);
    });
}
