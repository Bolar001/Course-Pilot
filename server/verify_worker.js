const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Create a dummy 1x1 pixel PNG (base64)
const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwftQAAAABJRU5ErkJggg==";
const buffer = Buffer.from(base64Image, 'base64');
const tempPath = path.join(__dirname, 'test_image.png');

fs.writeFileSync(tempPath, buffer);

console.log("Testing OCR Worker with file:", tempPath);

// 2. Run the worker
exec(`node ocr_worker.js "${tempPath}"`, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
        console.error("Exec Error:", error.message);
    }
    if (stderr) {
        console.error("Worker Stderr:", stderr);
    }
    console.log("Worker Stdout:", stdout);

    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});
