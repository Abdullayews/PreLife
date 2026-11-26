/**
 * Data consents — the per-scope explicit-consent client for the
 * health-adjacent features (mood / journal / quiz / ai). Server-side the
 * endpoints refuse with 403 consent_required_<scope> until the scope is
 * granted; this client drives the Settings toggles and the feature gates.
 */

import { apiUrl } from "@/lib/api-url";

export type DataScope = "mood" | "journal" | "quiz" | "ai";

export type ConsentMap = Record<DataScope, boolean>;

/** Read the consent map. Null when signed out or the request fails —
 *  callers treat null as "not granted" (fail closed). */
export async function fetchConsents(): Promise<ConsentMap | null> {
  try {
    const res = await fetch(apiUrl("/api/me/consents"), { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { consents?: Partial<ConsentMap> };
    if (!body.consents) return null;
    return {
      mood: body.consents.mood === true,
      journal: body.consents.journal === true,
      quiz: body.consents.quiz === true,
      ai: body.consents.ai === true,
    };
  } catch {
    return null;
  }
}

/** Grant or withdraw one scope. Null when the request fails. */
export async function setConsent(scope: DataScope, granted: boolean): Promise<ConsentMap | null> {
  try {
    const res = await fetch(apiUrl("/api/me/consents"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, granted }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { consents?: Partial<ConsentMap> };
    if (!body.consents) return null;
    return {
      mood: body.consents.mood === true,
      journal: body.consents.journal === true,
      quiz: body.consents.quiz === true,
      ai: body.consents.ai === true,
    };
  } catch {
    return null;
  }
}
