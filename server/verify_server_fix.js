const path = require('path');
// Mocking the server environment loading behavior
console.log("CWD:", process.cwd());
console.log("__dirname:", __dirname);
try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    console.log("AI_API_KEY from .env:", process.env.AI_API_KEY ? "FOUND" : "MISSING");
} catch (e) {
    console.error("Error loading .env:", e.message);
}
