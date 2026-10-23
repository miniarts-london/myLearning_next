// A stand-in for the Claude API, so the assistant's tests run without a key or any cost.
// It speaks the real streaming format (server-sent events), so the real Anthropic SDK and the
// real agent loop are what's tested. Its "thinking" is a script keyed on words in the message:
//
//   "week" / "due"        → get_upcoming_deadlines, then lists them with links
//   "doing" / "progress"  → list_my_courses, then get_course_overview (two rounds), then sums up
//   "course say"          → search_course_content (the current course, the learner's words), then answers
//   "loop"                → keeps asking for tools until the app's step limit stops it
//   anything else         → answers straight away, no tools
//
// GET /__last shows the last request (system prompt, tools, messages) for tests to check.
import http from 'node:http';

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 8101);
let last = null;
let requests = 0;

function send(res, blocks, stopReason) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  event('message_start', { message: { id: `msg_${requests}`, type: 'message', role: 'assistant', model: 'mock', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      event('content_block_start', { index, content_block: { type: 'text', text: '' } });
      // Streamed in a few pieces, like the real thing.
      for (const piece of block.text.match(/[\s\S]{1,40}/g) ?? []) event('content_block_delta', { index, delta: { type: 'text_delta', text: piece } });
    } else {
      event('content_block_start', { index, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } });
      event('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
    }
    event('content_block_stop', { index });
  });
  event('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 20 } });
  event('message_stop', {});
  res.end();
}

const tool = (name, input = {}) => ({ type: 'tool_use', id: `toolu_${name}_${requests}`, name, input });
const text = (t) => ({ type: 'text', text: t });

function think(body) {
  const msgs = body.messages;
  // The learner's latest message, and the tool results since then.
  const userIndex = msgs.findLastIndex((m) => m.role === 'user' && typeof m.content === 'string');
  const question = msgs[userIndex].content.toLowerCase();
  const results = msgs.slice(userIndex + 1).filter((m) => m.role === 'user').flatMap((m) => m.content)
    .filter((b) => b.type === 'tool_result').map((b) => ({ ...b, data: b.is_error ? null : JSON.parse(b.content) }));
  const noTools = body.tool_choice?.type === 'none';
  const course = body.system.match(/course with id (\d+)/)?.[1];

  if (question.includes('loop')) {
    return noTools ? [[text('I looked as far as I could. Here is what I found.')], 'end_turn'] : [[tool('list_my_courses')], 'tool_use'];
  }
  if (question.includes('week') || question.includes('due')) {
    if (results.length === 0) return [[text('Let me check your deadlines.'), tool('get_upcoming_deadlines')], 'tool_use'];
    const items = results[0].data;
    return [[text(`Here's what's coming up:\n${items.map((i) => `- [${i.activity}](${i.link}): ${i.what.toLowerCase()} ${i.when}${i.group === 'Overdue' ? ' (overdue)' : ''}`).join('\n')}\n\nStart with the **overdue** one.`)], 'end_turn'];
  }
  if (question.includes('doing') || question.includes('progress')) {
    if (results.length === 0) return [[tool('list_my_courses')], 'tool_use'];
    if (results.length === 1) return [[tool('get_course_overview', { course_id: results[0].data[0].course_id })], 'tool_use'];
    const overview = results[1].data;
    const todo = overview.sections.flatMap((s) => s.activities).filter((a) => a.status === 'to do');
    return [[text(`In [${overview.course}](${overview.link}) you've done ${overview.progress}. Next up: [${todo[0].name}](${todo[0].link}).`)], 'end_turn'];
  }
  if (question.includes('course say')) {
    if (results.length === 0) return [[tool('search_course_content', { course_id: Number(course ?? 2), query: question })], 'tool_use'];
    const found = results[0].data?.results ?? [];
    if (found.length === 0) return [[text("This course doesn't seem to cover that. You could ask your teacher.")], 'end_turn'];
    return [[text(`According to [${found[0].from}](${found[0].link}): ${found[0].text.split('\n').slice(1).join(' ').slice(0, 100)}`)], 'end_turn'];
  }
  if (question.includes('evil link')) {
    return [[text('Read [this](https://evil.example/phish) and [the course](/courses/2).')], 'end_turn'];
  }
  return [[text('I can help with your courses, deadlines and progress.')], 'end_turn'];
}

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (req.url === '/__last') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ last, requests })); }
    if (req.url === '/__reset') { last = null; requests = 0; res.writeHead(200); return res.end('{}'); }
    if (!req.url?.startsWith('/v1/messages') || !(req.headers['x-api-key'] || req.headers.authorization)) { res.writeHead(401); return res.end('{}'); }
    const body = JSON.parse(raw);
    requests += 1;
    last = body;
    const [blocks, stop] = think(body);
    send(res, blocks, stop);
  });
}).listen(PORT, () => console.log(`Mock Claude API on http://localhost:${PORT}`));
