# ExamSaathi

## Deploy on Render
1. Upload all files in this folder to the root of a GitHub repository.
2. In Render, create **New + > Web Service** and connect that repository.
3. Use Runtime **Node**, Build Command `npm install`, and Start Command `npm start`.
4. Add environment variable `TEACHER_PASSWORD` with a strong teacher password.
5. Optionally add `ANTHROPIC_API_KEY` for the AI tutor. Keep this key in Render environment variables only; never put it in browser files or GitHub.
6. Deploy. Render will provide a public `onrender.com` URL.

The app requires Node 18 or newer. There are no external npm dependencies.

## Local run
Set `TEACHER_PASSWORD` and optionally `ANTHROPIC_API_KEY`, then run `npm start` and open http://localhost:3000.

## Important storage note
Teacher PYQs are stored in `pyqs.json` on the server. A Render service's ordinary local filesystem may be ephemeral, so uploaded PYQs may be lost on redeploy/restart unless persistent storage or a database is configured. Do not treat this starter setup as permanent storage.
