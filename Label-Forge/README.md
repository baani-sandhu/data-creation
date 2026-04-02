# LabelForge

A human-in-the-loop pipeline that converts unstructured organizational documents into structured fine-tuning datasets for LLMs.

---

## What It Does

Most organizations have knowledge locked inside unstructured documents — customer service scripts, internal wikis, coding guidelines, HR manuals, legal contracts. Fine-tuning LLMs requires structured training pairs. LabelForge bridges that gap.

**Input:** PDFs

**Output:** Structured training pairs in JSON, JSONL, or CSV format

```json
[
  {
    "situation": "Customer asking about delivery times",
    "script": "Our standard delivery takes 3-5 business days..."
  }
]
```

---

## How It Works

```
Upload Documents
      ↓
Extract & Chunk
      ↓
Manual Annotation (few-shot examples)
      ↓
LLM Generation (Gemini 2.5 Flash)
      ↓
Confidence Scoring
      ↓
┌─────────────────┐
↓                 ↓
High Confidence   Low Confidence
Auto-Saved        Human Review
 ↓                 ↓
 └────── Export ───┘
```

### Pipeline Steps

| Step               | What Happens                                                        |
|--------------------|---------------------------------------------------------------------|
| 1. Setup           | Upload documents, define output fields, write task prompt           |
| 2. Extract & Chunk | Documents parsed and split into large chunks (~4000 words each)     |
| 3. Sample Labeling | User annotates pairs from any chunk by highlighting text            |
| 4. LLM Generation  | Gemini extracts pairs from all chunks using few-shot examples       |
| 5. Review & Route  | High confidence auto-saved, low confidence routed to human review   |
| 6. Export          | Download complete dataset in chosen format                          |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | FastAPI, Python |
| Database | MongoDB Atlas |
| LLM | Gemini 2.5 Flash |
| Auth | Firebase Authentication |
| File Storage | Local `/uploads` folder |

---

## Project Structure

```
labelforge/
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── components/
│   │       │   ├── steps/
│   │       │   │   ├── Step1Setup.tsx
│   │       │   │   ├── Step2Extract.tsx
│   │       │   │   ├── Step3Sample.tsx
│   │       │   │   ├── Step4LLMGeneration.tsx
│   │       │   │   ├── Step5Review.tsx
│   │       │   │   └── Step6Export.tsx
│   │       │   ├── LoginPage.tsx
│   │       │   └── Layout.tsx
│   │       └── lib/
│   │           ├── firebase.ts
│   │           ├── auth.ts
│   │           └── AuthContext.tsx
│   └── .env.local
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── database.py
    │   ├── auth.py
    │   ├── routers/
    │   │   ├── jobs.py
    │   │   ├── examples.py
    │   │   ├── generation.py
    │   │   ├── prompts.py
    │   │   └── export.py
    │   └── services/
    │       ├── extractor.py
    │       ├── chunker.py
    │       ├── prompt_builder.py
    │       └── llm_service.py
    ├── uploads/
    ├── firebase_service_account.json   ← never commit this
    ├── .env                            ← never commit this
    └── requirements.txt
```

---

## API Endpoints

```
POST   /jobs/                              Create job + upload files
GET    /jobs/                              List all jobs for current user
GET    /jobs/:id                           Get job details
GET    /jobs/:id/chunks                    Get all chunks (paginated)
POST   /jobs/:id/examples                  Save manual annotations
GET    /jobs/:id/examples                  Get all few-shot examples
DELETE /jobs/:id/examples/:id              Delete an example
POST   /jobs/:id/generate                  Run LLM generation
GET    /jobs/:id/results                   Get results (filterable)
GET    /jobs/:id/results/stats             Get counts summary
PATCH  /jobs/:id/results/:id               Approve / discard / edit a result
POST   /jobs/:id/results/:id/add-example   Add result to few-shot pool
GET    /jobs/:id/export                    Download dataset file
POST   /prompts/refine                     Refine task prompt with Gemini
GET    /auth/me                            Get current user info
```

---

## MongoDB Collections

```
jobs             One document per labeling job
chunks           One document per text chunk
examples         Human-labeled pairs used as few-shot examples
results          All extracted pairs with confidence scores
```

### Result Document Shape

```json
{
  "_id": "uuid",
  "job_id": "uuid",
  "user_id": "firebase-uid",
  "chunk_id": "uuid",
  "chunk_index": 3,
  "source_filename": "manual.pdf",
  "pair": {
    "situation": "...",
    "script": "..."
  },
  "confidence": 0.92,
  "reasoning": "Clear situation-script mapping present in text",
  "source": "model",
  "approved": true,
  "discarded": false,
  "human_reviewed": false,
  "used_as_example": false,
  "run_number": 1,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB Atlas account
- Firebase project
- Gemini API key

### Backend

```bash
cd backend
python -m venv venv

# activate
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

Create `backend/.env`:
```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/labelforge
GEMINI_API_KEY=your-gemini-key-here
GOOGLE_APPLICATION_CREDENTIALS=firebase_service_account.json
```

Place your Firebase service account JSON at `backend/firebase_service_account.json`.

Run the backend:
```bash
uvicorn app.main:app --reload --port 8001
```

API docs available at: `http://localhost:8001/docs`

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

Run the frontend:
```bash
npm run dev
```

Open `http://localhost:5173`

---

## Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication → Sign-in method → Google + Email/Password
3. Register a web app → copy the config into `frontend/.env.local`
4. Project Settings → Service accounts → Generate new private key → save as `backend/firebase_service_account.json`

---

## Environment Variables Reference

### Backend `.env`

| Variable                         | Description                           |
|----------------------------------|---------------------------------------|
| `MONGO_URI`                      | MongoDB Atlas connection string       |
| `GEMINI_API_KEY`                 | Google Gemini API key                 |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON |

### Frontend `.env.local`

| Variable                           | Description              |
|------------------------------------|--------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain     |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Firebase project ID      |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | Firebase app ID          |

---

## Security Notes

- `firebase_service_account.json` must never be committed to Git
- `.env` and `.env.local` must never be committed to Git
- All API endpoints are protected by Firebase token verification
- All database queries are scoped to the authenticated user's `uid`
- Gemini API key lives only in the backend — never in the frontend

Add to `.gitignore`:
```
backend/.env
backend/firebase_service_account.json
backend/uploads/
frontend/.env.local
```

---

## Output Formats

### JSON
```json
[
  {"situation": "...", "script": "..."},
  {"situation": "...", "script": "..."}
]
```

### JSONL
```
{"situation": "...", "script": "..."}
{"situation": "...", "script": "..."}
```

### CSV
```
situation,script
"Customer asking about...","Our standard response is..."
```

---

## Confidence Routing

| Confidence | Route        | Action                                    |
|------------|--------------|-------------------------------------------|
| ≥ 0.75     | Auto-Saved   | Added to approved results automatically   |
| < 0.75     | Human Review | Shown in review queue for manual approval |

The threshold is configurable per job (default 0.75). Reviewed pairs can be added back as few-shot examples to improve subsequent generation runs.

---

## Feedback Loop

1. Run generation → some pairs are low confidence
2. Review low confidence pairs → correct and approve them
3. Add corrected pairs as examples → click "Re-run"
4. LLM re-generates using improved few-shot pool
5. More pairs pass the confidence threshold