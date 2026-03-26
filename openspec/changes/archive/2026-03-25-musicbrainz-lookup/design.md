## Context

TuneTag is a cross-platform audio tag editor built with Tauri v2 (Rust backend) and React/TypeScript frontend. The app currently supports local tag editing with no network features. PRD §7.9 specifies a MusicBrainz lookup flow that is the first — and only v1 — feature requiring outbound HTTP requests.

MusicBrainz provides a JSON web service (v2) for searching and retrieving music metadata. Cover art is served by a separate Cover Art Archive (CAA) service. Both are open, unauthenticated APIs but require a descriptive `User-Agent` header and respect for a 1 request/second rate limit.

The Tauri architecture means HTTP requests must originate from the Rust backend (not the webview), and results are passed to the frontend via Tauri IPC commands.

## Goals / Non-Goals

**Goals:**
- Implement a complete search → select → diff → apply flow for MusicBrainz releases
- Build a reusable Rust HTTP/API client layer that respects rate limiting
- Keep the UI responsive during all network operations
- Integrate with the existing undo system (applying lookup results = one undo step)

**Non-Goals:**
- Discogs or other metadata sources (explicitly dropped from v1)
- AcoustID / audio fingerprinting lookup
- Caching MusicBrainz responses across sessions
- CLI integration for MusicBrainz lookup (GUI-only for v1)

## Decisions

### 1. HTTP Client: `reqwest` with Tokio async runtime

**Decision:** Use `reqwest` (with `rustls-tls` feature to avoid OpenSSL dependency) as the HTTP client, running on Tauri's existing Tokio runtime.

**Alternatives considered:**
- `ureq` (sync, smaller): Would require spawning blocking threads. Tauri already provides a Tokio runtime, so async `reqwest` is a natural fit with no added complexity.
- Tauri's built-in HTTP plugin (`tauri-plugin-http`): Adds an unnecessary abstraction layer. Direct `reqwest` in the backend gives full control over headers, rate limiting, and response parsing.

**Rationale:** `reqwest` is the Rust ecosystem standard for async HTTP. Using `rustls-tls` avoids platform-specific OpenSSL linking issues on all three target platforms (Windows, macOS, Linux).

### 2. Rate Limiting: Token bucket with 1-second minimum interval

**Decision:** Implement a simple async rate limiter in Rust that enforces a minimum 1-second interval between requests to any MusicBrainz/CAA endpoint. The limiter is a shared singleton (`Arc<Mutex<Instant>>`) tracking the last request timestamp. Before each request, sleep for the remaining interval if needed.

**Alternatives considered:**
- Token bucket crate (`governor`): Overkill for a single-endpoint, single-rate scenario. A simple timestamp check is ~10 lines of code and trivially correct.
- Frontend-side throttling: Wrong layer — the Rust backend should own rate limiting since it's the network boundary.

**Rationale:** MusicBrainz rate-limits by IP and will return HTTP 503 with a `Retry-After` header if exceeded. A simple interval timer is sufficient because all requests are serialized through one client. If a 503 is received, the client backs off per the `Retry-After` value.

### 3. MusicBrainz API Client Module Structure

**Decision:** Create a `musicbrainz` module in the Rust backend with three sub-concerns:

- **`client.rs`** — HTTP client wrapper with User-Agent, rate limiter, base URL. Single `MusicBrainzClient` struct shared across Tauri commands (managed state via `tauri::Manager`).
- **`models.rs`** — Serde-deserializable structs for MusicBrainz JSON responses (release search results, release details with recordings, cover art response).
- **`commands.rs`** — Tauri `#[command]` functions exposed to the frontend: `search_releases`, `get_release_details`, `fetch_cover_art`.

**Rationale:** Clean separation between transport, data, and IPC concerns. The client is testable in isolation; commands are thin wrappers that delegate to the client.

### 4. Search Query Construction

**Decision:** The frontend constructs the initial search query from the first selected file's tags:
- If both `artist` and `album` are non-empty → `"artist:\"<artist>\" AND release:\"<album>\""`
- If only `artist` and `title` are non-empty (single-track) → `"artist:\"<artist>\" AND recording:\"<title>\""`
- Fallback → empty string (user must type manually)

The query string is displayed in an editable text field. The user can freely modify it before triggering the search. The raw text is sent to the MusicBrainz release search endpoint (`/ws/2/release?query=<text>&fmt=json&limit=25`).

**Rationale:** Lucene query syntax gives precise results when tags are accurate. Showing it as editable text lets users fall back to simple text search or refine with MusicBrainz-specific fields if they know them. Limit of 25 results balances completeness with usability.

### 5. Release-to-Files Mapping Algorithm

**Decision:** When the user selects a release, map MusicBrainz tracks to selected files using this strategy:

1. Fetch full release details including media/tracks (`/ws/2/release/<mbid>?inc=recordings+artists+labels+release-groups&fmt=json`).
2. Flatten all tracks across all media (discs) into a single ordered list, preserving disc number and track position.
3. Match by position: sort selected files by their existing track number tag (falling back to filename sort if track numbers are absent), then zip with the MusicBrainz tracklist positionally.
4. If the count of selected files differs from the tracklist length, map up to `min(files, tracks)` and mark unmatched entries in the UI.

**Alternatives considered:**
- Match by title similarity (fuzzy matching): Fragile, especially for files with no or incorrect titles. Positional matching is what users expect for album workflows.
- Match by MusicBrainz track number only: Equivalent to positional for most releases, but disc-number-aware positional is more robust for multi-disc sets.

**Rationale:** Positional matching mirrors how Mp3tag and other tools work. It's predictable and correct for the primary use case (user has an album's files in order). The diff UI lets users catch and fix mismatches before applying.

### 6. Cover Art Retrieval

**Decision:** Fetch cover art from the Cover Art Archive (CAA) in a separate request after the user selects a release:
- Endpoint: `https://coverartarchive.org/release/<mbid>/front-500` (500px version for reasonable size)
- Fallback: If 404 (no art), show "No cover art available" in the diff
- The image bytes are passed to the frontend as base64 for preview, and stored as raw bytes for embedding into tags on apply

**Rationale:** CAA is the official companion to MusicBrainz for cover art. The 500px thumbnail balances quality with transfer size. Full-resolution can be fetched if needed in the future.

### 7. Field Diff UI Component

**Decision:** After release selection and track mapping, show a modal dialog with a diff table per file:

| ☑ | Field | Current | New |
|---|-------|---------|-----|
| ☑ | Title | Untitled | Creep |
| ☐ | Artist | Radiohead | Radiohead |
| ... | ... | ... | ... |

- Per-field checkboxes default to **checked** if the new value differs from the current value, **unchecked** if values are identical.
- Cover art shown as thumbnail in the diff row.
- For multi-file applies (album), a summary view groups common fields (Album, Album Artist, Year) at top, then per-track fields below with a file-by-file breakdown.
- "Select All" / "Deselect All" toggle for convenience.
- "Apply" button confirms; "Cancel" discards.

**Rationale:** The per-field checkbox approach matches Mp3tag's workflow exactly and gives users full control. Defaulting checkboxes based on value differences reduces clicks for the common case.

### 8. Async Command Pattern

**Decision:** All MusicBrainz Tauri commands are `async` and use `tauri::async_runtime`. Long operations (search, fetch details + cover art) are non-blocking. The frontend shows a loading spinner during network operations and can cancel in-flight requests by navigating away from the dialog (the Rust side uses `tokio::select!` with a cancellation token).

**Rationale:** Tauri v2 natively supports async commands. Blocking the main thread would freeze the UI, violating PRD §11 (UI must remain responsive).

### 9. Genre Mapping

**Decision:** MusicBrainz does not have a first-class "genre" field on recordings. Instead, use MusicBrainz folksonomy tags (`/ws/2/release/<mbid>?inc=tags`) and take the top-voted tag(s). Map to Genre field by taking the single highest-voted tag. If no tags exist, leave Genre unchanged.

**Rationale:** MusicBrainz folksonomy tags are community-curated and generally accurate for popular releases. Taking only the top tag avoids multi-genre complexity that doesn't map well to single-value tag fields.

## Risks / Trade-offs

- **[MusicBrainz API availability]** → The API is free and generally reliable but has no SLA. Mitigation: Graceful error handling with clear user-facing messages ("Could not reach MusicBrainz. Check your internet connection."). All core editing features work offline.

- **[Rate limiting 503 responses]** → Even with client-side rate limiting, shared IP environments (corporate NAT, VPN) may trigger server-side limits. Mitigation: Honor `Retry-After` header; retry once after the specified delay; if still 503, surface error to user.

- **[Track mapping mismatches for non-standard releases]** → Positional mapping fails for compilations, deluxe editions with bonus tracks, or files not in track order. Mitigation: The diff UI shows all mappings before applying — user can deselect incorrect fields. Future enhancement: allow manual drag-to-reorder mapping.

- **[Cover Art Archive latency]** → CAA can be slow (1-3s for image fetch). Mitigation: Fetch cover art asynchronously after showing the text-field diff; cover art row appears with a loading spinner and updates when ready.

- **[Binary size increase from reqwest]** → Adding `reqwest` + `rustls` increases the binary by ~1-2 MB. Mitigation: Still well within the 15 MB bundle target. Using `rustls-tls` (not `native-tls`) avoids linking OpenSSL and keeps the increase minimal.

- **[Folksonomy genre quality]** → Community tags can be noisy or missing for obscure releases. Mitigation: Genre is just one checkbox in the diff — users can easily deselect it. The field defaults to unchecked if no tags are available.
