const axios = require('axios');
require('dotenv').config();

const modelsToTest = [
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-instruct", // Potential new name?
    "llama-3.2-90b-vision-instruct",
    "llama-3.2-vision-preview",
    "llama-vision-free" // Sometimes used in free tier?
];

async function testModel(modelName) {
    console.log(`Testing: ${modelName}...`);
    try {
        await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==" } }
                    ]
                }
            ],
            max_tokens: 10
        }, { headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` } });

        console.log(`✅ SUCCESS: ${modelName} is working!`);
        return modelName;
    } catch (e) {
        const p = e.response ? e.response.data.error : e.message;
        console.log(`❌ FAILED: ${modelName} - ${JSON.stringify(p)}`);
        return null;
    }
}

async function run() {
    console.log("Brute-forcing Vision Model discovery...");
    for (const m of modelsToTest) {
        const valid = await testModel(m);
        if (valid) {
            console.log(`\n\n!!! FOUND WORKING MODEL: ${valid} !!!`);
            process.exit(0);
        }
    }
    console.log("\nNo working Vision models found on Groq.");
}

run();
