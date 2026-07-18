# Running AxesAI Locally (full stack)

AxesAI has **three** services that must run together for the full flow.

| Service | Folder | Port | Start command |
|---------|--------|------|---------------|
| Main API + Socket.IO | `backend/` | **5001** | `npm run dev` |
| Web app (Next.js) | `frontend/` | 3000 | `npm run dev` |
| FaceID microservice | `face-service/` | 8001 | `python main.py` |

The frontend hardcodes `http://localhost:5001` for the API, so the backend **must** run on 5001 (set via `PORT=5001` in `backend/.env`).

## Prerequisites
- **Node 18+**, **Python 3.10+**
- **Internet access** (Groq LLM + Atlas are cloud services)
- **MongoDB** — Atlas URI (already set in `backend/.env`) or local `mongodb://127.0.0.1:27017`
- **Redis** running locally (`127.0.0.1:6379`) — required by the BullMQ AI-generation queue
- A **Groq API key** (free): https://console.groq.com/keys — already set in `backend/.env`

### 0a. Redis via Docker (recommended)
```bash
# Start Docker Desktop first, then:
docker run -d --name axesai-redis -p 6379:6379 redis:7
docker ps            # confirm axesai-redis is up
# To stop/remove later: docker rm -f axesai-redis
```
> Redis is only needed for **AI assessment generation**. Login, classrooms, quizzes,
> analytics, doubt-chat, and viva all work without it.

### 0b. MongoDB Atlas IP whitelist
Atlas → **Network Access** → **Add IP Address** → `0.0.0.0/0` (allow all — fine for dev).
Without this, Mongo connections time out even with internet.

## 1. Backend
```bash
cd backend
npm install                 # already done
cp .env.example .env        # then edit .env: set GROQ_API_KEY and MONGO_URI
npm run dev                 # http://localhost:5001/health
```
A `.env` with local defaults is already created — you only need to paste your `GROQ_API_KEY`
(and point `MONGO_URI` at Atlas if you are not running Mongo locally).

## 2. Frontend
```bash
cd frontend
npm install                 # already done
npm run dev                 # http://localhost:3000
```

## 3. FaceID service (optional — only needed for face login)
```bash
cd face-service
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
python main.py              # http://localhost:8001
```
> `face_recognition` depends on **dlib**, which needs C++ build tools on Windows.
> If it won't install, face login simply won't work — the rest of the platform runs fine without it.

## Feature → endpoint map (all implemented)
1. Handwritten OCR + AI grading — `POST /api/documents/grade-handwritten`
2. Class analytics — `GET /api/classrooms/:id/analytics`
3. Student search + history — `GET /api/classrooms/students/search`, `GET /api/classrooms/students/:studentId/performance`
4. AI teacher home summary — `GET /api/assignments/teacher-summary`
5. PageIndex doubt chatbot — `POST /api/documents/upload-classroom-doc`, `POST /api/documents/query-classroom-doc`
6. Live viva agent — `POST /api/classrooms/viva/start`, `POST /api/classrooms/viva/submit-answer`, `GET /api/classrooms/:classroomId/viva/history`

## Smoke test (run in order, confirm each works)
1. `curl http://localhost:5001/health` → `{"status":"ok"}`  (backend + Mongo up)
2. Open http://localhost:3000 → register a **teacher**, then a **student** (separate browser/incognito).
3. Teacher → create classroom → copy join code. Student → join with code. Teacher's "Enrolled Students" shows the student.
4. Teacher → search box: type part of the student's name → server-side results appear (Feature 3).
5. Teacher → upload notes PDF → generate assessment (needs Redis + Groq). Status flips pending→completed.
6. Teacher → launch live quiz. Student's screen locks, timer counts down, auto-submits at 0.
7. Teacher dashboard → analytics populate (submission rate, avg/median, grade bands) (Feature 2).
8. Teacher → home summary tiles: reviewed count, time saved, graded total (Feature 4).
9. Student → doubt chatbot: ask a question about the uploaded notes → grounded answer with section citation (Feature 5).
10. Student → start viva → speak an answer → dynamic follow-up. Teacher → viva review shows transcript + scores (Feature 6).
11. Teacher → upload a handwritten answer image + rubric → OCR text + per-criterion scores + confidence (Feature 1).

## Typical demo flow (sellable SaaS walk-through)
1. Register a **teacher** account → create a classroom → share the join code.
2. Register a **student** → join with the code.
3. Teacher: upload notes (PDF) → generate an AI assessment → launch a live quiz.
4. Student: take the timed quiz (anti-cheat active) → auto-submit at 0.
5. Teacher dashboard: view analytics, teacher summary, student performance history.
6. Student: ask doubts via the PageIndex chatbot; run a live viva.
