import { apiUrl } from "./api-url";

/**
 * Account-tier preference persistence (v3.2): the signed-in user's
 * language and dark/light choice are saved to their profiles row via
 * PATCH /api/me/preferences, so the choices follow the account across
 * devices — instead of living only in the browser's cookie/localStorage
 * tiers (see lib/consent.ts for the guest tiers).
 *
 * Fire-and-forget: the local tier applies instantly, this mirrors the
 * choice to the database in the background. Silently no-ops for guests
 * (the API answers 401) and offline.
 */
export function saveUserPref(patch: { locale?: string; theme?: "light" | "dark" }): void {
  void fetch(apiUrl("/api/me/preferences"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {
    /* offline — local tiers keep working */
  });
}
