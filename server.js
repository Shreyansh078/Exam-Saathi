/* =====================================================================
   server.js: serves the app and forwards "Ask AI" questions to Gemini (or Claude),
   so your API key stays on your computer and never reaches the browser.
   Needs Node 18 or newer. No packages to install.

   Set GEMINI_API_KEY in your hosting provider environment variables.
   Optional: set GEMINI_MODEL to a model enabled for your Google AI Studio project.
         node server.js
   Open: http://localhost:3000
   ===================================================================== */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "";
const PYQ_FILE = path.join(__dirname, "pyqs.json");
const teacherSessions = new Set();

function readPyqs(){
  try { return JSON.parse(fs.readFileSync(PYQ_FILE, "utf8")); }
  catch(e){ return []; }
}
function writePyqs(items){
  fs.writeFileSync(PYQ_FILE, JSON.stringify(items, null, 2));
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if(body.length > 2_000_000){ reject(new Error("Request too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch(e){ reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
function isTeacher(req){
  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  return !!token && teacherSessions.has(token);
}
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".md": "text/markdown" };
const SYSTEM = "You are ExamSaathi, a friendly exam tutor for BCA students. " +
  "Answer in simple English, and reply in Hinglish if the student writes in Hinglish. " +
  "If student notes are provided and relevant, use them. Keep answers exam-oriented: " +
  "a short definition first, then key points, then a small example if it helps. " +
  "Use plain text only, with no markdown symbols like ** or #.";

function send(res, code, obj){
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  // Public student access: teacher-approved PYQs are shared from the server.
  if(req.method === "GET" && req.url === "/api/pyqs"){
    return send(res, 200, { pyqs: readPyqs() });
  }

  // Teacher sign-in. Set TEACHER_PASSWORD before starting the server.
  if(req.method === "POST" && req.url === "/api/teacher/login"){
    readBody(req).then(({password}) => {
      if(!TEACHER_PASSWORD) return send(res, 503, {error:"Teacher access is not configured. Set TEACHER_PASSWORD on the server."});
      if(password !== TEACHER_PASSWORD) return send(res, 401, {error:"Incorrect teacher password."});
      const token = crypto.randomBytes(32).toString("hex");
      teacherSessions.add(token);
      send(res, 200, {token});
    }).catch(e => send(res, 400, {error:e.message}));
    return;
  }

  if(req.method === "POST" && req.url === "/api/pyqs"){
    if(!isTeacher(req)) return send(res, 401, {error:"Teacher sign-in required."});
    readBody(req).then(({subject, topic, question, year, answer}) => {
      subject = String(subject || "").trim().slice(0,120);
      topic = String(topic || "").trim().slice(0,160);
      question = String(question || "").trim().slice(0,3000);
      answer = String(answer || "").trim().slice(0,8000);
      year = year ? String(year).trim().slice(0,12) : "";
      if(!subject || !topic || !question) return send(res, 400, {error:"Subject, topic and question are required."});
      const pyqs = readPyqs();
      const item = {id:crypto.randomUUID(), subject, topic, question, year, answer, createdAt:new Date().toISOString()};
      pyqs.unshift(item);
      writePyqs(pyqs);
      send(res, 201, {pyq:item});
    }).catch(e => send(res, 400, {error:e.message}));
    return;
  }

  if(req.method === "DELETE" && req.url.startsWith("/api/pyqs/")){
    if(!isTeacher(req)) return send(res, 401, {error:"Teacher sign-in required."});
    const id = decodeURIComponent(req.url.slice("/api/pyqs/".length));
    const pyqs = readPyqs(), next = pyqs.filter(x => x.id !== id);
    if(next.length === pyqs.length) return send(res, 404, {error:"PYQ not found."});
    writePyqs(next);
    return send(res, 200, {ok:true});
  }

  if(req.method === "POST" && req.url === "/api/teacher/logout"){
    const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
    teacherSessions.delete(token);
    return send(res, 200, {ok:true});
  }

  // 1. The AI endpoint: the browser sends { question, notes }
  if(req.method === "POST" && req.url === "/api/ask"){
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try{
        const { question, notes } = JSON.parse(body);
        if(!question || !String(question).trim()) throw new Error("Please enter a question.");
        const prompt = (notes ? "Student notes:\n" + notes + "\n\n" : "") + "Question: " + question;
        if(!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in Render Environment.");
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        let r;
        try {
          r = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 1000 }
            })
          });
        } finally { clearTimeout(timeout); }
        const data = await r.json().catch(() => ({}));
        if(!r.ok) {
          const detail = data.error && data.error.message ? data.error.message : "Gemini API request failed";
          throw new Error("Gemini (" + r.status + "): " + detail);
        }
        const answer = (data.candidates || []).flatMap(c => c.content && c.content.parts || []).map(p => p.text || "").join("").trim();
        if(!answer) throw new Error("Gemini returned no text. Check the model and API quota in Google AI Studio.");
        return send(res, 200, { answer, provider: "Gemini", model: GEMINI_MODEL });
      }catch(e){ send(res, 500, { error: e.message }); }
    });
    return;
  }

  // 2. Everything else: serve the app files from this folder
  const name = req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(__dirname, name);
  if(!file.startsWith(__dirname) || name.includes("server.js")){ res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "text/plain" });
    res.end(data);
  });
 }).listen(process.env.PORT || 3000, () => console.log("ExamSaathi server started on port " + (process.env.PORT || 3000) +
  (GEMINI_API_KEY ? "  (Gemini AI enabled: " + GEMINI_MODEL + ")" : "  (no Gemini key set: Ask AI will use notes only)") +
  (TEACHER_PASSWORD ? "  (teacher uploads enabled)" : "  (set TEACHER_PASSWORD to enable teacher uploads)")));
