const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');

console.log("🧪 Starting Pilot Resilience Test...");

// 1. Start Server with BAD Mongo URI
const env = { ...process.env, MONGO_URI: "mongodb://invalid-host:27017/test_db", PORT: "3001" };
const serverProcess = spawn('node', [serverPath], { env, stdio: 'pipe' });

const SERVER_URL = 'http://localhost:3001/api/chat';

let serverOutput = "";
serverProcess.stdout.on('data', data => {
    const str = data.toString();
    serverOutput += str;
    // console.log("SERVER:", str.trim()); 
});

serverProcess.stderr.on('data', data => {
    // console.error("SERVER ERR:", data.toString().trim());
});

async function runTest() {
    console.log("⏳ Waiting for server to boot (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    try {
        console.log("🚀 Sending POST to /api/chat (expecting 200 OK despite DB failure)...");

        const response = await axios.post(SERVER_URL, {
            message: "Hello world!",
            userId: "test_user@example.com",
            subjectId: "subject_1"
        });

        console.log("✅ Status Code:", response.status);
        console.log("✅ Response Body:", response.data);

        if (response.status === 200 && response.data.result) {
            console.log("✅ SUCCESS: Pilot responded despite invalid MongoDB!");
        } else {
            console.error("❌ FAILURE: Unexpected response format.");
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ FAILURE: Request failed");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    } finally {
        serverProcess.kill();
        process.exit(0);
    }
}

runTest();
