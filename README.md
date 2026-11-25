# ExamSaathi — Gemini edition

## Update the existing Render deployment
1. Download this ZIP and extract it.
2. Upload/replace **all files** in the root of the GitHub repository connected to your Render service. Keep the files at the repository root (not inside an extra nested folder).
3. Commit the changes to GitHub. If Render Auto-Deploy is enabled, it will deploy automatically. Otherwise open Render → your ExamSaathi service → Manual Deploy → Deploy latest commit.
4. In Render → ExamSaathi service → Environment, make sure `GEMINI_API_KEY` is present. Do not paste the key into GitHub or any browser file. Save changes.
5. Optional: set `GEMINI_MODEL` to a model available to your Google AI Studio project. The default in this package is `gemini-3.5-flash-lite`.
6. Keep `TEACHER_PASSWORD` in Render Environment too. Do not share either secret in screenshots or chat.

## Test
After deployment finishes, open your ExamSaathi website, refresh it, and ask: `Explain DBMS in simple language with an example.` The answer should come from Gemini. If an error appears, copy only the error text; never share the API key.

## Technical notes
- Node.js 18 or newer; no external npm packages required.
- Gemini requests are made by the server using the `x-goog-api-key` header. The key is not sent to the browser or placed in the request URL.
- Gemini is the only live AI provider in this build. If the key is missing or Gemini rejects the request, the app will show matching built-in notes as a fallback.
- Teacher PYQs are stored in `pyqs.json`. Render's ordinary local filesystem can be ephemeral; use a persistent disk or database if uploaded PYQs must survive restarts/redeploys.


## Teacher photo uploads and subject-specific AI
- Sign in to Teacher Corner, enter a subject and optional topic, then upload a JPG/PNG/WEBP photo (up to 4 MB).
- Gemini transcribes the photo and saves the extracted text in `materials.json`, tagged with the teacher's subject/topic.
- Students can choose a subject in Ask AI. The server includes only teacher materials tagged with that subject, reducing cross-subject answers.
- Set `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), and `TEACHER_PASSWORD` in Render Environment.
- Render's local filesystem may be ephemeral; use a persistent disk or database for long-term materials/PYQ storage.
