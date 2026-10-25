import 'server-only';
import sanitizeHtml from 'sanitize-html';
import type { MoodleConversation, MoodleConversationMember, MoodleMessage } from './types';
import type { ChatMessage, ConversationSummary } from './messaging';

// Moodle sends message text as HTML. The app shows it as plain text: no markup from other users
// ever reaches the page. Paragraphs and line breaks become new lines.
export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// What to call a conversation: the other person, the group's name, or your personal space.
export function conversationName(c: { type: number; name?: string; members: MoodleConversationMember[] }, me: number): string {
  if (c.type === 3) return 'Personal space';
  if (c.type === 2) return c.name || 'Group';
  return c.members.find((m) => m.id !== me)?.fullname ?? c.name ?? 'Conversation';
}

export function toSummary(c: MoodleConversation, me: number): ConversationSummary {
  const last = c.messages[0];
  return {
    id: c.id,
    name: conversationName(c, me),
    unread: c.unreadcount ?? (c.isread === false ? 1 : 0),
    lastText: last ? htmlToText(last.text) : '',
    lastFromMe: last?.useridfrom === me,
    lastTime: last?.timecreated ?? 0,
    online: c.type === 1 && Boolean(c.members.find((m) => m.id !== me)?.isonline),
  };
}

export function toChatMessage(m: MoodleMessage, me: number, members: MoodleConversationMember[]): ChatMessage {
  return {
    id: m.id,
    fromMe: m.useridfrom === me,
    sender: m.useridfrom === me ? 'You' : members.find((p) => p.id === m.useridfrom)?.fullname ?? 'Someone',
    text: htmlToText(m.text),
    time: m.timecreated,
  };
}
