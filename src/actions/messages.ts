'use server';

import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { conversationName, toChatMessage, toSummary } from '@/lib/messaging.server';
import { MESSAGE_TEXT_MAX, type ChatMessage, type ConversationSummary, type ConversationView } from '@/lib/messaging';

// The Messages panel's calls. Each one runs as the logged-in user, with their own Moodle token,
// so Moodle decides what they may read and who they may write to.

export async function unreadCount(): Promise<number> {
  const session = await verifySession();
  try {
    return await moodle.unreadConversations(session.token, session.userid);
  } catch (e) {
    if (e instanceof MoodleError) return 0; // Messaging switched off: just no badge
    throw e;
  }
}

export async function listConversations(): Promise<{ conversations: ConversationSummary[]; error?: string }> {
  const session = await verifySession();
  try {
    const conversations = await moodle.conversations(session.token, session.userid);
    return { conversations: conversations.map((c) => toSummary(c, session.userid)) };
  } catch (e) {
    if (e instanceof MoodleError) return { conversations: [], error: "Your messages couldn't be loaded from Moodle." };
    throw e;
  }
}

// Opens a conversation: its messages, oldest first, and marks it read.
export async function openConversation(id: number, markRead = true): Promise<{ conversation?: ConversationView; error?: string }> {
  const session = await verifySession();
  if (!Number.isInteger(id)) return { error: 'Conversation not found.' };
  try {
    const data = await moodle.conversationMessages(session.token, session.userid, id);
    if (markRead) {
      await moodle.markConversationRead(session.token, session.userid, id).catch(() => null);
    }
    const all = await moodle.conversations(session.token, session.userid).catch(() => []);
    const type = all.find((c) => c.id === id)?.type ?? 1;
    return {
      conversation: {
        id,
        name: conversationName({ type, members: data.members, name: all.find((c) => c.id === id)?.name }, session.userid),
        messages: [...data.messages].reverse().map((m) => toChatMessage(m, session.userid, data.members)),
      },
    };
  } catch (e) {
    if (e instanceof MoodleError) return { error: "This conversation couldn't be loaded." };
    throw e;
  }
}

export async function sendToConversation(id: number, text: string): Promise<{ message?: ChatMessage; error?: string }> {
  const session = await verifySession();
  const clean = String(text ?? '').trim().slice(0, MESSAGE_TEXT_MAX);
  if (!clean) return { error: 'Write a message first.' };
  if (!Number.isInteger(id)) return { error: 'Conversation not found.' };
  try {
    const sent = await moodle.sendToConversation(session.token, id, clean);
    return { message: toChatMessage(sent, session.userid, []) };
  } catch (e) {
    if (e instanceof MoodleError) return { error: `Your message couldn't be sent: ${e.message}` };
    throw e;
  }
}
