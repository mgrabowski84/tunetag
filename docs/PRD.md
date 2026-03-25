# PRD: Cross-Platform Audio Tag Editor (TuneTag)

**Version:** 0.5  
**Status:** Draft  
**Date:** 2026-03-25

---

## 1. Problem

Mp3tag is the de facto standard for batch audio tag editing, but it is Windows-only. Users on macOS and Linux have no comparable tool — existing alternatives are either limited in batch capability, unmaintained, or require technical setup.

---

## 2. Goal

Build a cross-platform desktop tag editor that covers Mp3tag's core editing workflow on Windows, macOS, and Linux — plus a CLI for scripting and automation — distributed as a single Tauri application.

**Out of scope for v1:** action scripts/automation, playlists, export.

---

## 3. Target Users

- Music collectors and library managers who use or want Mp3tag on macOS/Linux
- Users migrating from Windows who don't want to run Mp3tag via Wine
- Power users and scripters who want CLI-based batch tagging

---

## 4. Platforms

| Platform | Target |
|---|---|
| Windows | 10+ (x64) |
| macOS | 12+ (x64 + Apple Silicon universal binary) |
| Linux | .deb, .AppImage |

**Tech stack:**
- **Backend:** Rust (Tauri v2)
- **Tag I/O + audio properties:** [lofty](https://github.com/Serial-ATA/lofty-rs) — pure Rust, supports ID3v2, Vorbis Comments, MP4 atoms; also reads duration, bitrate, sample rate natively
- **Frontend:** React + TypeScript
- **CLI:** standalone binary (`tunetag`) sharing the same Rust core as the GUI

**Why Tauri over Electron:**
- ~5–10× smaller bundle (no bundled Chromium + V8 runtime)
- Lower memory footprint at runtime
- Rust backend eliminates native binding complexity for tag I/O

---

## 5. Supported Formats (v1)

| Format | Tag Standard | Read | Write | Default write version |
|---|---|---|---|---|
| MP3 | ID3v2 | ✓ | ✓ | ID3v2.4 |
| FLAC | Vorbis Comments | ✓ | ✓ | — ¹ |
| M4A / AAC | MP4 atoms (iTunes tags) | ✓ | ✓ | — ¹ |

¹ FLAC and M4A use a single tag standard with no versioning — there is no version to select.

**ID3 version policy:** Preserve the existing version by default — files with v2.3 tags are written back as v2.3; files with v2.4 tags are written back as v2.4. A Setting ("Always write ID3v2.4") lets users force upgrade to v2.4 on save. Rationale: silently upgrading breaks playback on older hardware (car stereos, DAPs) that don't support v2.4.

---

## 6. Open Source Components

| Tool | License | Usage |
|---|---|---|
| [lofty-rs](https://github.com/Serial-ATA/lofty-rs) | MIT | Tag read/write + audio properties for all v1 formats |
| [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) | Open data (CC0) | Online metadata lookup |

FFmpeg is not required for v1. lofty-rs reads duration, bitrate, sample rate, and channel info natively for MP3, FLAC, and M4A. FFmpeg may be revisited if format conversion is added in a future version.

---

## 7. Core Features

### 7.1 File Loading

- Open individual files or entire folders via menu or drag-and-drop
- Recursive subfolder toggle
- Default file list columns: #, Filename, Title, Artist, Album, Year, Track, Genre, Format
- Click column header to sort; click again to reverse
- Column customisation: right-click any column header → Add/Remove columns. Any tag field or audio property (bitrate, duration, sample rate) can be added as a column. Column order is drag-to-reorder. Settings persist across sessions.

### 7.2 Tag Panel

Persistent sidebar for editing tags of selected file(s).

| Field | Input |
|---|---|
| Title | Text |
| Artist | Text |
| Album | Text |
| Album Artist | Text |
| Year | Text (4-digit) |
| Track | Text (`N` or `N/Total`) |
| Disc | Text (`N` or `N/Total`) |
| Genre | Free-text with autocomplete from the ID3v1 genre list (80 original + Winamp extensions, 192 total) |
| Comment | Multiline text |
| Cover Art | Image widget (see 7.3) |

**Multi-file editing:**
- If all selected files share a value → show it
- If values differ → show `<keep>` placeholder
- On save: `<keep>` fields not written; explicit value written to all; explicit blank clears all

### 7.3 Cover Art

- Embedded cover art displayed in Tag Panel
- Drag-and-drop image file onto cover area to embed
- Right-click: Remove cover, Export cover to file
- Supported input: JPEG, PNG
- Multi-file: show cover if all selected share identical art (byte-for-byte comparison of embedded image data), otherwise show placeholder

### 7.4 Rename Files from Tags

Rename files on disk based on tag values using a format string.

- Format string input, e.g. `%artist% - %title%` → `Radiohead - Creep.mp3`
- Placeholders: `%title%`, `%artist%`, `%album%`, `%year%`, `%track%`, `%disc%`, `%albumartist%`, `%genre%`
- Live preview: show resolved filename for the first selected file as the user types
- Batch: applies to all selected files
- Dry run: preview all renames before committing
- Collision handling: if any files would resolve to the same name, abort the entire batch and list all conflicts — no files are renamed

Access: **Convert menu → Rename files from tags** (also available as a CLI subcommand).

### 7.5 Saving

- **Save** (Ctrl/Cmd+S): write tag changes to selected files via lofty
- Unsaved changes: asterisk in window title + per-file indicator in file list
- Prompt on close if unsaved changes exist

**Batch operation error handling (save and rename):**

Strategy: **skip and continue**. If a file fails during a batch save or rename, the operation continues with remaining files.

- **GUI:** Progress bar during batch operations. On completion with errors: modal dialog showing "Saved N/M files. K files failed:" with a table of filename + error reason. Failed files remain marked as unsaved.
- **CLI:** Errors printed to stderr as they occur. Summary line at end (e.g., `Saved 95/100 files (5 failed)`). Exit code `1` for partial failure, `0` for full success, `2` for fatal error (e.g., no files matched).
- **Rename pre-checks:** Before any rename executes, verify write permissions on all target directories and check for name collisions. Abort entire batch if pre-check fails. If a rename still fails at runtime after pre-checks pass, skip the file and continue.

### 7.6 Undo / Redo

- **Undo** (Ctrl/Cmd+Z): revert the last action
- **Redo** (Ctrl/Cmd+Shift+Z or Ctrl+Y): re-apply the last undone action
- Granularity: each discrete user action is one undo step — editing a field, applying metadata lookup results, auto-numbering, clearing a cover
- Multi-file edits (e.g., writing "Radiohead" to Artist on 50 files) count as a single undo step
- Undo stack is per-session, cleared when files are closed
- Saving does **not** clear the undo stack — you can save, then undo, and the file shows unsaved changes again
- Stack depth: 100 actions

### 7.7 Selection & Keyboard Navigation

**Mouse selection:**
- Click: single select
- Ctrl/Cmd+click: add/remove
- Shift+click: range select
- Ctrl/Cmd+A: select all

**Keyboard navigation:**
- Arrow Up/Down: move selection by one row
- Shift+Arrow Up/Down: extend selection range
- Home/End: jump to first/last file
- Page Up/Page Down: scroll by visible page height
- Tab: move focus between file list and tag panel
- Enter (in file list): begin editing the first field in tag panel for selected file
- Type-to-jump: typing characters while file list is focused jumps to the first filename matching the typed prefix (resets after 1 second of inactivity)

### 7.8 Auto-Numbering Wizard

Assign track (and optionally disc) numbers to a batch of selected files.

Access: **Convert menu → Auto-number tracks…** — opens a modal dialog.

**Options:**
- Starting track number (default: 1)
- Total tracks: auto-filled from selection count, or manually overridden
- Write as `N/Total` or `N` only (toggle)
- Disc number: optional fixed value to write to all selected files
- Sort order: number files in current file list order, or by filename

Preview table in the dialog shows current track value → new value for each selected file before committing.

Also available as a CLI subcommand:
```bash
tunetag autonumber ~/Music/album/*.mp3 --start 1 --total 12 --disc 1
```

### 7.9 Online Metadata Lookup

Look up album/track metadata from MusicBrainz and apply it to selected files.

Access: **Tag Sources menu → MusicBrainz…**

**Flow:**
1. User selects one or more files and opens Tag Sources → MusicBrainz
2. App constructs a search query from existing tags of the first selected file: `artist + album` (or `artist + title` for single-track lookup)
3. The search query is shown in an **editable text field** — the user can modify it before searching. This covers files with missing or incorrect tags.
4. Results panel opens (modal or side panel) showing a list of matching releases — each entry shows: Release title, Artist, Year, Label, Format, Track count
5. User picks a release from the list
6. For multi-file selections (full album), app maps results tracklist to selected files by track number; for single-file, applies directly
7. Field diff shown before applying: table of `field | current value | new value` with per-field checkboxes to include/exclude
8. User confirms → tags applied to files in-memory (unsaved, follows normal save flow)

**Fields populated from MusicBrainz:**
Title, Artist, Album, Album Artist, Year, Track, Disc, Genre (from tags/folksonomy), Cover Art (via Cover Art Archive)

**API details:**
- No authentication required
- User-Agent header required (set to `tunetag/<version>` per MusicBrainz API etiquette)
- Rate limiting: MusicBrainz allows 1 request per second; app must throttle accordingly and show progress
- Requests run in the background; UI remains responsive

### 7.10 Refresh

- **Refresh** (F5): re-reads all tags from disk for all loaded files
- If any files have unsaved changes, prompt before refreshing: "You have unsaved changes in N files. Refresh will discard them. Continue?"
- Files deleted externally are removed from the list on refresh

---

## 8. CLI

The CLI ships as a standalone binary (`tunetag`) built from the same Rust core. No GUI dependency — usable headlessly in scripts and CI.

### Subcommands

```
tunetag read <file>                      Print all tags as key=value
tunetag write <file> [--field value …]   Set one or more tag fields
tunetag rename <files…> --format <fmt>   Rename files using a format string
tunetag cover set <file> --image <path>  Embed cover art
tunetag cover remove <file>              Strip cover art
tunetag info <file>                      Print audio properties (duration, bitrate, sample rate)
tunetag autonumber <files…>              Auto-number tracks (see 7.8)
```

### Examples

```bash
# Set artist and title
tunetag write track.mp3 --artist "Radiohead" --title "Creep"

# Bulk rename from tags
tunetag rename ~/Music/*.mp3 --format "%track% - %title%"

# Read all tags
tunetag read track.flac

# Embed cover art
tunetag cover set track.mp3 --image cover.jpg

# Preview renames without committing
tunetag rename ~/Music/*.mp3 --format "%artist% - %title%" --dry-run

# Preview tag writes without committing
tunetag write track.mp3 --artist "Radiohead" --title "Creep" --dry-run
```

### Output & Flags

- Default output: human-readable `key=value`
- `--json`: JSON output for scripting
- `--dry-run`: supported on `rename` and `write`
- Exit codes: `0` success, `1` partial failure, `2` fatal error

**`write --dry-run` output:** Shows a diff of current vs. proposed values for each file:
```
track.mp3:
  Artist: "Unknown" → "Radiohead"
  Title:  "" → "Creep"
```
With `--json`, outputs structured JSON with `file`, `field`, `old`, `new` keys per change:
```json
[
  {
    "file": "track.mp3",
    "changes": [
      { "field": "Artist", "old": "Unknown", "new": "Radiohead" },
      { "field": "Title", "old": "", "new": "Creep" }
    ]
  }
]
```

**`rename --dry-run` output:** Shows current filename → new filename for each file:
```
track01.mp3 → Radiohead - Creep.mp3
track02.mp3 → Radiohead - Everything in Its Right Place.mp3
```
With `--json`, outputs structured JSON with `file`, `new_name` keys.

---

## 9. UI Layout

```
┌──────────────────────────────────────────────────┐
│  Menu bar: File | Edit | Convert | Tag Sources   │
│            | View                                 │
├──────────────────────┬───────────────────────────┤
│                      │  Tag Panel                │
│  File List           │  ─────────────────────    │
│  (sortable columns)  │  Title    [          ]    │
│                      │  Artist   [          ]    │
│                      │  Album    [          ]    │
│                      │  ...                      │
│                      │  Cover    [  image   ]    │
│                      │                           │
│                      │  [     Save     ]         │
└──────────────────────┴───────────────────────────┘
│  Status bar: N files loaded | M selected         │
│              | K unsaved                          │
└──────────────────────────────────────────────────┘
```

Resizable split pane. Rename and Auto-number dialogs open as modals from the Convert menu.

---

## 10. Menu Structure

**File**
- Open Files… (Ctrl+O)
- Open Folder… (Ctrl+Shift+O)
- Save (Ctrl+S)
- Close All

**Edit**
- Undo (Ctrl+Z)
- Redo (Ctrl+Shift+Z)
- Select All (Ctrl+A)

**Convert**
- Rename Files from Tags…
- Auto-number Tracks…

**Tag Sources**
- MusicBrainz…

**View**
- Toggle recursive folder loading
- Refresh (F5)

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Load 1,000 files from local SSD | < 3 seconds |
| Save 100 files (tag-only, no re-encode) | < 5 seconds |
| Audio data integrity | Tag writes must never touch audio frames |
| Network | Only Tag Sources features make outbound requests; core editing works fully offline |
| App bundle size | < 15 MB (no FFmpeg) |
| CLI startup time | < 100 ms (single file operation) |

---

## 12. Out of Scope (v1)

- Action scripts / batch automation engine
- Filename → Tag (import tags from filenames)
- Export (CSV, HTML, TXT)
- Playlists
- Lyrics, extended/custom tag fields
- WMA, OGG, OPUS, WAV
- Format conversion (future feature)
- Filter / search within file list
- Discogs integration (may revisit post-v1)

---

## 13. Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | CLI binary name | `tunetag` |
| 2 | ID3v2.3 preservation | ON by default; preserve existing version; "Always write v2.4" is opt-in in Settings |
| 3 | Rename collision strategy | Abort entire batch; no files renamed if any conflict exists |
| 4 | FFmpeg | Not needed for v1; lofty-rs covers audio properties natively |
| 5 | Genre autocomplete list | ID3v1 genre list (80 original + Winamp extensions, 192 total) |
| 6 | Metadata lookup trigger | Search using existing file tags (artist + album); user can edit query before searching |
| 7 | Metadata apply flow | Show results list, user picks release; field diff with per-field checkboxes before applying |
| 8 | Metadata source | MusicBrainz only (no auth required). Discogs dropped from v1 to avoid auth complexity and shared rate limits. |
| 9 | Batch error handling | Skip and continue; report failures at end; failed files remain dirty |
| 10 | Undo model | Per-action undo stack (depth 100); saving does not clear the stack |
| 11 | External file changes | Manual refresh (F5); no file system watcher in v1 |
| 12 | Cover art multi-file comparison | Byte-for-byte comparison of embedded image data |

---

## 14. Success Metrics (v1)

- User can open a folder, edit tags, rename files, and save — with no data loss
- CLI can batch-rename 1,000 files in under 10 seconds
- Zero reports of audio data corruption from tag writes
- App bundle < 15 MB on all three platforms

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| 0.4 | 2026-03-24 | Initial draft |
| 0.5 | 2026-03-25 | Added batch error handling (skip & continue). Added manual query fallback for metadata lookup. Replaced revert with real undo/redo stack (depth 100). Added keyboard navigation for file list. Specified `write --dry-run` and `rename --dry-run` output formats. Dropped Discogs — MusicBrainz only. Added Refresh (F5) to View menu. Clarified performance target as local SSD. Specified byte-for-byte cover art comparison. Fixed menu bar to include Tag Sources. Committed to `tunetag` as CLI binary name. Clarified genre list source. Added unsaved count to status bar. Added format version footnote. |
