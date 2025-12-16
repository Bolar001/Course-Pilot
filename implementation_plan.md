# Implementation Plan: EduCoach AI Real Backend

## Goal
Transition from a simulation to a working full-stack application connecting:
1.  **Frontend**: The existing `index.html` (updated to talk to server).
2.  **Backend**: A Node.js Express server (`server/`).
3.  **AI**: Integration with Meta Llama 3 (via Groq/Replicate or Meta API).
4.  **WhatsApp**: Integration with WhatsApp Cloud API.

## ⚠️ Important Prerequisites
To run this code "for real", you will need:
1.  **Node.js Installed** (I checked, waiting for confirmation).
2.  **Meta Developer Account** (for WhatsApp API credentials).
3.  **AI API Key** (e.g., from Groq or Replicate to access Llama 3).

## Proposed Changes

### 1. Server Setup (`/server`)
We will create a specific folder for the backend to keep it clean.
*   `server/package.json`: Dependencies (`express`, `cors`, `dotenv`, `axios`, `multer` for files).
*   `server/server.js`: The main API entry point.
*   `server/.env`: Configuration file for API Keys.

### 2. Backend Logic
*   **POST /api/upload**: Receives the PDF/Image, extracts text (using a simple text extractor like `pdf-parse`).
*   **POST /api/ai**: Sends the text to Llama 3 to generate Summary/Quiz.
*   **POST /api/whatsapp**: Sends the result to the user's phone via WhatsApp Business API.

### 3. Frontend Updates (`index.html`)
*   Replace `MOCK_DATA` and `setTimeout` with `fetch('/api/...')` calls to the real server.

## Verification
*   I will provide a `start.bat` script to install dependencies and run the server easily.
*   We can test the server locally.

**Ready to build?**
