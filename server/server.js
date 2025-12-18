const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- MONGODB CONNECTION (Serverless Cached Pattern) ---
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false, // Turn off buffering to fail fast on errors
        };

        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/course_pilot_temp";

        cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
            console.log("✅ MongoDB Connected (New Instance)");
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// --- SCHEMAS ---
const MaterialSchema = new mongoose.Schema({
    name: String,
    preview: String,
    lessonTitle: String,
    date: { type: Date, default: Date.now }
});

const SubjectSchema = new mongoose.Schema({
    isCore: Boolean,
    lecturer: String,
    courseCode: String,
    weaknesses: [String],
    quizHistory: [{ score: Number, date: { type: Date, default: Date.now }, focusTopic: String }],
    materials: [MaterialSchema],
    lastActive: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, // Auth ID
    profile: {
        name: String,
        examMode: { type: Boolean, default: false },
        studyPace: { type: String, default: 'moderate' },
        preferredTime: { type: String, default: 'morning' }
    },
    subjects: { type: Map, of: SubjectSchema, default: {} },
    timetable: [{ day: String, time: String, subject: String, focus: String }]
});

const User = mongoose.model('User', UserSchema);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
// Serve frontend from parent directory
app.use(express.static(path.join(__dirname, '../')));

// File Upload (Memory for Serverless)
const upload = multer({ storage: multer.memoryStorage() });

// --- HELPERS ---
async function getUser(email) {
    let user = await User.findOne({ email });
    if (!user) {
        user = new User({
            email,
            profile: { name: email.split('@')[0] },
            subjects: {},
            timetable: []
        });
        await user.save();
    }
    return user;
}

async function updateMemory(email, subjectId, action, data) {
    const user = await getUser(email);

    // Ensure subject exists in Map
    if (!user.subjects.get(subjectId)) {
        user.subjects.set(subjectId, {
            isCore: data.isCore || false,
            lecturer: data.lecturer || "Unknown",
            courseCode: data.courseCode || subjectId,
            weaknesses: [],
            quizHistory: [],
            materials: [],
            lastActive: new Date()
        });
    }

    const subState = user.subjects.get(subjectId);

    if (data.lecturer) subState.lecturer = data.lecturer;
    subState.lastActive = new Date();

    if (action === 'upload_notes') {
        // Avoid duplicates
        const exists = subState.materials.find(m => m.name === data.fileName);
        if (!exists) {
            subState.materials.push({
                name: data.fileName,
                preview: data.preview,
                lessonTitle: data.lessonTitle
            });
        }
    } else if (action === 'quiz_result') {
        subState.quizHistory.push({ score: data.score, focusTopic: data.focusTopic });
        if (data.score < 60) {
            const topic = data.focusTopic || "General";
            if (!subState.weaknesses.includes(topic)) {
                subState.weaknesses.push(topic);
            }
        }
    }

    // Save changes
    user.subjects.set(subjectId, subState); // Re-set to ensure Map update is tracked
    await user.save();

    // Regenerate Timetable after updates
    await generateTimetable(user);

    return subState;
}

// Generate Timetable (Simplified Logic)
async function generateTimetable(user) {
    const slots = [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const times = ["9:00 AM", "2:00 PM", "6:00 PM", "8:00 PM"];
    let subjectQueue = [];

    if (user.subjects && user.subjects.size > 0) {
        user.subjects.forEach((sub, code) => {
            let weight = 1;
            if (sub.isCore) weight += 1;
            if (user.profile.examMode && sub.isCore) weight += 2;
            if (sub.weaknesses && sub.weaknesses.length > 0) weight += 1;

            for (let i = 0; i < weight; i++) {
                let focus = "General Study";
                if (i === 0 && sub.weaknesses.length > 0) focus = "Weakness: " + sub.weaknesses[0];
                else if (user.profile.examMode) focus = "Exam Practice (High Yield)";
                else if (sub.isCore) focus = "Core Deep Dive";

                subjectQueue.push({ code, focus });
            }
        });
    }

    let qIdx = 0;
    const maxSlots = 3;
    days.forEach(day => {
        let count = 0;
        times.forEach(time => {
            if (count < maxSlots && qIdx < subjectQueue.length) {
                const item = subjectQueue[qIdx];
                slots.push({ day, time, subject: item.code, focus: item.focus });
                qIdx++;
                count++;
            }
        });
    });

    user.timetable = slots;
    await user.save();
    return slots;
}

// Decide Next Action (Agentic)
async function decideNextAction(email, currentSubject) {
    const user = await getUser(email);
    if (!user.subjects || !user.subjects.get(currentSubject)) return null;

    const subState = user.subjects.get(currentSubject);

    if (subState.isCore && subState.weaknesses.length > 0) {
        return {
            type: "suggestion",
            message: `⚠️ Focus Needed: Weakness detected in **${subState.weaknesses[0]}**.`,
            action: "explain_weakness"
        };
    }
    return null;
}

// AI Generator (Groq / Llama)
async function generateAIResponse(text, promptType) {
    if (process.env.AI_API_KEY) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [{
                    role: "user",
                    content: `You are Course Pilot (Academic AI).
        Task: ${promptType}
        Context: ${text.substring(0, 15000)}`
                }]
            }, { headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` } });
            return response.data.choices[0].message.content;
        } catch (e) {
            console.error("AI Error:", e.response ? e.response.data : e.message);
            return "⚠️ AI service temporarily unavailable. Please try again.";
        }
    }
    return "[Simulation] Add AI_API_KEY to .env to enable real Llama 3.";
}

// --- ENDPOINTS ---

// 0. Config Endpoint (For Frontend to get Firebase Keys)
// 0. Config Endpoint (For Frontend to get Firebase Keys)
app.get('/api/config/firebase', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

// 1. Upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
    await connectToDatabase();
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        const { userId, subjectId, lessonTitle } = req.body;

        let text = "Text extraction simulated for demo. Add GCP Vision for real PDF/Image OCR.";
        if (req.file.mimetype === 'application/pdf') {
            try {
                const data = await pdfParse(req.file.buffer);
                text = data.text;
            } catch (e) { console.error("PDF Error", e); }
        }

        let materials = [];
        if (userId && subjectId) {
            const subState = await updateMemory(userId, subjectId, 'upload_notes', {
                fileName: req.file.originalname,
                preview: text.substring(0, 500),
                lessonTitle: lessonTitle || "General Note"
            });
            materials = subState.materials;
        }
        res.json({ success: true, textPreview: text.substring(0, 200), materials });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// 2. Fetch Materials
app.get('/api/materials/:userId/:subjectId', async (req, res) => {
    await connectToDatabase();
    const { userId, subjectId } = req.params;
    const user = await getUser(userId);
    const sub = user.subjects ? user.subjects.get(subjectId) : null;
    res.json({ materials: sub ? sub.materials.reverse() : [] });
});

// 3. AI / Quiz / Chat
app.post('/api/chat', async (req, res) => {
    try {
        await connectToDatabase();
        const { message, userId, subjectId } = req.body;
        // Logic for chat...
        const result = await generateAIResponse(message, "Answer this question like a tutor.");
        const nextAction = await decideNextAction(userId, subjectId);

        const user = await getUser(userId);
        const sub = user.subjects.get(subjectId);

        res.json({
            result,
            suggestion: nextAction,
            weaknesses: sub ? sub.weaknesses : []
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai', async (req, res) => {
    // Shared endpoint for Summary/Explain/Quiz
    try {
        await connectToDatabase();
        const { type, text, userId, subjectId, focusTopic } = req.body;
        const result = await generateAIResponse(text, type + (focusTopic ? ` Focus: ${focusTopic}` : ""));

        if (type === 'quiz' && userId && subjectId) {
            // Log quiz attempt init? 
            // For now just return
        }

        const user = await getUser(userId);
        res.json({ result, timetable: user.timetable, examMode: user.profile.examMode });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Report Quiz
app.post('/api/report_quiz', async (req, res) => {
    await connectToDatabase();
    const { userId, subjectId, score, focusTopic } = req.body;
    await updateMemory(userId, subjectId, 'quiz_result', { score, focusTopic });
    const user = await getUser(userId);
    res.json({ success: true, weaknesses: user.subjects.get(subjectId).weaknesses });
});

// 5. Timetable & Exam Mode
app.post('/api/update_timetable', async (req, res) => {
    const { userId, newTimetable } = req.body;
    await connectToDatabase();
    const user = await getUser(userId);
    user.timetable = newTimetable;
    await user.save();
    res.json({ success: true });
});

app.post('/api/toggle_exam', async (req, res) => {
    const { userId, enabled } = req.body;
    await connectToDatabase();
    const user = await getUser(userId);
    user.profile.examMode = enabled;
    await user.save();
    // Regenerate
    const slots = await generateTimetable(user);
    res.json({ success: true, examMode: enabled, timetable: slots });
});

module.exports = app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`✅ Production Server running on port ${port}`);
    });
}
