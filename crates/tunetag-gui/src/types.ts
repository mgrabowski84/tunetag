/** A file entry from the Rust backend with all tag + audio property data. */
export interface FileEntry {
  id: string;
  path: string;
  filename: string;
  format: string;
  // Standard tags
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: string | null;
  track: string | null;
  disc: string | null;
  genre: string | null;
  comment: string | null;
  // Audio properties
  durationSecs: number | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  channels: number | null;
}

/** Column persistence config matching the Rust struct. */
export interface ColumnConfig {
  columns: ColumnSetting[];
}

export interface ColumnSetting {
  field: string;
  width: number;
  visible: boolean;
}

/** Sort direction for file list columns. */
export type SortDirection = "asc" | "desc";

/** Current sort state. */
export interface SortConfig {
  column: string;
  direction: SortDirection;
}

/** Column definition for the file list table. */
export interface ColumnDef {
  id: string;
  label: string;
  field: keyof FileEntry | "#";
  width: number;
  sortable: boolean;
}

/** All available columns that can be shown in the file list. */
export const ALL_COLUMNS: ColumnDef[] = [
  { id: "filename", label: "Filename", field: "filename", width: 200, sortable: true },
  { id: "title", label: "Title", field: "title", width: 160, sortable: true },
  { id: "artist", label: "Artist", field: "artist", width: 144, sortable: true },
  { id: "album", label: "Album", field: "album", width: 144, sortable: true },
  { id: "albumArtist", label: "Album Artist", field: "albumArtist", width: 144, sortable: true },
  { id: "year", label: "Year", field: "year", width: 56, sortable: true },
  { id: "track", label: "Track", field: "track", width: 56, sortable: true },
  { id: "disc", label: "Disc", field: "disc", width: 56, sortable: true },
  { id: "genre", label: "Genre", field: "genre", width: 80, sortable: true },
  { id: "comment", label: "Comment", field: "comment", width: 120, sortable: true },
  { id: "format", label: "Format", field: "format", width: 64, sortable: true },
  { id: "durationSecs", label: "Duration", field: "durationSecs", width: 72, sortable: true },
  { id: "bitrateKbps", label: "Bitrate", field: "bitrateKbps", width: 72, sortable: true },
  { id: "sampleRateHz", label: "Sample Rate", field: "sampleRateHz", width: 88, sortable: true },
  { id: "channels", label: "Channels", field: "channels", width: 72, sortable: true },
];

/** Default visible columns (by field id). */
export const DEFAULT_VISIBLE_COLUMNS = [
  "filename",
  "title",
  "artist",
  "album",
  "year",
  "track",
  "genre",
  "format",
];

/** Format a duration in seconds to "M:SS" or "H:MM:SS". */
export function formatDuration(secs: number | null): string {
  if (secs == null) return "";
  const totalSecs = Math.round(secs);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format a bitrate value to "XXX kbps". */
export function formatBitrate(kbps: number | null): string {
  if (kbps == null) return "";
  return `${kbps} kbps`;
}

/** Format a sample rate to "XX.X kHz". */
export function formatSampleRate(hz: number | null): string {
  if (hz == null) return "";
  return `${(hz / 1000).toFixed(1)} kHz`;
}

/** Format a channel count. */
export function formatChannels(ch: number | null): string {
  if (ch == null) return "";
  if (ch === 1) return "Mono";
  if (ch === 2) return "Stereo";
  return `${ch}ch`;
}

// ---------------------------------------------------------------------------
// Cover art types
// ---------------------------------------------------------------------------

export interface CoverArtData {
  data: string;     // base64
  mimeType: string; // "image/jpeg" | "image/png"
}

export type CoverArtSelection =
  | { status: "shared"; art: CoverArtData }
  | { status: "mixed" }
  | { status: "none" };

// ---------------------------------------------------------------------------
// Tag editing types
// ---------------------------------------------------------------------------

/** The 9 editable tag fields. */
export interface TagFields {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  track: string;
  disc: string;
  genre: string;
  comment: string;
}

export type TagFieldKey = keyof TagFields;

/** Sentinel value shown in a field when selected files have differing values. */
export const KEEP_PLACEHOLDER = "<keep>";

/**
 * Sparse edit state: filePath → partial tag overrides.
 * A file is "dirty" if it has any entry in this map.
 */
export interface TagEditState {
  editedTags: Map<string, Partial<TagFields>>;
}

/** A file update to send to the backend for saving. */
export interface TagUpdate {
  path: string;
  /** field → value (null = clear the field, undefined/missing = don't touch) */
  fields: Record<string, string | null>;
}

/** Result from the backend save_tags command. */
export interface SaveResult {
  succeeded: string[];
  failed: SaveError[];
}

export interface SaveError {
  path: string;
  error: string;
}

/** Extract TagFields from a FileEntry (from loaded tags). */
export function tagFieldsFromEntry(entry: FileEntry): TagFields {
  return {
    title: entry.title ?? "",
    artist: entry.artist ?? "",
    album: entry.album ?? "",
    albumArtist: entry.albumArtist ?? "",
    year: entry.year ?? "",
    track: entry.track ?? "",
    disc: entry.disc ?? "",
    genre: entry.genre ?? "",
    comment: entry.comment ?? "",
  };
}
