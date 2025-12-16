const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

async function testGroq() {
    const key = process.env.AI_API_KEY;
    console.log("Key:", key ? key.substring(0, 10) + "..." : "Missing");

    if (!key) return;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Hello" }]
        }, {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("Success:", response.data.choices[0].message.content);
    } catch (e) {
        console.error("Groq Error:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

testGroq();
