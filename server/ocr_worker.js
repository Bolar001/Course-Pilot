const Tesseract = require('tesseract.js');
const fs = require('fs');

async function processImage() {
    try {
        const imagePath = process.argv[2];
        if (!imagePath) {
            console.error("No image path provided.");
            process.exit(1);
        }

        // Check if file exists
        if (!fs.existsSync(imagePath)) {
            console.error("File not found:", imagePath);
            process.exit(1);
        }

        const imageBuffer = fs.readFileSync(imagePath);

        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
            logger: m => { } // Silence progress logs to keep stdout clean
        });

        // Print text to stdout for parent process to capture
        console.log(text.trim());
        process.exit(0);

    } catch (error) {
        console.error("OCR Worker Error:", error);
        process.exit(1);
    }
}

processImage();
