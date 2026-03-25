## Why

Users who batch-edit tags need a way to fill in missing or correct metadata without manual research. MusicBrainz provides a comprehensive, open (CC0) music metadata database accessible via a free, unauthenticated API. Adding online lookup lets users select files, search for a matching release, review field differences, and apply accurate metadata in seconds — the single biggest time-saver for album-level tagging workflows.

## What Changes

- Add a MusicBrainz lookup flow accessible from **Tag Sources → MusicBrainz…**
- Implement a Rust-side HTTP client for MusicBrainz API (release search, release details, Cover Art Archive)
- Auto-construct search queries from existing tags of the first selected file (`artist + album` or `artist + title`)
- Provide an editable search field so users can correct or refine the query before searching
- Display a results list showing matching releases (title, artist, year, label, format, track count)
- On release selection, map the release tracklist to selected files by track number
- Show a field diff table (`field | current value | new value`) with per-field checkboxes to include/exclude
- On confirm, apply selected fields to files in-memory (unsaved — follows normal save flow)
- Fields populated: Title, Artist, Album, Album Artist, Year, Track, Disc, Genre (folksonomy tags), Cover Art (via Cover Art Archive)
- Enforce MusicBrainz API etiquette: `User-Agent: tunetag/<version>`, 1 request/second rate limiting
- All HTTP requests run in the background; UI remains responsive

## Capabilities

### New Capabilities
- `musicbrainz-lookup`: Online metadata lookup from MusicBrainz — covers the API client, search flow, result display, track-to-file mapping, field diff UI, and apply-to-tags logic

### Modified Capabilities
<!-- No existing capabilities are modified — this is a new, self-contained feature. -->

## Impact

- **New Rust dependency:** HTTP client crate (e.g., `reqwest`) added to `Cargo.toml` for MusicBrainz/Cover Art Archive API calls
- **New Tauri commands:** Backend commands for search, fetch release details, fetch cover art — exposed to frontend via Tauri's IPC
- **Frontend:** New modal/panel components for search input, results list, and field diff table; new menu item wiring for Tag Sources → MusicBrainz
- **Network:** First feature that makes outbound HTTP requests; the app otherwise works fully offline. Network errors must be handled gracefully with user-visible messages.
- **Rate limiting:** A Rust-side rate limiter (token bucket or simple delay) ensures compliance with MusicBrainz's 1 req/sec policy
- **Undo integration:** Applying MusicBrainz results counts as a single undo step (per PRD §7.6)
