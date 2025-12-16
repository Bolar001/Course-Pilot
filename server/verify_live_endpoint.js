const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testLiveEndpoint() {
    console.log("Testing LIVE localhost:3000/api/upload_handwritten...");

    // Create a dummy 1x1 png
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQCYhKpHOgAAAABJRU5ErkJggg==";
    const buffer = Buffer.from(base64Image, 'base64');

    const form = new FormData();
    form.append('file', buffer, { filename: 'test_dot.png', contentType: 'image/png' });

    try {
        const response = await axios.post('http://localhost:3000/api/upload_handwritten', form, {
            headers: {
                ...form.getHeaders()
            },
            validateStatus: () => true // Accept all status codes
        });

        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));

        if (response.data.textPreview) {
            if (response.data.textPreview === "undefined") {
                console.log("❌ CRITICAL: Server returned string 'undefined'. Code is STALE.");
            } else if (response.data.textPreview.includes("Simulation")) {
                console.log("⚠️ Server returned Simulation (Stale Code or Fallback Active).");
            } else if (response.data.textPreview.includes("Analysis Failed") || response.data.textPreview.includes("Rate Limit")) {
                console.log("✅ Server returning explicit error (NEW CODE IS ACTIVE).");
            } else {
                console.log("✅ Server returned real text!");
            }
        } else {
            console.log("❓ Unexpected response format.");
        }

    } catch (e) {
        console.error("Connection Failed:", e.message);
        console.log("Server might not be running on 3000.");
    }
}

testLiveEndpoint();
