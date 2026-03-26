import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTagEdit } from "../TagEditContext";
import type { TagFields } from "../types";
import type { FileEntry } from "../types";

// ---------------------------------------------------------------------------
// Types matching Rust DTOs
// ---------------------------------------------------------------------------

interface SearchResultDto {
  mbid: string;
  title: string;
  artist: string;
  year: string;
  label: string;
  format: string;
  trackCount: number;
}

interface TrackDto {
  number: number;
  title: string;
  artist: string;
}

interface ReleaseDetailDto {
  mbid: string;
  title: string;
  artist: string;
  albumArtist: string;
  year: string;
  label: string;
  genre: string;
  tracks: TrackDto[];
}

// ---------------------------------------------------------------------------
// Build search query from first selected file's tags (task 5.1)
// ---------------------------------------------------------------------------

function buildSearchQuery(entry: FileEntry | undefined): string {
  if (!entry) return "";
  const parts: string[] = [];
  if (entry.artist) parts.push(`artist:"${entry.artist}"`);
  if (entry.album) parts.push(`release:"${entry.album}"`);
  if (parts.length === 0 && entry.title) parts.push(`"${entry.title}"`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Track-to-file mapping (task 7.2)
// ---------------------------------------------------------------------------

interface FileTrackMapping {
  file: FileEntry;
  track: TrackDto | null;
}

function mapTracksToFiles(
  files: FileEntry[],
  tracks: TrackDto[],
): FileTrackMapping[] {
  // Sort files by their current track number (numeric), fallback to filename
  const sorted = [...files].sort((a, b) => {
    const numA = parseInt(a.track?.split("/")[0] ?? "0", 10);
    const numB = parseInt(b.track?.split("/")[0] ?? "0", 10);
    if (numA !== numB) return numA - numB;
    return a.filename.localeCompare(b.filename);
  });

  const sortedTracks = [...tracks].sort((a, b) => a.number - b.number);
  const count = Math.min(sorted.length, sortedTracks.length);

  return sorted.map((file, idx) => ({
    file,
    track: idx < count ? sortedTracks[idx] : null,
  }));
}

// ---------------------------------------------------------------------------
// Field diff (tasks 8.1-8.4)
// ---------------------------------------------------------------------------

type DiffableField = keyof Pick<
  TagFields,
  "title" | "artist" | "album" | "albumArtist" | "year" | "genre"
>;

const DIFF_FIELDS: { key: DiffableField; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "albumArtist", label: "Album Artist" },
  { key: "year", label: "Year" },
  { key: "genre", label: "Genre" },
];

interface FieldDiff {
  field: DiffableField;
  label: string;
  current: string;
  incoming: string;
  checked: boolean;
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

interface MusicBrainzDialogProps {
  selectedFiles: FileEntry[];
  onClose: () => void;
}

type Step = "search" | "results" | "diff";

function MusicBrainzDialog({ selectedFiles, onClose }: MusicBrainzDialogProps) {
  const { setField } = useTagEdit();
  const firstFile = selectedFiles[0];

  // Search
  const [query, setQuery] = useState(() => buildSearchQuery(firstFile));
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResultDto[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected release + details
  const [, setSelectedResult] = useState<SearchResultDto | null>(null);
  const [details, setDetails] = useState<ReleaseDetailDto | null>(null);
  const [coverArtDataUrl, setCoverArtDataUrl] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Diff step
  const [step, setStep] = useState<Step>("search");
  const [diffs, setDiffs] = useState<FileTrackMapping[]>([]);
  const [fieldDiffs, setFieldDiffs] = useState<FieldDiff[]>([]);
  const [applyTrackNumbers, setApplyTrackNumbers] = useState(true);
  const [applyCoverArt, setApplyCoverArt] = useState(true);

  // Search (task 6.2)
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const res = await invoke<SearchResultDto[]>("mb_search_releases", { query });
      setResults(res);
      setStep("results");
    } catch (e) {
      setSearchError(String(e));
    } finally {
      setSearching(false);
    }
  }, [query]);

  // Select a release (task 7.1)
  const handleSelectRelease = useCallback(async (result: SearchResultDto) => {
    setSelectedResult(result);
    setLoadingDetails(true);
    try {
      const [detail, coverArt] = await Promise.all([
        invoke<ReleaseDetailDto>("mb_get_release_details", { mbid: result.mbid }),
        invoke<string | null>("mb_fetch_cover_art", { mbid: result.mbid }),
      ]);
      setDetails(detail);
      setCoverArtDataUrl(coverArt);

      // Build file→track mapping
      const mapping = mapTracksToFiles(selectedFiles, detail.tracks);
      setDiffs(mapping);

      // Build field diffs (single file = per-track title/artist; multi = album fields)
      const albumDiffs: FieldDiff[] = DIFF_FIELDS.map(({ key, label }) => {
        const current = firstFile?.[key as keyof FileEntry] as string ?? "";
        let incoming = "";
        if (key === "title" && selectedFiles.length === 1) {
          incoming = mapping[0]?.track?.title ?? "";
        } else if (key === "artist" && selectedFiles.length === 1) {
          incoming = mapping[0]?.track?.artist ?? detail.artist;
        } else {
          incoming = detail[key as keyof ReleaseDetailDto] as string ?? "";
        }
        return {
          field: key,
          label,
          current,
          incoming,
          checked: incoming !== "" && incoming !== current,
        };
      });
      setFieldDiffs(albumDiffs);
      setStep("diff");
    } catch (e) {
      setSearchError(String(e));
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedFiles, firstFile]);

  // Toggle a field diff checkbox
  const toggleField = useCallback((field: DiffableField) => {
    setFieldDiffs((prev) =>
      prev.map((d) => (d.field === field ? { ...d, checked: !d.checked } : d)),
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setFieldDiffs((prev) => prev.map((d) => ({ ...d, checked })));
  }, []);

  const allChecked = fieldDiffs.every((d) => d.checked);

  // Apply (task 9.1-9.2)
  const handleApply = useCallback(() => {
    if (!details) return;

    for (const { file, track } of diffs) {
      const paths = [file.path];

      // Apply checked fields
      for (const diff of fieldDiffs) {
        if (!diff.checked) continue;
        const isPerTrack = diff.field === "title" || diff.field === "artist";
        if (isPerTrack && selectedFiles.length > 1) {
          // For multi-file: album-level artist/albumArtist apply to all; title is per-track
          if (diff.field === "title" && track) {
            setField(paths, "title", track.title);
          } else if (diff.field === "artist") {
            setField(paths, "artist", details.artist);
          }
        } else if (isPerTrack && track) {
          setField(paths, diff.field, diff.field === "title" ? track.title : track.artist);
        } else {
          setField(paths, diff.field, diff.incoming);
        }
      }

      // Apply track number
      if (applyTrackNumbers && track) {
        const total = details.tracks.length;
        setField(paths, "track", `${track.number}/${total}`);
      }
    }

    onClose();
  }, [details, diffs, fieldDiffs, applyTrackNumbers, selectedFiles, setField, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-white rounded-lg w-[680px] max-h-[85vh] flex flex-col"
        style={{ boxShadow: "0 8px 32px rgba(27, 51, 83, 0.15)" }}
      >
        {/* Header */}
        <div className="p-5 pb-3 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              MusicBrainz Lookup
            </h2>
            <p className="text-xs text-on-surface-variant">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          {step !== "search" && (
            <button
              className="text-xs text-on-surface-variant hover:text-on-surface px-2 py-1"
              onClick={() => setStep(step === "diff" ? "results" : "search")}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Search field */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 h-8 bg-surface-container-lowest ring-1 ring-outline-variant/20 border-none text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm"
              placeholder="artist:&quot;Radiohead&quot; release:&quot;OK Computer&quot;"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-3 py-1.5 text-xs bg-primary text-on-primary rounded hover:opacity-90 disabled:opacity-40"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {searchError && (
            <p className="text-[11px] text-red-600 mt-1">{searchError}</p>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-5 pb-3">

          {/* Results list (task 6.3) */}
          {step === "results" && results !== null && (
            <>
              {results.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">
                  No results found. Try a different query.
                </div>
              ) : (
                <div className="flex-1 overflow-auto border border-slate-200 rounded-sm">
                  <table className="w-full text-[12px] border-collapse">
                    <thead className="bg-surface-container-high sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter">Title</th>
                        <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-36">Artist</th>
                        <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-14">Year</th>
                        <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-14">Tracks</th>
                        <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-24">Format</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr
                          key={r.mbid}
                          className={`border-t border-slate-100 cursor-pointer ${
                            i % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low"
                          } hover:bg-primary-container hover:text-on-primary-container`}
                          onClick={() => handleSelectRelease(r)}
                        >
                          <td className="px-3 py-1.5 truncate max-w-[200px]">{r.title}</td>
                          <td className="px-3 py-1.5 truncate">{r.artist}</td>
                          <td className="px-3 py-1.5">{r.year}</td>
                          <td className="px-3 py-1.5 text-center">{r.trackCount}</td>
                          <td className="px-3 py-1.5">{r.format}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {loadingDetails && (
                <div className="mt-2 text-xs text-on-surface-variant">Loading release details…</div>
              )}
            </>
          )}

          {/* Field diff (tasks 8.1-8.5) */}
          {step === "diff" && details && (
            <div className="flex-1 overflow-auto space-y-3">
              {/* Cover art row */}
              <div className="flex gap-3 items-start">
                <div className="w-16 h-16 bg-surface-container-high rounded border border-outline-variant/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {coverArtDataUrl ? (
                    <img src={coverArtDataUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-on-surface-variant">No art</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-on-surface">{details.title}</div>
                  <div className="text-xs text-on-surface-variant">{details.artist}</div>
                  <div className="text-xs text-on-surface-variant">{details.year} · {details.tracks.length} tracks</div>
                </div>
                {coverArtDataUrl && (
                  <label className="flex items-center gap-1.5 text-[12px] text-on-surface cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={applyCoverArt}
                      onChange={(e) => setApplyCoverArt(e.target.checked)}
                      className="accent-primary"
                    />
                    Apply cover art
                  </label>
                )}
              </div>

              {/* Field diff table */}
              <div className="border border-slate-200 rounded-sm">
                <div className="flex items-center px-3 py-1.5 bg-surface-container-high border-b border-slate-200">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="accent-primary"
                    />
                    Field
                  </label>
                  <span className="ml-auto text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-48">Current</span>
                  <span className="ml-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-48">New</span>
                </div>
                {fieldDiffs.map((diff) => (
                  <label
                    key={diff.field}
                    className="flex items-center px-3 py-1.5 border-t border-slate-100 cursor-pointer hover:bg-surface-container-low text-[12px]"
                  >
                    <input
                      type="checkbox"
                      checked={diff.checked}
                      onChange={() => toggleField(diff.field)}
                      className="accent-primary mr-2"
                    />
                    <span className="w-24 text-on-surface-variant">{diff.label}</span>
                    <span className="w-48 truncate text-on-surface-variant ml-auto">{diff.current || "—"}</span>
                    <span className={`w-48 truncate ml-4 ${diff.checked ? "text-primary font-medium" : "text-on-surface-variant"}`}>
                      {diff.incoming || "—"}
                    </span>
                  </label>
                ))}
              </div>

              {/* Track numbers toggle */}
              {details.tracks.length > 0 && (
                <label className="flex items-center gap-1.5 text-[12px] text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyTrackNumbers}
                    onChange={(e) => setApplyTrackNumbers(e.target.checked)}
                    className="accent-primary"
                  />
                  Apply track numbers ({selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} → {details.tracks.length} tracks)
                  {selectedFiles.length !== details.tracks.length && (
                    <span className="text-amber-600 text-[11px]">
                      (count mismatch — will map {Math.min(selectedFiles.length, details.tracks.length)})
                    </span>
                  )}
                </label>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 p-4 pt-0 shrink-0">
          <button
            className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-slate-100 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          {step === "diff" && (
            <button
              className="px-4 py-1.5 text-xs bg-gradient-to-b from-primary to-primary-dim text-on-primary rounded shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
              onClick={handleApply}
            >
              Apply to Files
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MusicBrainzDialog;
