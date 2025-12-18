const {
    connectToDatabase,
    getUser,
    generateAIResponse
} = require('../server/pilot_core');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        await connectToDatabase();
        const { type, text, userId, subjectId, focusTopic } = req.body;

        let promptType = "Summarize this.";
        if (type === 'summarize') promptType = "Summarize this content concisely.";
        else if (type === 'explain') promptType = "Explain the key concepts in this content.";
        else if (type === 'quiz') promptType = "Generate a multiple choice quiz (JSON format) based on this content.";

        if (focusTopic) promptType += ` Focus specifically on: ${focusTopic}`;

        const result = await generateAIResponse(text, promptType);

        let userTimetable = [];
        let examMode = false;

        if (userId) {
            try {
                const user = await getUser(userId);
                userTimetable = user.timetable;
                examMode = user.profile.examMode;
            } catch (err) {
                console.warn("User fetch failed in /api/ai", err);
            }
        }

        res.status(200).json({
            result,
            timetable: userTimetable,
            examMode: examMode
        });

    } catch (e) {
        console.error("Pilot AI Endpoint Error:", e);
        res.status(500).json({ error: e.message });
    }
};
