// Messages between users (Moodle messaging), as the app shows them. Shared by the server actions
// and the browser, so no server code here.

export const MESSAGE_TEXT_MAX = 4000;

export interface ConversationSummary {
  id: number;
  name: string;          // The other person, the group's name, or "Personal space"
  unread: number;
  lastText: string;      // Plain text of the latest message ('' when none)
  lastFromMe: boolean;
  lastTime: number;      // Unix seconds, 0 when none
  online: boolean;
}

export interface ChatMessage {
  id: number;
  fromMe: boolean;
  sender: string;
  text: string;          // Plain text
  time: number;          // Unix seconds
}

export interface ConversationView {
  id: number;
  name: string;
  messages: ChatMessage[]; // Oldest first, ready to show top to bottom
}

// "14:05" today, "Yesterday", "Mon", or "12 Oct" — short labels for the list and the chat.
export function messageTime(time: number, now: number): string {
  const date = new Date(time * 1000);
  const today = new Date(now * 1000);
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
