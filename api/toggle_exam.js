const { connectToDatabase, getUser, generateTimetable } = require('../server/pilot_core');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const { userId, enabled } = req.body;
        await connectToDatabase();
        const user = await getUser(userId);
        user.profile.examMode = enabled;
        await user.save();

        // Regenerate Timetable
        const slots = await generateTimetable(user);
        res.json({ success: true, examMode: enabled, timetable: slots });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
