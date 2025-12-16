# How to Deploy Course Pilot to Vercel

## 1. Push to GitHub
If you haven't already, push your code to GitHub:
1. Initialize git: `git init`
2. Add files: `git add .`
3. Commit: `git commit -m "Ready for deployment"`
4. Push to your repository.

## 2. Deploy on Vercel
1. Go to [Vercel.com](https://vercel.com) and Log In.
2. Click **Add New** > **Project**.
3. Import your GitHub Repository (`Hackathon Project` or whatever you named it).
4. **Configure Project:**
   - **Framework Preset:** Select "Other".
   - **Root Directory:** Keep as `./` (Root).
   - **Environment Variables:** (CRITICAL)
     You must add the keys from your `server/.env` file here:
     - `GEMINI_API_KEY`: (Your Key)
     - `AI_API_KEY`: (Your Key)
     - `AI_PROVIDER`: `groq`
5. Click **Deploy**.

## 3. Usage
- Vercel will build your backend and frontend.
- Once done, you will get a URL like `https://project-name.vercel.app`.
- Open that URL to use your app!

> **Note:** The `db.json` file (memory) will NOT persist on Vercel because it's a read-only serverless environment. For a hackathon demo, this is fine (memory resets on redeploy), but for production, you'd need a real database (MongoDB/Postgres).
