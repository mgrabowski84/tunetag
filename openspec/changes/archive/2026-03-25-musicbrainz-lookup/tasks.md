## 1. Dependencies and Project Setup

- [x] 1.1 Add `reqwest` (with `rustls-tls` and `json` features) and `serde`/`serde_json` to `Cargo.toml`
- [x] 1.2 Create the `musicbrainz` module directory structure in the Rust backend (`src-tauri/src/musicbrainz/mod.rs`, `client.rs`, `models.rs`, `commands.rs`)

## 2. MusicBrainz API Client (Rust)

- [x] 2.1 Implement rate limiter: shared `Arc<Mutex<Instant>>` that enforces 1-second minimum interval between requests
- [x] 2.2 Implement `MusicBrainzClient` struct with `reqwest::Client`, User-Agent header (`tunetag/<version>`), rate limiter, and base URL configuration
- [x] 2.3 Implement `search_releases` method: sends Lucene query to `/ws/2/release?query=<text>&fmt=json&limit=25`, returns parsed results
- [x] 2.4 Implement `get_release_details` method: fetches `/ws/2/release/<mbid>?inc=recordings+artists+labels+release-groups+tags&fmt=json`, returns full release with tracks and folksonomy tags
- [x] 2.5 Implement `fetch_cover_art` method: fetches `https://coverartarchive.org/release/<mbid>/front-500`, returns image bytes or None if 404
- [x] 2.6 Implement 503 retry logic: parse `Retry-After` header, wait, retry once; surface error on second failure
- [x] 2.7 Implement request timeout (15 seconds) and connection error handling with descriptive error types

## 3. Serde Response Models (Rust)

- [x] 3.1 Define `SearchResult` and `SearchResponse` structs for release search results (title, artist, year, label, format, track count, MBID)
- [x] 3.2 Define `ReleaseDetail`, `Medium`, `Track`, `ArtistCredit`, `ReleaseGroup`, and `Tag` structs for full release details
- [x] 3.3 Define frontend-facing DTOs for IPC serialization: `SearchResultDto`, `ReleaseDetailDto`, `TrackDto`, `CoverArtDto`

## 4. Tauri Commands

- [x] 4.1 Register `MusicBrainzClient` as Tauri managed state (initialized on app startup)
- [x] 4.2 Implement `search_releases` Tauri command: accepts query string, delegates to client, returns `Vec<SearchResultDto>`
- [x] 4.3 Implement `get_release_details` Tauri command: accepts MBID, delegates to client, returns `ReleaseDetailDto`
- [x] 4.4 Implement `fetch_cover_art` Tauri command: accepts MBID, delegates to client, returns base64-encoded image or null
- [x] 4.5 Add error handling: map Rust errors to serializable error types returned to frontend

## 5. Search Query Construction (Frontend)

- [x] 5.1 Implement `buildSearchQuery` utility function: given the first selected file's tags, construct the query string (artist+album, artist+title, or empty fallback)
- [x] 5.2 Wire Tag Sources → MusicBrainz menu item: disable when no files are selected, open MusicBrainz dialog when clicked

## 6. MusicBrainz Search Dialog (Frontend)

- [x] 6.1 Create `MusicBrainzDialog` modal component with editable search text field, Search button, and loading spinner
- [x] 6.2 Implement search submission: validate non-empty query, invoke `search_releases` Tauri command, display results
- [x] 6.3 Create `SearchResultsList` component: render results with release title, artist, year, label, format, track count; single-select behavior
- [x] 6.4 Handle empty results state: show "No results found" message with option to modify query
- [x] 6.5 Handle network error states: show error message within dialog (connection failure, timeout, API error)

## 7. Release Detail Fetch and Track Mapping (Frontend)

- [x] 7.1 On release selection, invoke `get_release_details` and `fetch_cover_art` Tauri commands (cover art fetched asynchronously)
- [x] 7.2 Implement track-to-file mapping algorithm: sort selected files by track number (fallback to filename), zip with MusicBrainz tracklist in disc-then-position order
- [x] 7.3 Handle count mismatches: map `min(files, tracks)` entries, mark unmatched files/tracks in the UI
- [x] 7.4 Extract genre from folksonomy tags: pick the single highest-voted tag; mark genre as unavailable if no tags exist

## 8. Field Diff UI (Frontend)

- [x] 8.1 Create `FieldDiffTable` component: rows for each field (Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Cover Art) with current value, new value, and per-field checkbox
- [x] 8.2 Implement checkbox default logic: checked when new value differs from current, unchecked when identical; disabled when new value is unavailable (e.g., no genre, no cover art)
- [x] 8.3 Add Select All / Deselect All toggle
- [x] 8.4 Implement multi-file album diff view: shared fields (Album, Album Artist, Year) in summary section at top, per-track fields grouped by file below
- [x] 8.5 Display cover art thumbnail in diff row with loading spinner while fetching; show "No cover art available" if 404

## 9. Apply Flow and Undo Integration

- [x] 9.1 Implement Apply action: collect checked fields per file, update in-memory tag state, mark files as unsaved
- [x] 9.2 Integrate with undo system: wrap entire apply operation (all files, all fields) as a single undo step
- [x] 9.3 Implement Cancel action: close dialog with no changes applied
- [x] 9.4 Handle dialog dismissal during in-flight requests: cancel pending requests, apply no changes

## 10. Testing

- [x] 10.1 Unit tests for Rust rate limiter (ensures minimum interval enforcement)
- [x] 10.2 Unit tests for Rust MusicBrainz response model deserialization (parse sample JSON fixtures)
- [x] 10.3 Unit tests for frontend `buildSearchQuery` utility (all tag combinations)
- [x] 10.4 Unit tests for track-to-file mapping algorithm (equal counts, fewer files, more files, missing track numbers)
- [x] 10.5 Integration test for search → select → diff → apply flow (mock Tauri commands)
