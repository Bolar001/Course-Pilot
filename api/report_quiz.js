const { connectToDatabase, updateMemory, getUser } = require('../server/pilot_core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        await connectToDatabase();
        const { userId, subjectId, score, focusTopic } = req.body;
        await updateMemory(userId, subjectId, 'quiz_result', { score, focusTopic });
        const user = await getUser(userId);
        res.json({ success: true, weaknesses: user.subjects.get(subjectId).weaknesses });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
