const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const API_KEY = process.env.GEMINI_API_KEY;

async function testGemini() {
    console.log("Testing gemini-1.5-flash on v1...");
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==";

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                contents: [{
                    parts: [
                        { text: "Describe this image." },
                        { inline_data: { mime_type: "image/png", data: base64Image } }
                    ]
                }]
            }
        );

        console.log("Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));

        if (response.data.candidates && response.data.candidates.length > 0) {
            console.log("Candidate:", JSON.stringify(response.data.candidates[0], null, 2));
        } else {
            console.log("❌ No candidates found!");
            if (response.data.promptFeedback) {
                console.log("Prompt Feedback:", JSON.stringify(response.data.promptFeedback, null, 2));
            }
        }

    } catch (e) {
        console.error("AXIOS ERROR:", e.message);
        if (e.response) {
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

testGemini();
