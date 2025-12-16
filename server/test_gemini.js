const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testGemini() {
    console.log("Testing Gemini with Key:", API_KEY ? "Present" : "Missing");

    // 1x1 Red Dot
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==";

    try {
        console.log("Listing available Gemini models...");
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        res.data.models.forEach(m => {
            if (m.name.includes('gemini-1.5')) {
                console.log(m.name);
            }
        });
    } catch (e) {
        console.error("List Models Failed:", e.response ? e.response.data : e.message);
    }
}

testGemini();
