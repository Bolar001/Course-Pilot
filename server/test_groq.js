const axios = require('axios');
require('dotenv').config();

async function testConnection() {
    const apiKey = process.env.AI_API_KEY;
    console.log("Checking API Key...");
    if (!apiKey) {
        console.error("No AI_API_KEY found in .env");
        return;
    }
    if (!apiKey.startsWith("gsk_")) {
        console.error("API Key does not start with 'gsk_', might be invalid format.");
        console.log("Key found:", apiKey ? apiKey.substring(0, 5) + "..." : "None");
        return;
    }
    console.log("API Key looks valid (starts with gsk_). Testing connection...");

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "user",
                content: "Hello, are you working?"
            }]
        }, { headers: { Authorization: `Bearer ${apiKey}` } });

        console.log("Success! Response:");
        console.log(response.data.choices[0].message.content);
    } catch (e) {
        console.error("Connection Failed!");
        console.error("Message:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("No response received (Network error?)");
        }
    }
}

testConnection();
