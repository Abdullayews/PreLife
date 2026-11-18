/**
 * The library (/library) app — structure layer, following the worlds.ts
 * convention: typed data and numbers only; every visible string is a
 * message key into messages/*.json (namespace "libraryApp").
 *
 * Collections and book/venue shells come from worlds.library; this file
 * adds the app-side details: authors, page counts, blurbs and venue
 * addresses/hours.
 */

import { worlds } from "./worlds";

export const libraryCollections = worlds.library.plans;
export const libraryBooks = worlds.library.items;
export const libraryPlaces = worlds.library.places;

/* ── Book details ──────────────────────────────────────────────────────── */

export type BookDetail = {
  id: string;
  /** Author — proper noun, shown as-is in every locale. */
  author: string;
  /** Page count of the standard edition. */
  pages: number;
  /** Suggested daily reading minutes. */
  minutes: number;
  /** Blurb message key (libraryApp.blurb.<id>). */
  blurbKey: string;
};

export const BOOK_DETAILS: Record<string, BookDetail> = {
  "deep-work": { id: "deep-work", author: "Cal Newport", pages: 304, minutes: 20, blurbKey: "blurb.deepwork" },
  "atomic-habits": { id: "atomic-habits", author: "James Clear", pages: 320, minutes: 15, blurbKey: "blurb.habits" },
  "search-meaning": { id: "search-meaning", author: "Viktor Frankl", pages: 200, minutes: 15, blurbKey: "blurb.meaning" },
  "thinking-fast": { id: "thinking-fast", author: "Daniel Kahneman", pages: 499, minutes: 25, blurbKey: "blurb.thinking" },
  meditations: { id: "meditations", author: "Marcus Aurelius", pages: 254, minutes: 10, blurbKey: "blurb.meditations" },
  flow: { id: "flow", author: "Mihaly Csikszentmihalyi", pages: 336, minutes: 20, blurbKey: "blurb.flow" },
};

/* ── Venue details ─────────────────────────────────────────────────────── */

export type LibVenueDetail = {
  id: string;
  address: string;
  hours: string;
  mapQuery: string;
};

export const LIB_VENUE_DETAILS: Record<string, LibVenueDetail> = {
  "nizami-house": { id: "nizami-house", address: "İçərişəhər, Kichik Qala 5", hours: "10:00–20:00", mapQuery: "Kitab Evi Bakı" },
  "paper-cup": { id: "paper-cup", address: "Nərimanov, Ə. Rəcəbli 12", hours: "08:00–23:00", mapQuery: "Paper Cup Cafe Bakı" },
  "reading-room": { id: "reading-room", address: "Xətai, Ə. Qayıbov 8", hours: "09:00–21:00", mapQuery: "Reading Room Bakı" },
};
