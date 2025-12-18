const multer = require('multer');
const pdfParse = require('pdf-parse');
const { connectToDatabase, updateMemory } = require('../server/pilot_core');

// Configure Multer (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() }).single('file');

// Helper to run middleware
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// Vercel Config: Disable body parser so Multer can read stream
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        await runMiddleware(req, res, upload);
    } catch (e) {
        return res.status(500).json({ error: "File upload error: " + e.message });
    }

    try {
        await connectToDatabase();

        if (!req.file) return res.status(400).json({ error: 'No file' });
        const { userId, subjectId, lessonTitle } = req.body;

        let text = "Text extraction simulated for demo. Add GCP Vision for real PDF/Image OCR.";
        if (req.file.mimetype === 'application/pdf') {
            try {
                const data = await pdfParse(req.file.buffer);
                text = data.text;
            } catch (e) { console.error("PDF Error", e); }
        }

        let materials = [];
        if (userId && subjectId) {
            const subState = await updateMemory(userId, subjectId, 'upload_notes', {
                fileName: req.file.originalname,
                preview: text.substring(0, 500),
                lessonTitle: lessonTitle || "General Note"
            });
            materials = subState.materials;
        }

        res.json({ success: true, textPreview: text.substring(0, 200), materials });

    } catch (e) {
        console.error("Upload Logic Error:", e);
        res.status(500).json({ error: 'Upload failed' });
    }
};

module.exports.config = {
    api: {
        bodyParser: false, // Disallow Vercel from parsing body, let Multer do it
    },
};
