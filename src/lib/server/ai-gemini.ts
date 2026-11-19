/**
 * The Gemini client — generateContent with system instructions, optional
 * function-calling tools and optional JSON mode. Provider details live in
 * the ai_settings table (key + model; default gemini-flash-lite-latest).
 *
 * The sandbox's egress region is not supported by Google's API, so callers
 * (lib/server/ai.ts) chain a fallback provider behind this module — in
 * production (Render) the Gemini calls succeed directly.
 */

export type GeminiFunctionDecl = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type GeminiFunctionCall = { name: string; args: Record<string, unknown> };

export type GeminiPart =
  | { text: string }
  | { functionCall: GeminiFunctionCall }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiOut = {
  text: string;
  functionCalls: GeminiFunctionCall[];
};

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function geminiGenerate(opts: {
  apiKey: string;
  model: string;
  system?: string;
  contents: GeminiContent[];
  tools?: GeminiFunctionDecl[];
  jsonMode?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<GeminiOut> {
  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      temperature: 0.7,
      ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.tools?.length) body.tools = [{ functionDeclarations: opts.tools }];

  const res = await fetch(`${API_ROOT}/${opts.model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  let json: {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("gemini: unparseable response");
  }
  if (json.promptFeedback?.blockReason) {
    throw new Error(`gemini blocked: ${json.promptFeedback.blockReason}`);
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  let out = "";
  const functionCalls: GeminiFunctionCall[] = [];
  for (const p of parts) {
    if ("text" in p) {
      out += p.text;
    } else if ("functionCall" in p && p.functionCall?.name) {
      functionCalls.push({
        name: p.functionCall.name,
        args: (p.functionCall.args ?? {}) as Record<string, unknown>,
      });
    }
  }
  return { text: out.trim(), functionCalls };
}

/** Merge consecutive same-role contents (Gemini wants user/model to
 *  alternate) and map the chat history onto Gemini contents. */
export function toGeminiContents(
  history: { role: "user" | "assistant"; content: string }[],
): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of history) {
    const role = m.role === "user" ? "user" as const : "model" as const;
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else out.push({ role, parts: [{ text: m.content }] });
  }
  // must start with a user turn
  while (out.length > 0 && out[0]!.role !== "user") out.shift();
  return out;
}
