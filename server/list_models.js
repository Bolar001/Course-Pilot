const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
    console.log("Listing models with key:", API_KEY ? "Present" : "Missing");
    try {
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
        );

        const models = response.data.models;
        if (models) {
            console.log(`Total Models: ${models.length}`);
            models.sort((a, b) => a.name.localeCompare(b.name));
            models.forEach(m => console.log(m.name));
        } else {
            console.log("No models found in response.");
        }

    } catch (e) {
        console.error("List Models Error:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}

listModels();
