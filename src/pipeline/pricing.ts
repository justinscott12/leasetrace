// USD per 1M tokens, Anthropic first-party API, as of 2026-10 (claude-api skill model table).
// Cache writes use the 5-minute TTL (1.25x input). Cache reads: Opus 5.5 and Sonnet 5.5
// are $0.20; Haiku 5.5's read price wasn't listed, so 0.1x input is assumed — verify.
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Returns null for a model without a known price rather than guessing. */
export function costUsd(model: string, u: TokenUsage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  return (u.input_tokens * p.input + write * p.input * 1.25 + read * p.cacheRead + u.output_tokens * p.output) / 1e6;
}
