// Optional, replaceable LLM layer. Server-side only. To use another provider, change only
// this file. With no ANTHROPIC_API_KEY the engine works fully on retrieval + templates.
export type LlmResult = { used: boolean; text?: string; reason?: string };

function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const { type, text } = block as { type?: unknown; text?: unknown };
      if (type === "text" && typeof text === "string") return text;
    }
  }
  return null;
}

export async function narrate(system: string, user: string): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { used: false, reason: "No LLM key is configured, so the deterministic retrieval baseline is shown." };
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return { used: false, reason: `The LLM provider returned status ${response.status}; showing the baseline instead.` };
    }
    const text = extractText(await response.json());
    if (!text || !text.trim()) return { used: false, reason: "The LLM returned no usable text; showing the baseline instead." };
    return { used: true, text: text.trim().slice(0, 1500) };
  } catch {
    return { used: false, reason: "The LLM request failed or timed out; showing the baseline instead." };
  }
}
