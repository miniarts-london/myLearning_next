import type Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { ToolInputError } from './args';
import type { AgentEvent } from './types';

// The agent loop: Claude reads the conversation and either answers or asks for tools; we run the
// tools and send back their results; repeat until it answers (or the step limit is reached).
// Kept free of Moodle and Next.js so it can be unit-tested with a fake client and fake tools.

export interface AgentTool<Ctx> {
  name: string;
  description: string;
  input_schema: Tool['input_schema'];
  // 'read' tools only look things up. 'action' tools change things (mark as done, save a draft…):
  // they'll need the learner to confirm first, which isn't built yet, so the loop refuses them.
  kind: 'read' | 'action';
  label: (input: Record<string, unknown>) => string; // Shown while it runs: "Checking your deadlines"
  run: (input: Record<string, unknown>, ctx: Ctx) => Promise<unknown>;
}

export interface RunOptions<Ctx> {
  client: Pick<Anthropic, 'messages'>;
  model: string;
  system: string;
  messages: MessageParam[];
  tools: AgentTool<Ctx>[];
  ctx: Ctx;
  emit: (event: AgentEvent) => void;
  maxSteps?: number;
  signal?: AbortSignal;
}

export const MAX_STEPS = 6;

export async function runAgent<Ctx>({ client, model, system, messages, tools, ctx, emit, maxSteps = MAX_STEPS, signal }: RunOptions<Ctx>) {
  const actions = tools.filter((t) => t.kind === 'action');
  if (actions.length > 0) {
    throw new Error(`Action tools need a confirmation step first: ${actions.map((t) => t.name).join(', ')}`);
  }
  const byName = new Map(tools.map((t) => [t.name, t]));
  const toolDefs: Tool[] = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const history = [...messages];

  for (let step = 0; step <= maxSteps; step++) {
    // On the last round, no more tools: Claude must answer with what it has.
    const lastRound = step === maxSteps;
    const stream = client.messages.stream({
      model,
      max_tokens: 1200,
      system,
      tools: toolDefs,
      tool_choice: lastRound ? { type: 'none' } : { type: 'auto' },
      messages: history,
    }, { signal });
    stream.on('text', (text) => emit({ type: 'text', text }));
    const message = await stream.finalMessage();
    history.push({ role: 'assistant', content: message.content });

    const calls = message.content.filter((b) => b.type === 'tool_use');
    if (message.stop_reason !== 'tool_use' || calls.length === 0) {
      return history;
    }

    // Run this round's tools at the same time; each result (or error) goes back to Claude.
    const results = await Promise.all(calls.map(async (call): Promise<ToolResultBlockParam> => {
      const tool = byName.get(call.name);
      const input = (call.input ?? {}) as Record<string, unknown>;
      const id = call.id;
      if (!tool) {
        return { type: 'tool_result', tool_use_id: id, is_error: true, content: `There's no tool called ${call.name}.` };
      }
      emit({ type: 'step', id, label: tool.label(input), status: 'running' });
      try {
        const result = await tool.run(input, ctx);
        emit({ type: 'step', id, label: tool.label(input), status: 'done' });
        return { type: 'tool_result', tool_use_id: id, content: JSON.stringify(result) };
      } catch (e) {
        emit({ type: 'step', id, label: tool.label(input), status: 'error' });
        // Problems with the input or with access are explained to Claude so it can try again or
        // tell the learner; anything else is logged and summarised.
        const message = e instanceof ToolInputError || e instanceof ToolUserError ? e.message : 'That lookup failed.';
        if (!(e instanceof ToolInputError || e instanceof ToolUserError)) console.error(`Tool ${call.name} failed`, e);
        return { type: 'tool_result', tool_use_id: id, is_error: true, content: message };
      }
    }));
    history.push({ role: 'user', content: results });
  }
  return history;
}

// A tool problem worth telling Claude about in words ("you aren't enrolled in that course").
export class ToolUserError extends Error {}
