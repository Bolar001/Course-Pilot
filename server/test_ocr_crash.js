const Tesseract = require('tesseract.js');

async function run() {
    console.log("Starting OCR Check...");
    try {
        // Simple 1x1 PNG base64
        const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwftQAAAABJRU5ErkJggg==";

        console.log("Calling recommend...");
        const result = await Tesseract.recognize(base64Image, 'eng');
        console.log("OCR Success. Text:", result.data.text);
    } catch (e) {
        console.error("OCR Failed:", e);
    }
}

run();
