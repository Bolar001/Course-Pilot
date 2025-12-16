# Advanced Agentic Upgrade Plan

## 🎯 Goal
Upgrade EduCoach AI to a **Multi-Subject, Multi-User Student Engagement System**.

## 🏗️ Architecture Changes

### 1. Data Structure (Backend)
We will move from `studentState` to a structured In-Memory Database:
```javascript
const db = {
  users: {
    "student123": {
      name: "Demo Student",
      subjects: {
        "ELE202": { topics: [], quizzes: [], weakness: 0.8 }, // 0.8 = high weakness
        "CVE254": { topics: [], quizzes: [], weakness: 0.2 }
      },
      lastActiveSubject: "ELE202"
    }
  }
}
```

### 2. Frontend UX Flow
1.  **Login Screen**: Simple ID input (no password needed for hackathon).
2.  **Dashboard**: Grid view of your subjects (ELE202, CHE242) acts as the "Home".
3.  **Study Mode**: The existing chat interface, but now context-aware of the *selected subject*.

### 3. Agent Capabilities
-   **Subject Routing**: When uploading, select "Subject".
-   **Cross-Subject Intelligence**: "You've been studying ELE202 for 2 hours, maybe switch to CVE254?"
-   **Pattern Matching**: Simulating "Pattern Extraction" from past questions.

## 📝 Steps
1.  **Frontend**: Create Login Modal & Subject Selector.
2.  **Backend**: Refactor `server.js` to handle `userId` and `subjectId` in API calls.
3.  **Logic**: Implement the "Pattern Analysis" simulation in the upload endpoint.
