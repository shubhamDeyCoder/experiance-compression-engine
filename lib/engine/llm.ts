// Optional, replaceable LLM layer. Server-side only. To use another provider, change only
// this file. With no ANTHROPIC_API_KEY the engine works fully on retrieval + templates.
export type LlmResult = { used: boolean; text?: string; reason?: string };

export type LlmJsonResult = Record<string, unknown>;

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

export async function createEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 12000),
      ...(model.startsWith("text-embedding-3-") ? { dimensions: 1536 } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Embedding provider returned status ${response.status}.`);
  }
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("Embedding provider returned an invalid response.");
  }
  const first = payload.data[0];
  if (typeof first !== "object" || first === null || !("embedding" in first) || !Array.isArray(first.embedding)) {
    throw new Error("Embedding provider returned no vector.");
  }
  const embedding = first.embedding.filter(
    (value: unknown): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (embedding.length !== 1536 || embedding.length !== first.embedding.length) {
    throw new Error("Embedding provider returned a vector with an unexpected shape.");
  }
  return embedding;
}

export async function generateJson(system: string, user: string): Promise<LlmJsonResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Scenario generation requires ANTHROPIC_API_KEY.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Language model provider returned status ${response.status}.`);
  }

  const text = extractText(await response.json());
  if (!text) throw new Error("Language model provider returned no usable text.");
  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Language model returned invalid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Language model returned an unexpected JSON shape.");
  }
  return parsed as LlmJsonResult;
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
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929",
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
