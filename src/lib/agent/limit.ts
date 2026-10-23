// Messages per learner per day for the assistant (each can mean several Claude calls).
// In memory: fine for one server process. With several, keep counts in shared storage (e.g. Redis).
const counts = new Map<string, number>();

export const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT ?? 30);

const key = (userid: number) => `${userid}:${new Date().toISOString().slice(0, 10)}`;

export function takeMessage(userid: number): boolean {
  const k = key(userid);
  const used = counts.get(k) ?? 0;
  if (used >= DAILY_LIMIT) return false;
  counts.set(k, used + 1);
  return true;
}

export function remainingMessages(userid: number): number {
  return Math.max(0, DAILY_LIMIT - (counts.get(key(userid)) ?? 0));
}
