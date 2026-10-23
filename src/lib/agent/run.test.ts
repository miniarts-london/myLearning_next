import { describe, expect, it, vi } from 'vitest';
import { runAgent, ToolUserError, type AgentTool } from './run';
import { intArg } from './args';
import type { AgentEvent } from './types';

// The agent loop with a fake Claude: each call returns the next scripted message.
function fakeClient(script: { content: unknown[]; stop_reason: string }[]) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    messages: {
      stream: (body: Record<string, unknown>) => {
        calls.push(structuredClone(body));
        const message = script[Math.min(calls.length - 1, script.length - 1)];
        const handlers: ((t: string) => void)[] = [];
        return {
          on: (_e: string, h: (t: string) => void) => { handlers.push(h); },
          finalMessage: async () => {
            message.content.filter((b) => (b as { type: string }).type === 'text').forEach((b) => handlers.forEach((h) => h((b as { text: string }).text)));
            return message;
          },
        };
      },
    },
  };
}

const echo: AgentTool<null> = {
  name: 'echo', description: 'Echo', input_schema: { type: 'object', properties: {} }, kind: 'read',
  label: () => 'Echoing', run: async (input) => ({ got: intArg(input, 'n') }),
};

const toolUse = (input: object) => ({ content: [{ type: 'tool_use', id: 't1', name: 'echo', input }], stop_reason: 'tool_use' });
const answer = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });

async function run(script: Parameters<typeof fakeClient>[0], tools = [echo], maxSteps?: number) {
  const client = fakeClient(script);
  const events: AgentEvent[] = [];
  await runAgent({ client: client as never, model: 'm', system: 's', messages: [{ role: 'user', content: 'hi' }], tools, ctx: null, emit: (e) => events.push(e), maxSteps });
  return { client, events };
}

describe('runAgent', () => {
  it('runs a tool, sends the result back, then streams the answer', async () => {
    const { client, events } = await run([toolUse({ n: 7 }), answer('Done')]);
    expect(events).toEqual([
      { type: 'step', id: 't1', label: 'Echoing', status: 'running' },
      { type: 'step', id: 't1', label: 'Echoing', status: 'done' },
      { type: 'text', text: 'Done' },
    ]);
    const second = client.calls[1].messages as { content: unknown }[];
    expect(second.at(-1)?.content).toEqual([{ type: 'tool_result', tool_use_id: 't1', content: '{"got":7}' }]);
  });

  it('tells Claude about bad input instead of crashing', async () => {
    const { client, events } = await run([toolUse({ n: 'seven' }), answer('Sorry')]);
    expect(events[1]).toMatchObject({ status: 'error' });
    const result = (client.calls[1].messages as { content: { is_error: boolean; content: string }[] }[]).at(-1)!.content[0];
    expect(result).toMatchObject({ is_error: true, content: '"n" must be a whole number.' });
  });

  it('passes on access problems in words, and hides other errors', async () => {
    const denied: AgentTool<null> = { ...echo, run: async () => { throw new ToolUserError('Not enrolled.'); } };
    const broken: AgentTool<null> = { ...echo, run: async () => { throw new Error('secret stack trace'); } };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = await run([toolUse({}), answer('ok')], [denied]);
    const b = await run([toolUse({}), answer('ok')], [broken]);
    const content = (c: ReturnType<typeof fakeClient>) => (c.calls[1].messages as { content: { content: string }[] }[]).at(-1)!.content[0].content;
    expect(content(a.client)).toBe('Not enrolled.');
    expect(content(b.client)).toBe('That lookup failed.');
  });

  it('stops after the step limit and forces an answer', async () => {
    const { client } = await run([toolUse({ n: 1 })], [echo], 2);
    expect(client.calls).toHaveLength(3);
    expect(client.calls.map((c) => (c.tool_choice as { type: string }).type)).toEqual(['auto', 'auto', 'none']);
  });

  it('refuses action tools until confirmation exists', async () => {
    const action: AgentTool<null> = { ...echo, name: 'mark_done', kind: 'action' };
    await expect(run([answer('x')], [action])).rejects.toThrow(/confirmation step/);
  });
});
