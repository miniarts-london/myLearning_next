// What the assistant streams to the browser, one JSON object per line.
export type AgentEvent =
  | { type: 'step'; id: string; label: string; status: 'running' | 'done' | 'error' } // A tool call
  | { type: 'text'; text: string }                                                    // Part of the answer
  | { type: 'error'; message: string }
  | { type: 'done'; remaining: number };                                              // Questions left today

// A message in the conversation, as the browser sends it back for follow-up questions.
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
