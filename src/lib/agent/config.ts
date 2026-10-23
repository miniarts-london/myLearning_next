// The assistant shows only when a Claude API key is set for the Next.js app (ANTHROPIC_API_KEY).
export const assistantConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
