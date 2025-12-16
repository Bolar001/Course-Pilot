const axios = require('axios');
require('dotenv').config({ path: './server/.env' });


const API_KEY = process.env.AI_API_KEY;

async function testVision() {
    console.log("Testing Vision API with key:", API_KEY ? "Present" : "Missing");

    // Small 1x1 red dot png base64
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==";
    const dataUrl = `data:image/png;base64,${base64Image}`;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.2-90b-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is this image?" },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 10
        }, { headers: { Authorization: `Bearer ${API_KEY}` } });

        console.log("Success! Response:", response.data.choices[0].message.content);
    } catch (error) {
        console.error("Error Status:", error.response ? error.response.status : "No Response");
        console.error("Error Data:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

testVision();
