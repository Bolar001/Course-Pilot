const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
// Load env from the same directory as this script, regardless of where node is run from
require('dotenv').config({ path: path.join(__dirname, '.env') });


const app = express();
const port = process.env.PORT || 3000;

// --- MONGODB & CORE LOGIC ---
const {
    connectToDatabase,
    getUser,
    updateMemory,
    generateTimetable,
    decideNextAction,
    generateAIResponse,
    User
} = require('./pilot_core');


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

// 2. Fetch Materials (Unified Query Params support for Vercel compatibility)
app.get('/api/materials', async (req, res) => {
    try {
        await connectToDatabase();
        const { userId, subjectId } = req.query;
        if (!userId || !subjectId) return res.status(400).json({ error: "Missing query params userId/subjectId" });

        const user = await getUser(userId);
        const sub = user.subjects ? user.subjects.get(subjectId) : null;
        res.json({ materials: sub ? sub.materials.reverse() : [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/materials/:userId/:subjectId', async (req, res) => {
    await connectToDatabase();
    const { userId, subjectId } = req.params;
    const user = await getUser(userId);
    const sub = user.subjects ? user.subjects.get(subjectId) : null;
    res.json({ materials: sub ? sub.materials.reverse() : [] });
});

// 3. AI / Quiz / Chat
app.post('/api/chat', async (req, res) => {
    // HARDENING: DB failure must not stop the chat.
    let user = null;
    let sub = null;
    let nextAction = null;
    let dbError = null;

    const { message, userId, subjectId } = req.body;

    // 1. Try to read DB (Non-blocking)
    try {
        await connectToDatabase();
        // Only fetch user context if we have IDs
        if (userId) {
            user = await getUser(userId);
            if (subjectId && user.subjects) {
                sub = user.subjects.get(subjectId);
            }
        }

        // Decide action only if DB worked
        if (user && subjectId) {
            nextAction = await decideNextAction(userId, subjectId).catch(err => {
                console.warn("Pilot Warning: decideNextAction failed", err.message);
                return null;
            });
        }
    } catch (e) {
        console.error("Pilot DB Warning: Context skipped due to DB error:", e.message);
        dbError = e;
        // Proceed without context
    }

    try {
        // 2. ALWAYS call Llama (Core)
        // If DB failed, we just don't have user context, but we still answer.
        // We can inject a small system note if DB failed so Llama knows.
        let promptContext = "Answer this question like a tutor.";
        if (dbError) {
            promptContext += " (Note: Persistent memory is currently unavailable, so you don't know the student's name or past subjects. Just answer the query helpfully.)";
        }

        const result = await generateAIResponse(message, promptContext);

        // 3. Return Response (Guaranteed)
        res.json({
            result: result || "I'm ready to help. Please ask your question again.", // Fallback if Llama returns null (unlikely)
            suggestion: nextAction || null,
            weaknesses: sub ? sub.weaknesses : [] // Default to empty if no DB
        });

    } catch (finalError) {
        // This catches strictly Llama failures or critical code errors
        console.error("Pilot Critical Error:", finalError);
        // STANDBY MODE: Even if everything explodes, return a friendly JSON.
        res.status(200).json({
            reply: "I’m having trouble processing that right now. Please ask again in a moment.",
            result: "I’m having trouble processing that right now. Please ask again in a moment.", // Double field to be safe for frontend
            error: null // Hide error specific from UI to prevent stalling
        });
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
