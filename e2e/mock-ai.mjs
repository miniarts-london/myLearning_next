// A stand-in for the Python "Ask this course" service (ai-service/), so the browser tests run
// without Python or a Claude API key. It follows the same API; the Python service has its own
// tests (ai-service/tests) for the real retrieval and answering.
//
// GET /__last shows what the app last sent, so tests can check what was indexed and allowed.
import http from 'node:http';

const PORT = Number(process.env.MOCK_AI_PORT ?? 8100);
const TOKEN = process.env.MOCK_AI_TOKEN ?? 'e2e-ai-token';
let courses = new Map(); // course id → documents
let last = {};

// Common words don't count as a match (the real service matches by meaning instead).
const FILLER = new Set(['what', 'does', 'this', 'course', 'about', 'tell', 'that', 'with', 'have', 'from', 'your', 'when', 'where', 'which', 'there']);
const words = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !FILLER.has(w)));
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    const url = req.url ?? '';
    if (url === '/__reset') { courses = new Map(); last = {}; return json(200, { ok: true }); }
    if (url === '/__last') return json(200, last);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { detail: 'Unauthorised' });

    const match = url.match(/^\/courses\/(\d+)\/(index|documents|ask|search)$/);
    if (!match) return json(404, { detail: 'Not found' });
    const [, id, action] = match;

    if (action === 'index') {
      const docs = courses.get(id) ?? [];
      return json(200, { indexed: docs.length > 0, cmids: [...new Set(docs.map((d) => d.cmid))], indexed_at: docs.length ? Math.floor(Date.now() / 1000) : null, chunks: docs.length });
    }
    if (action === 'documents') {
      const { documents } = JSON.parse(body);
      courses.set(id, documents);
      last.documents = documents;
      return json(200, { chunks: documents.length });
    }
    if (action === 'search') {
      const { query, allowed_cmids } = JSON.parse(body);
      last.search = { query, allowed_cmids };
      const q = words(query);
      const results = (courses.get(id) ?? [])
        .filter((d) => allowed_cmids.includes(d.cmid))
        .map((d) => ({ d, score: [...words(`${d.title} ${strip(d.html)}`)].filter((w) => q.has(w) && w.length > 3).length }))
        .filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
        .map(({ d }) => ({ cmid: d.cmid, title: d.title, section: d.section, href: d.href, text: `${d.title}\n${strip(d.html)}`, similarity: 0.6 }));
      return json(200, { results });
    }
    // ask
    const { question, user_id, allowed_cmids } = JSON.parse(body);
    last.ask = { question, user_id, allowed_cmids };
    if (question.includes('too many')) return json(429, { detail: "You've asked 20 questions today. Try again tomorrow." });

    const q = words(question);
    const hits = (courses.get(id) ?? [])
      .filter((d) => allowed_cmids.includes(d.cmid))
      .map((d) => ({ d, score: [...words(`${d.title} ${strip(d.html)}`)].filter((w) => q.has(w) && w.length > 3).length }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    const line = (e) => res.write(JSON.stringify(e) + '\n');
    line({ type: 'sources', sources: hits.map((h, i) => ({ n: i + 1, cmid: h.d.cmid, title: h.d.title, href: h.d.href })), remaining: 19 });
    if (hits.length === 0) {
      line({ type: 'text', text: "I couldn't find anything about that in this course. Try asking in a different way, or ask your teacher." });
    } else {
      // Streamed in pieces, like the real service.
      for (const piece of ['According to the course, ', strip(hits[0].d.html).slice(0, 120), ' [1]']) line({ type: 'text', text: piece });
    }
    line({ type: 'done' });
    res.end();
  });
}).listen(PORT, () => console.log(`Mock AI service on http://localhost:${PORT}`));
