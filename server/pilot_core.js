const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const pdfParse = require('pdf-parse');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// Avoid OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', UserSchema);

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

module.exports = {
    connectToDatabase,
    getUser,
    updateMemory,
    generateTimetable,
    decideNextAction,
    generateAIResponse,
    User
};
