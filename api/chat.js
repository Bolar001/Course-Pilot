const {
    connectToDatabase,
    getUser,
    decideNextAction,
    generateAIResponse
} = require('../server/pilot_core');

module.exports = async (req, res) => {
    // Enable CORS manually (since Vercel doesn't use the standard express 'cors' middleware automatically in simplified handlers)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    // another common pattern
    // res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // HARDENING: Re-use the same resilient logic as server.js
    let user = null;
    let sub = null;
    let nextAction = null;
    let dbError = null;

    const { message, userId, subjectId } = req.body;

    // 1. Try to read DB
    try {
        await connectToDatabase();
        if (userId) {
            user = await getUser(userId);
            if (subjectId && user.subjects) {
                sub = user.subjects.get(subjectId);
            }
        }

        if (user && subjectId) {
            nextAction = await decideNextAction(userId, subjectId).catch(err => {
                console.warn("Pilot Vercel Warning: decideNextAction failed", err.message);
                return null;
            });
        }
    } catch (e) {
        console.error("Pilot Vercel DB Warning:", e.message);
        dbError = e;
    }

    try {
        // 2. Call Llama
        let promptContext = "Answer this question like a tutor.";
        if (dbError) {
            promptContext += " (Note: Persistent memory is unavailable. Just answer helpfully.)";
        }

        const result = await generateAIResponse(message, promptContext);

        // 3. Return Response
        res.status(200).json({
            reply: result || "I'm ready to help. Please ask your question again.", // To match user expectation "reply" field
            result: result, // To match original server.js "result" field (frontend likely uses "result")
            suggestion: nextAction || null,
            weaknesses: sub ? sub.weaknesses : []
        });

    } catch (finalError) {
        console.error("Pilot Vercel Critical Error:", finalError);
        res.status(200).json({
            reply: "I’m having trouble processing that right now. Please ask again in a moment.",
            result: "I’m having trouble processing that right now. Please ask again in a moment.",
            error: null
        });
    }
};
