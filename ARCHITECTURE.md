# Course Pilot - Technical Architecture & Roadmap

## 🚀 Current State: The Hackathon Demo (Frontend Only)
You currently have a **"Client-Side Simulation"**.
- **Files**: Single `index.html`.
- **AI**: Logic is hardcoded (simulated) in JavaScript.
- **WhatsApp**: Can be triggered via deep links (`wa.me`) or simulated via UI.

This is perfect for a **48-hour video demo** because it never breaks and looks 100% real.

---

## 🏗️ Phase 2: "Real" Implementation (Post-Hackathon)
To make this fully functional with **Real Meta AI (Llama 3)** and the **WhatsApp Business API**, you need to build a **Backend Server**. You cannot do this in a single HTML file because of security (hiding API keys).

### The Stack You Will Need:
1.  **Backend**: Node.js (with Express) or Python (FastAPI).
2.  **Database**: MongoDB or Firebase (to store user quizzes/notes).
3.  **AI Engine**: Replicate (hosting Llama 3) or Meta's direct API.
4.  **Messaging**: WhatsApp Business Cloud API.

### How the Data Flows:
1.  **User** uploads PDF in the Web App.
2.  **Frontend** sends PDF to your **Backend**.
3.  **Backend** sends text to **Meta Llama 3**.
4.  **Llama 3** behaves as "Course Pilot" and returns the summary/quiz.
5.  **Backend** sends the result back to the **Frontend** AND pushes it to the user's **WhatsApp**.

---

## 📲 How WhatsApp Integration Works
There are two ways to do this. For the **Demo**, we will use **Option 1**.

### Option 1: "Share to WhatsApp" (No Backend Needed)
*   **How it works**: We add a button that takes the AI's summary and opens the WhatsApp app on the user's phone/desktop with the text pre-filled.
*   **Code**: `window.open('https://wa.me/?text=' + encodeURIComponent(summary_text))`
*   **Pros**: Works immediately in your single file. Great for demos.

### Option 2: "WhatsApp Chatbot" (Requires Backend)
*   **How it works**: The user chats with a bot number directly. "Hey, quiz me on Biology."
*   **Code**: Requires Webhooks setup in the Meta Developer Portal.
*   **Pros**: True Agentic experience.
*   **Cons**: Takes days to verify a business phone number and set up servers.

---

## ✅ Next Step for You
I will now update your `index.html` to include **Option 1 (Share to WhatsApp)**. 

This will check the box for "Integration with WhatsApp" for your demo video without needing a complex server.
