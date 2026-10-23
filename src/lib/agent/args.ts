// Tool inputs come from the model, so they're checked like any other untrusted input.

export class ToolInputError extends Error {}

export function intArg(input: Record<string, unknown>, name: string): number {
  const value = input[name];
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new ToolInputError(`"${name}" must be a whole number.`);
  }
  return n;
}

export function strArg(input: Record<string, unknown>, name: string, maxLength = 300): string {
  const value = input[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ToolInputError(`"${name}" must be some text.`);
  }
  return value.trim().slice(0, maxLength);
}

// Long course pages are cut so one tool result can't fill the model's context (or the bill).
export function clip(text: string, max = 6000): string {
  return text.length > max ? `${text.slice(0, max)}… [cut: the rest is on the activity page]` : text;
}
