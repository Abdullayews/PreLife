import type { Item, Place, Plan } from "./worlds";

/**
 * The library (/library) app — types only. All DATA (collections, books,
 * venues and their details) lives in Supabase Postgres behind the Rust
 * API — see LibraryContent and lib/api.ts → getLibraryContent().
 */

export type BookDetail = {
  id: string;
  /** Author — proper noun, shown as-is in every locale. */
  author: string;
  /** Page count of the standard edition. */
  pages: number;
  /** Suggested daily reading minutes. */
  minutes: number;
  /** Blurb message key (libraryApp.<blurbKey>). */
  blurbKey: string;
};

export type LibVenueDetail = {
  id: string;
  address: string;
  hours: string;
  mapQuery: string;
};

/** A library venue (world_places row) carrying its v3.4 country tag — the
 *  account location preference (az) filters on this; undefined rows
 *  count as AZ. */
export type LibraryPlace = Place & { country?: string | null };

export type LibraryContent = {
  collections: Plan[];
  books: Item[];
  places: LibraryPlace[];
  bookDetails: Record<string, BookDetail>;
  venueDetails: Record<string, LibVenueDetail>;
};
