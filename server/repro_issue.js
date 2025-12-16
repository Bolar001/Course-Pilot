const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

async function run() {
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log("Key pfx:", geminiKey ? geminiKey.substring(0, 5) : "None");

    const candidates = [
        "gemini-2.0-flash-exp"
    ];

    for (const model of candidates) {
        console.log(`\nTesting: ${model}...`);
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
                {
                    contents: [{
                        parts: [
                            { text: "Describe this image." },
                            { inline_data: { mime_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==" } }
                        ]
                    }]
                }
            );

            console.log(`✅ SUCCESS with ${model}!`);
            const text = response.data.candidates[0].content.parts[0].text;
            console.log("Output:", text);
            return; // Found one!

        } catch (e) {
            console.log(`❌ Failed ${model}: ${e.response ? e.response.status : e.message}`);
        }
    }
    console.log("All candidates failed.");
}

run();
