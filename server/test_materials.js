const axios = require('axios');

async function testMaterials() {
    try {
        // Test arbitrary user/subject
        const url = 'http://localhost:3000/api/materials?userId=test@edu.com&subjectId=Physics';
        console.log("Testing:", url);
        const res = await axios.get(url);
        console.log("Status:", res.status);
        console.log("Data:", res.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

testMaterials();
