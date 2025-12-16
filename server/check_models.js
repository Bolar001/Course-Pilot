const axios = require('axios');
require('dotenv').config();

async function listModels() {
    try {
        const response = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` }
        });

        const models = response.data.data;
        console.log(`Found ${models.length} models.`);

        // const visionModels = models.filter(m => m.id.includes('vision') || m.id.includes('3.2'));
        console.log("--- All Models ---");
        models.forEach(m => console.log(m.id));

    } catch (e) {
        console.error("Error listing models:", e.message);
    }
}

listModels();
