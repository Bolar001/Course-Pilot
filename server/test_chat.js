const axios = require('axios');

async function testChat() {
    console.log("Testing LIVE localhost:3000/api/chat...");

    try {
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: "Hello, why no response?",
            userId: "guest@edu.com",
            subjectId: "General"
        }, {
            validateStatus: () => true
        });

        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.error("Connection Failed:", e.message);
    }
}

testChat();
