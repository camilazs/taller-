// Server configuration only. Never import into a client component.
export function getVisionConfig() {
  const provider = process.env.AI_PROVIDER || "openai";
  return {
    provider,
    key:
      provider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY
        : process.env.AI_API_KEY,
    model:
      process.env.AI_MODEL ||
      (provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini"),
    baseUrl:
      process.env.AI_BASE_URL ||
      (provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : "https://api.openai.com/v1"),
  };
}
