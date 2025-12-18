const { connectToDatabase, getUser } = require('../server/pilot_core');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        await connectToDatabase();
        // Extract params from query string if using file-based routing: /api/materials?userId=...&subjectId=...
        // OR if using dynamic routes: /api/materials/[userId]/[subjectId].js
        // User's frontend calls: /api/materials/${userId}/${subId}
        // Vercel supports directory routing: api/materials/[userId]/[subjectId].js

        // HOWEVER, to keep it simple and match "Just one folder" advice:
        // Parsing path segments from req.url in a single file api/materials.js is harder if URL is /api/materials/u/s

        // IF I create `api/materials/[userId]/[subjectId].js`, it's structured.
        // IF I create `api/materials.js`, it only handles `/api/materials`.

        // The frontend uses: `fetch('/api/materials/${currentUser}/${subId}')`
        // I MUST create directory structure: `api/materials/[userId]/[subjectId].js`
        // OR I update frontend to use query params.

        // Updating frontend is easier: `fetch('/api/materials?userId=...&subjectId=...')`
        // I will do that. It's cleaner than nested folders for a simple migration.

        // So I will update index.html fetchMaterialsForSubject first.

        const { userId, subjectId } = req.query;
        if (!userId || !subjectId) return res.status(400).json({ error: "Missing params" });

        const user = await getUser(userId);
        const sub = user.subjects ? user.subjects.get(subjectId) : null;
        res.json({ materials: sub ? sub.materials.reverse() : [] });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
