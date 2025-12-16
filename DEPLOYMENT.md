# Deployment Guide: EduCoach AI

Your app consists of two parts. You must deploy them separately.

## Part 1: deploy the Backend (Node.js)
We recommend **Render.com** (it's free and easy).

1.  **Create a GitHub Repository**:
    *   Initialize a git repo in your project folder.
    *   Push your code to GitHub.
2.  **Go to Render.com**:
    *   Create a "New Web Service".
    *   Connect your GitHub repo.
    *   **Root Directory**: `server` (Important!)
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server.js`
    *   **Environment Variables**: Add your `AI_API_KEY` here.
3.  **Copy the URL**: render will give you a URL like `https://educoach-backend.onrender.com`.

## Part 2: Connect Frontend to Backend
1.  Open `index.html` on your computer.
2.  Find this line (around line 506):
    ```javascript
    const API_BASE_URL = 'http://localhost:3000'; // CHANGE THIS FOR DEPLOYMENT
    ```
    *(I will add this variable in my next edit so it's easy to find)*
3.  Change it to your new Render URL:
    ```javascript
    const API_BASE_URL = 'https://educoach-backend.onrender.com';
    ```

## Part 3: Deploy Frontend (HTML)
We recommend **Netlify** or **Vercel**.

1.  **Drag and Drop**:
    *   Go to Netlify Drop (app.netlify.com/drop).
    *   Drag your `index.html` (and any assets) folders there.
2.  **Done!** You will get a public link like `https://educoach-demo.netlify.app`.

---

## checklist for "Completion"
- [ ] Get a Groq or Meta API Key.
- [ ] Add it to `.env` (locally) or Render (deployment).
- [ ] App is then fully live!
