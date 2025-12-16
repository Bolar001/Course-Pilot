const axios = require('axios');

async function verifyServer() {
    console.log("Testing Server Endpoint /api/chat...");
    try {
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: "Hello Course Pilot, are you online?",
            userId: "test_user",
            subjectId: "General"
        });

        console.log("Status:", response.status);
        if (response.data.result) {
            console.log("AI Response:", response.data.result.substring(0, 100) + "...");
            if (response.data.result.includes("falling back to simulation")) {
                console.error("FAILURE: Still functioning in simulation mode.");
            } else {
                console.log("SUCCESS: Connected to Llama 3 via Server!");
            }
        } else {
            console.error("Unexpected response format:", response.data);
        }
    } catch (e) {
        console.error("Request Failed:", e.message);
        if (e.response) {
            console.error("Data:", e.response.data);
        }
    }
}

verifyServer();
