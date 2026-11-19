import { createHash, randomBytes } from "node:crypto";
import { supaDelete, supaInsert, supaSelectOne, supaUpdate } from "./supa";
import { sendMail, verificationEmailHtml } from "./mail";

/**
 * E-mail verification tokens — the signup confirmation flow. Only the
 * sha256 hash of a token is stored; the raw token rides the e-mail link
 * and is never logged (the dev sandbox's outbox path is the one
 * exception — that is its purpose).
 */

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Normalize to the three site locales (anything else falls back to az). */
export function normLocale(raw: string | null | undefined): "az" | "en" | "ru" {
  return raw === "en" || raw === "ru" ? raw : "az";
}

/**
 * Mint a fresh verification token for the user and send the e-mail.
 * Deletes the user's previous tokens first, so exactly one live token
 * exists at a time. `origin` is the public origin the link must point
 * back at (the caller reads it from the request headers).
 */
export async function createVerification(
  userId: string,
  email: string,
  locale: string,
  origin: string,
): Promise<{ token: string; devLink: string | null }> {
  const loc = normLocale(locale);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);

  await supaDelete("email_verifications", [["user_id", `eq.${userId}`]]);
  await supaInsert("email_verifications", {
    user_id: userId,
    email,
    token_hash: tokenHash,
    locale: loc,
    expires_at: new Date(Date.now() + VERIFICATION_TTL_MS).toISOString(),
    consumed_at: null,
  });

  const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}&locale=${loc}`;
  const { subject, html } = verificationEmailHtml(loc, link);
  const mail = await sendMail({ to: email, subject, html, kind: "email_verification" });

  return {
    token,
    // Dev sandbox: no SMTP, so surface the link on screen instead.
    devLink: !mail.sent && process.env.NODE_ENV !== "production" ? link : null,
  };
}

export type ConsumeResult =
  | { status: "ok"; userId: string; email: string; locale: string }
  | { status: "expired"; email: string }
  | "invalid";

/**
 * Redeem a verification token: missing or already used → "invalid",
 * past its 24h window → "expired" (with the row's e-mail so the verify
 * page can prefill the resend form), otherwise the row is marked
 * consumed and returned.
 */
export async function consumeVerification(token: string): Promise<ConsumeResult> {
  let row: Record<string, unknown> | null;
  try {
    row = await supaSelectOne("email_verifications", [
      ["token_hash", `eq.${sha256Hex(token)}`],
    ]);
  } catch {
    return "invalid";
  }
  if (!row) return "invalid";

  const userId = typeof row.user_id === "string" ? row.user_id : "";
  const email = typeof row.email === "string" ? row.email : "";
  if (row.consumed_at) return "invalid";
  if (!userId || !email) return "invalid";

  const expiresAt = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { status: "expired", email };
  }

  await supaUpdate(
    "email_verifications",
    [["token_hash", `eq.${sha256Hex(token)}`]],
    { consumed_at: new Date().toISOString() },
  );
  return { status: "ok", userId, email, locale: normLocale(typeof row.locale === "string" ? row.locale : "az") };
}
