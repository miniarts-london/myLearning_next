import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { readSession } from '@/lib/session';
import { runAgent } from '@/lib/agent/run';
import { assistantTools } from '@/lib/agent/tools';
import { systemPrompt } from '@/lib/agent/prompt';
import { remainingMessages, takeMessage } from '@/lib/agent/limit';
import type { AgentEvent, ChatMessage } from '@/lib/agent/types';
import { assistantConfigured } from '@/lib/agent/config';

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 10; // Earlier messages are dropped, to keep each request small

// POST { messages: [{ role, content }…], path } → a stream of AgentEvent, one JSON object per line.
export async function POST(request: NextRequest) {
  const error = (status: number, message: string) => Response.json({ error: message }, { status });

  if (!assistantConfigured()) return error(503, "The assistant isn't set up on this site.");
  // Only this app's own pages may call this (stops other sites using a learner's session).
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return error(403, 'Not allowed.');
  if (!request.headers.get('content-type')?.includes('application/json')) return error(415, 'Send JSON.');

  const session = await readSession();
  if (!session) return error(401, 'Log in to use the assistant.');

  const body = await request.json().catch(() => null) as { messages?: unknown; path?: unknown } | null;
  const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]).slice(-MAX_HISTORY) : [];
  const valid = messages.length > 0 && messages.at(-1)?.role === 'user' && messages.every((m) =>
    (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() && m.content.length <= MAX_MESSAGE_CHARS);
  if (!valid) return error(400, `Type a message (up to ${MAX_MESSAGE_CHARS} characters).`);
  // The conversation must start with the learner.
  while (messages[0]?.role !== 'user') messages.shift();

  if (!takeMessage(session.userid)) return error(429, "You've reached today's limit for the assistant. Try again tomorrow.");

  // Which course they're looking at, from the page address (e.g. /courses/2/activities/11).
  const courseMatch = typeof body?.path === 'string' ? body.path.match(/^\/courses\/(\d+)/) : null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAgent({
          client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || undefined }),
          model: process.env.ASSISTANT_MODEL ?? 'claude-haiku-5-5',
          system: systemPrompt({ firstname: session.firstname, now: new Date(), currentCourseId: courseMatch ? Number(courseMatch[1]) : null }),
          messages: messages.map((m): MessageParam => ({ role: m.role, content: m.content })),
          tools: assistantTools,
          ctx: { token: session.token, userid: session.userid },
          emit,
          signal: request.signal, // Stop (and stop paying) if the learner closes the page
        });
      } catch (e) {
        if (!request.signal.aborted) {
          console.error('Assistant failed', e);
          emit({ type: 'error', message: 'Sorry, something went wrong. Try again in a moment.' });
        }
      } finally {
        emit({ type: 'done', remaining: remainingMessages(session.userid) });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
