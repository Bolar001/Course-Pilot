export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: "AI key missing" });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message missing" });
        }

        // TEMP RESPONSE (to confirm connection works)
        return res.status(200).json({
            reply: "Pilot is connected ✅"
        });

    } catch (err) {
        console.error("API ERROR:", err);
        return res.status(500).json({ error: "Pilot crashed" });
    }
}
