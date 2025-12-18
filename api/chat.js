// Vercel Serverless Function (CommonJS)
// NOTE: This project is NOT using Next.js, so we use module.exports, NOT export default.

module.exports = async (req, res) => {
    // Enable CORS for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        // Check ENV availability
        if (!process.env.AI_API_KEY) {
            console.error("DEBUG: AI_API_KEY is missing in Vercel ENV.");
            // Don't fail hard on this for the connectivity test, just warn
            // return res.status(500).json({ error: "AI key missing" });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message missing" });
        }

        // TEMP RESPONSE (to confirm connection works)
        return res.status(200).json({
            reply: "Pilot is connected ✅ (CommonJS Mode)"
        });

    } catch (err) {
        console.error("API ERROR:", err);
        return res.status(500).json({ error: "Pilot crashed: " + err.message });
    }
};
