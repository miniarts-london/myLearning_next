# Ask this course (AI service)

A small Python service that answers learners' questions from a course's own content, using retrieval (RAG) and Claude. The Next.js app is its only client.

```
Next.js ──(shared token)──► FastAPI
  │  sends course content          ├─ chunk (app/chunking.py) → embed (app/embeddings.py) → Chroma (app/store.py)
  │  + activities the learner      └─ /ask: search this course, only allowed activities → Claude (app/answer.py)
  │    may see                         → streams sources, then the answer
```

**It never talks to Moodle.** The Next.js app fetches content with the learner's own Moodle token and sends it here; with each question it sends the activities that learner may see, and search is limited to those. Hidden or restricted content can't end up in an answer, and no Moodle token is stored here.

## Run it

Python 3.10 or newer (the Python that comes with macOS is 3.9: install a newer one with `brew install python@3.12`).

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill it in (see below)
uvicorn app.main:get_app --factory --reload --port 8000
```

Or from the project root: `npm run ai`.

In `.env`:

- `AI_SERVICE_TOKEN`: any long random string (`openssl rand -base64 32`). Put the **same** value in the Next.js `.env.local`.
- `ANTHROPIC_API_KEY`: your Claude API key. Without it the service runs in **demo mode**: it shows the most relevant course extracts instead of writing an answer.
- `CLAUDE_MODEL`: `claude-haiku-5-5` (fast, cheap) or `claude-sonnet-5-5` (better answers).

The first start downloads a small embedding model (about 80 MB) that then runs locally: no second API key.

Check it: <http://localhost:8000/health> shows `"demo_mode": false` once your key is set.

## Tests

```bash
source .venv/bin/activate
pytest
```

They use a stand-in for Claude and an offline embedder, so they're free and need no network. They cover chunking, search (including that restricted activities are never returned), the API, the daily limit, errors and demo mode.

## API

All endpoints except `/health` need `Authorization: Bearer <AI_SERVICE_TOKEN>`.

| | |
| --- | --- |
| `GET /health` | Is it up, and is a Claude key set? |
| `GET /courses/{id}/index` | What's indexed for a course, and when |
| `PUT /courses/{id}/documents` | Replace a course's content: `{ documents: [{ cmid, title, section, href, html }] }` |
| `POST /courses/{id}/ask` | `{ question, user_id, allowed_cmids }` → newline-delimited JSON: `sources`, then `text` pieces, then `done` |

## Design notes

- **Grounded answers.** Claude is told to answer only from the numbered extracts, cite them, and say when the course doesn't cover the question. Chunks that aren't close enough to the question are dropped, and if none are left Claude isn't called at all.
- **Prompt injection.** Course text is wrapped in `<course_extracts>` and Claude is told it's material, not instructions.
- **Cost control.** A daily question limit per learner (`DAILY_QUESTION_LIMIT`), short answers (`max_tokens` 800), and the cheapest model by default. Also set a monthly spending limit in the Claude Console.
- **Freshness.** The Next.js app re-indexes a course when the learner can see an activity that isn't indexed yet, or when the index is over 6 hours old.
- **Scaling.** The daily limit is kept in memory, which is fine for one process. With several, move it to shared storage such as Redis.
