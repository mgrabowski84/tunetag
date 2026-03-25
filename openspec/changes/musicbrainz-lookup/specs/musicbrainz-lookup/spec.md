## ADDED Requirements

### Requirement: MusicBrainz search from selected files
The system SHALL allow the user to initiate a MusicBrainz metadata lookup from **Tag Sources → MusicBrainz…** when one or more files are selected. The system SHALL auto-construct a search query from the first selected file's existing tags. If both `artist` and `album` tags are non-empty, the query SHALL be `artist + album`. If only `artist` and `title` are non-empty, the query SHALL be `artist + title`. If neither combination is available, the query SHALL be empty.

#### Scenario: Album lookup with artist and album tags present
- **WHEN** the user selects files that have Artist="Radiohead" and Album="OK Computer" on the first file and opens Tag Sources → MusicBrainz
- **THEN** the search field SHALL be pre-filled with a query constructed from "Radiohead" and "OK Computer"

#### Scenario: Single-track lookup with artist and title only
- **WHEN** the user selects a single file with Artist="Radiohead", Title="Creep", and an empty Album tag, then opens Tag Sources → MusicBrainz
- **THEN** the search field SHALL be pre-filled with a query constructed from "Radiohead" and "Creep"

#### Scenario: No usable tags on selected file
- **WHEN** the user selects a file with no artist, album, or title tags and opens Tag Sources → MusicBrainz
- **THEN** the search field SHALL be empty and the user MUST manually enter a query

#### Scenario: No files selected
- **WHEN** the user opens Tag Sources → MusicBrainz with no files selected
- **THEN** the menu item SHALL be disabled or the system SHALL show an error indicating that files must be selected first

### Requirement: Editable search query
The system SHALL display the auto-constructed search query in an editable text field before executing the search. The user SHALL be able to modify, clear, or completely replace the query text. The search SHALL only execute when the user explicitly triggers it (e.g., pressing Enter or clicking a Search button).

#### Scenario: User modifies auto-constructed query
- **WHEN** the search field is pre-filled with "Radiohead OK Computer" and the user changes it to "Radiohead The Bends"
- **THEN** the search SHALL use the user's modified query "Radiohead The Bends"

#### Scenario: User submits empty query
- **WHEN** the user clears the search field and triggers search
- **THEN** the system SHALL show a validation message indicating that a query is required and SHALL NOT send a request to MusicBrainz

### Requirement: Search results display
The system SHALL display MusicBrainz search results in a list showing the following fields for each release: Release title, Artist, Year, Label, Format (e.g., CD, Digital Media), and Track count. The system SHALL display up to 25 results per search.

#### Scenario: Multiple results returned
- **WHEN** the user searches for "Radiohead OK Computer"
- **THEN** the results list SHALL show matching releases with title, artist, year, label, format, and track count for each entry

#### Scenario: No results found
- **WHEN** the user searches for a query that matches no releases
- **THEN** the system SHALL display a message indicating no results were found and allow the user to modify the query and search again

#### Scenario: Results list interaction
- **WHEN** the results list is displayed
- **THEN** the user SHALL be able to select exactly one release to proceed with

### Requirement: Release selection and detail fetch
When the user selects a release from the search results, the system SHALL fetch the full release details from MusicBrainz, including: all tracks across all media (discs) with their positions, recording titles, artist credits, and the release-level metadata (album title, album artist, release year, label, disc count). The system SHALL also fetch folksonomy tags for genre information.

#### Scenario: Fetch release details on selection
- **WHEN** the user clicks on a release in the results list
- **THEN** the system SHALL fetch detailed release information including the full tracklist, artist credits, and folksonomy tags from MusicBrainz

#### Scenario: Multi-disc release
- **WHEN** the selected release has multiple discs/media
- **THEN** the system SHALL retrieve tracks from all discs with correct disc numbers and track positions

### Requirement: Track-to-file mapping
The system SHALL map MusicBrainz tracks to selected files using positional matching. Selected files SHALL be sorted by their existing track number tag (with filename sort as fallback when track numbers are absent or identical). The sorted files SHALL be matched 1:1 with the MusicBrainz tracklist in disc-then-track-position order.

#### Scenario: File count matches track count
- **WHEN** 12 files are selected and the MusicBrainz release has 12 tracks
- **THEN** each file SHALL be mapped to the corresponding track by position

#### Scenario: Fewer files than tracks
- **WHEN** 8 files are selected but the MusicBrainz release has 12 tracks
- **THEN** the first 8 tracks SHALL be mapped to the 8 files, and the remaining 4 tracks SHALL be shown as unmatched in the UI

#### Scenario: More files than tracks
- **WHEN** 14 files are selected but the MusicBrainz release has 12 tracks
- **THEN** the first 12 files SHALL be mapped to the 12 tracks, and the remaining 2 files SHALL be shown as unmatched in the UI

#### Scenario: Single file selected
- **WHEN** 1 file is selected and a release is chosen
- **THEN** the system SHALL map the first track of the release to the selected file (or the track matching the file's existing track number if available)

### Requirement: Field diff with per-field checkboxes
Before applying metadata, the system SHALL display a diff table showing for each mapped file: the field name, current value, and new value from MusicBrainz. Each field row SHALL have a checkbox allowing the user to include or exclude that field from the apply operation. Checkboxes SHALL default to checked when the new value differs from the current value, and unchecked when values are identical.

#### Scenario: Diff display for a single file
- **WHEN** a file is mapped to a MusicBrainz track
- **THEN** the diff table SHALL show rows for Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, and Cover Art with current vs. new values and a checkbox per field

#### Scenario: Field values are identical
- **WHEN** the current Artist value is "Radiohead" and the MusicBrainz Artist value is also "Radiohead"
- **THEN** the checkbox for Artist SHALL default to unchecked

#### Scenario: Field values differ
- **WHEN** the current Title is "Track 01" and the MusicBrainz Title is "Airbag"
- **THEN** the checkbox for Title SHALL default to checked

#### Scenario: Select all / deselect all
- **WHEN** the diff table is displayed
- **THEN** the user SHALL be able to toggle all checkboxes on or off with a single action

#### Scenario: Multi-file album diff
- **WHEN** multiple files are mapped to a release
- **THEN** the diff SHALL show shared fields (Album, Album Artist, Year) in a summary section and per-track fields (Title, Artist, Track, Disc) grouped per file

### Requirement: Apply MusicBrainz results to files
When the user confirms the diff, the system SHALL apply the checked field values to the corresponding files in-memory. The files SHALL be marked as unsaved (following the normal save flow). Applying results SHALL count as a single undo step.

#### Scenario: Apply selected fields
- **WHEN** the user checks Title and Album but unchecks Artist, then clicks Apply
- **THEN** only Title and Album SHALL be updated on the file; Artist SHALL remain unchanged

#### Scenario: Applied changes are unsaved
- **WHEN** MusicBrainz results are applied to files
- **THEN** the files SHALL be marked as having unsaved changes (asterisk in title, per-file indicator in file list)

#### Scenario: Undo applied results
- **WHEN** the user applies MusicBrainz results and then presses Ctrl/Cmd+Z
- **THEN** all applied fields across all affected files SHALL be reverted in a single undo step

#### Scenario: User cancels diff
- **WHEN** the user clicks Cancel on the diff dialog
- **THEN** no changes SHALL be applied to any files

### Requirement: Cover art from Cover Art Archive
The system SHALL fetch cover art for the selected release from the Cover Art Archive. The cover art SHALL be displayed as a thumbnail in the diff table. If no cover art is available for the release, the system SHALL indicate this in the diff and the Cover Art checkbox SHALL be disabled.

#### Scenario: Cover art available
- **WHEN** the selected release has front cover art in the Cover Art Archive
- **THEN** the system SHALL fetch and display the cover art thumbnail in the diff, and the Cover Art checkbox SHALL be enabled

#### Scenario: Cover art not available
- **WHEN** the selected release has no cover art in the Cover Art Archive
- **THEN** the diff SHALL show "No cover art available" for the Cover Art field and the checkbox SHALL be disabled

#### Scenario: Cover art applied to files
- **WHEN** the user checks the Cover Art field and confirms
- **THEN** the cover art image SHALL be embedded into the file's tags (as JPEG or PNG) following the same format used by the existing cover art feature

### Requirement: Genre from folksonomy tags
The system SHALL populate the Genre field from MusicBrainz folksonomy tags. The system SHALL use the single highest-voted folksonomy tag as the genre value. If no folksonomy tags exist for the release, the Genre field SHALL be left unchanged and the Genre checkbox in the diff SHALL be disabled.

#### Scenario: Folksonomy tags available
- **WHEN** the selected release has folksonomy tags with "alternative rock" (50 votes) and "rock" (30 votes)
- **THEN** the Genre field in the diff SHALL show "alternative rock" as the new value

#### Scenario: No folksonomy tags
- **WHEN** the selected release has no folksonomy tags
- **THEN** the Genre checkbox in the diff SHALL be disabled and the current genre value SHALL be preserved

### Requirement: API rate limiting
The system SHALL enforce a minimum interval of 1 second between consecutive requests to MusicBrainz and Cover Art Archive endpoints. If a request would violate the rate limit, the system SHALL delay it until the interval has elapsed.

#### Scenario: Rapid sequential requests
- **WHEN** the system needs to make a search request followed immediately by a release details request
- **THEN** the second request SHALL be delayed to ensure at least 1 second has passed since the first request was sent

#### Scenario: Rate limit exceeded (503 response)
- **WHEN** MusicBrainz returns HTTP 503 with a Retry-After header
- **THEN** the system SHALL wait for the duration specified in the Retry-After header and retry the request once; if it fails again, the system SHALL surface an error to the user

### Requirement: User-Agent header
All HTTP requests to MusicBrainz and Cover Art Archive SHALL include a User-Agent header in the format `tunetag/<version>` (e.g., `tunetag/1.0.0`) as required by MusicBrainz API etiquette.

#### Scenario: User-Agent on search request
- **WHEN** the system sends a search request to MusicBrainz
- **THEN** the request SHALL include the header `User-Agent: tunetag/<version>` where `<version>` is the current application version

### Requirement: Background requests with responsive UI
All MusicBrainz and Cover Art Archive HTTP requests SHALL run in the background. The UI SHALL remain responsive during network operations. The system SHALL display a loading indicator while requests are in progress.

#### Scenario: UI responsiveness during search
- **WHEN** a search request is in progress
- **THEN** the user SHALL be able to interact with other parts of the application and the search dialog SHALL display a loading indicator

#### Scenario: User dismisses dialog during request
- **WHEN** the user closes the MusicBrainz dialog while a request is in progress
- **THEN** the in-flight request SHALL be cancelled and no results SHALL be applied

### Requirement: Network error handling
The system SHALL handle network errors gracefully. Connection failures, timeouts, and non-2xx HTTP responses (except 503 which is retried per rate limiting requirement) SHALL result in a user-visible error message within the MusicBrainz dialog. The error message SHALL suggest checking the internet connection. Core editing features SHALL remain fully functional when the network is unavailable.

#### Scenario: No internet connection
- **WHEN** the user triggers a MusicBrainz search with no internet connection
- **THEN** the system SHALL display an error message such as "Could not reach MusicBrainz. Check your internet connection." within the dialog

#### Scenario: Request timeout
- **WHEN** a MusicBrainz request does not receive a response within 15 seconds
- **THEN** the system SHALL abort the request and display a timeout error message

#### Scenario: Unexpected API error
- **WHEN** MusicBrainz returns an unexpected HTTP error (e.g., 500)
- **THEN** the system SHALL display a generic error message and allow the user to retry
