import { createHash, randomBytes } from "node:crypto";
import { authAdminDeleteUser, supaDelete, supaInsert, supaSelectOne, supaUpdate } from "./supa";
import { sendMail, verificationEmailHtml } from "./mail";

/**
 * E-mail verification tokens — the signup confirmation flow. Only the
 * sha256 hash of a token is stored; the raw token rides the e-mail link
 * and is never logged (the dev sandbox's outbox path is the one
 * exception — that is its purpose).
 *
 * v4.3: the window is ONE WEEK (the first e-mail states it). A pending
 * registration that is not confirmed within the window is cancelled:
 * whoever touches it first (login attempt, verification click, signup
 * retry) purges the auth user — email_verifications cascade via FK.
 */

const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

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
  | { status: "expired"; userId: string; email: string }
  | "invalid";

/**
 * Redeem a verification token: missing or already used → "invalid",
 * past its 1-week window → "expired" (with the row's user id + e-mail
 * so the caller can purge the cancelled registration and prefill the
 * signup form), otherwise the row is marked consumed and returned.
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
    return { status: "expired", userId, email };
  }

  await supaUpdate(
    "email_verifications",
    [["token_hash", `eq.${sha256Hex(token)}`]],
    { consumed_at: new Date().toISOString() },
  );
  return { status: "ok", userId, email, locale: normLocale(typeof row.locale === "string" ? row.locale : "az") };
}

/* ── v4.3 pending-registration helpers ─────────────────────────────────── */

/** The latest unconsumed verification row of a user (any expiry — the
 * caller decides whether it has lapsed). Exactly one live token exists
 * per user at a time (createVerification rotates). */
export async function pendingVerificationForUser(
  userId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await supaSelectOne("email_verifications", [
      ["user_id", `eq.${userId}`],
      ["consumed_at", "is.null"],
      ["order", "created_at.desc"],
    ]);
  } catch {
    return null;
  }
}

/** True when the verification row is missing or past its 1-week window. */
export function verificationExpired(row: Record<string, unknown> | null): boolean {
  if (!row) return true;
  const t = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
  return !Number.isFinite(t) || t <= Date.now();
}

/** Cancel a registration that was never confirmed in its 1-week window:
 * delete the auth user (the FK cascades profiles / sessions / tokens).
 * The explicit token delete is a safety net for databases without the FK. */
export async function purgeRegistration(userId: string): Promise<void> {
  try {
    await supaDelete("email_verifications", [["user_id", `eq.${userId}`]]);
  } catch {
    /* the FK cascade will get it */
  }
  try {
    await authAdminDeleteUser(userId);
  } catch (e) {
    console.error("[verification:purge]", e);
  }
}
