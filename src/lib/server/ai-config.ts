import { supaSelectOne } from "./supa";
import { ttlGet, ttlPut } from "./ttl";
import { PROMPT_ASSISTANT, PROMPT_CONTEXT, PROMPT_PLAN, PROMPT_PSYCH } from "./ai-prompts";

/**
 * AI configuration — the ai_settings / ai_prompts tables (v3.3) with the
 * code constants as fallback. Both reads are TTL-cached for 60s; the
 * GEMINI_API_KEY env var (set on Render) takes precedence over the stored
 * key, so rotating the key never needs a deploy.
 */

export type AiSettings = {
  apiKey: string;
  model: string;
  active: boolean;
};

const FALLBACK_PROMPTS: Record<string, string> = {
  assistant: PROMPT_ASSISTANT,
  psych: PROMPT_PSYCH,
  plan: PROMPT_PLAN,
  context: PROMPT_CONTEXT,
};

export async function getAiSettings(): Promise<AiSettings | null> {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  const envModel = process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";
  if (envKey) return { apiKey: envKey, model: envModel, active: true };

  const cached = await ttlGet<AiSettings | null>("ai:settings");
  if (cached !== null) return cached.active ? cached : null;
  try {
    const row = await supaSelectOne("ai_settings", [
      ["select", "api_key,model,is_active"],
      ["provider", "eq.gemini"],
    ]);
    const out: AiSettings = row
      ? {
        apiKey: typeof row.api_key === "string" ? row.api_key : "",
        model: typeof row.model === "string" && row.model ? row.model : envModel,
        active: row.is_active !== false && typeof row.api_key === "string" && row.api_key.length > 0,
      }
      : { apiKey: "", model: envModel, active: false };
    ttlPut("ai:settings", out);
    return out.active ? out : null;
  } catch {
    return null; // DB unreachable — no stored key, no env key
  }
}

export async function getAiPrompt(key: string): Promise<string> {
  const cacheKey = `ai:prompt:${key}`;
  const cached = await ttlGet<string>(cacheKey);
  if (cached) return cached;
  try {
    const row = await supaSelectOne("ai_prompts", [
      ["select", "content"],
      ["key", `eq.${key}`],
    ]);
    const content = row && typeof row.content === "string" && row.content.trim()
      ? row.content
      : FALLBACK_PROMPTS[key] ?? "";
    if (content) ttlPut(cacheKey, content);
    return content;
  } catch {
    return FALLBACK_PROMPTS[key] ?? "";
  }
}
