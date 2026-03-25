## ADDED Requirements

### Requirement: Display loaded files in a table
The system SHALL display all loaded files in a column-based table in the main content area. Each row SHALL represent one loaded file. Each column SHALL display a specific metadata field or computed value.

#### Scenario: Files are loaded and displayed
- **WHEN** files are loaded via Open Files, Open Folder, or drag-and-drop
- **THEN** each file appears as a row in the table with its metadata displayed in the corresponding columns

#### Scenario: No files loaded
- **WHEN** no files have been loaded
- **THEN** the table area is empty or shows a placeholder message

### Requirement: Default columns
The system SHALL display the following columns by default, in this order: # (row number), Filename, Title, Artist, Album, Year, Track, Genre, Format.

#### Scenario: Fresh application start with default columns
- **WHEN** the application starts for the first time with no saved column configuration
- **THEN** the table displays columns in this order: #, Filename, Title, Artist, Album, Year, Track, Genre, Format

### Requirement: Column sorting by header click
The system SHALL allow sorting the file list by clicking a column header. The first click SHALL sort the column in ascending order. A second click on the same column SHALL reverse the sort to descending order. The # (row number) column SHALL reflect the current display position after sorting. Only one column SHALL be the active sort column at a time.

#### Scenario: Sort by artist ascending
- **WHEN** user clicks the "Artist" column header
- **THEN** the file list is sorted by artist name in ascending (A-Z) order

#### Scenario: Sort by artist descending
- **WHEN** user clicks the "Artist" column header while it is already sorted ascending
- **THEN** the file list is sorted by artist name in descending (Z-A) order

#### Scenario: Switch sort column
- **WHEN** the file list is sorted by Artist and user clicks the "Album" column header
- **THEN** the file list is sorted by album name in ascending order

#### Scenario: Row numbers update after sort
- **WHEN** the file list is sorted by any column
- **THEN** the # column shows sequential numbers (1, 2, 3, ...) matching the current display order

### Requirement: Column customization via context menu
The system SHALL allow the user to add or remove columns by right-clicking any column header. The context menu SHALL display a list of all available columns (all tag fields and audio properties) with checkboxes indicating which are currently visible. Toggling a checkbox SHALL immediately show or hide that column.

#### Scenario: Add a column
- **WHEN** user right-clicks a column header and checks "Bitrate" in the context menu
- **THEN** the Bitrate column appears in the table

#### Scenario: Remove a column
- **WHEN** user right-clicks a column header and unchecks "Genre" in the context menu
- **THEN** the Genre column is removed from the table

#### Scenario: Available column options
- **WHEN** user right-clicks a column header
- **THEN** the context menu lists all possible columns including: Filename, Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Comment, Format, Duration, Bitrate, Sample Rate, Channels

### Requirement: Any tag field or audio property as a column
The system SHALL support adding any tag field (title, artist, album, album artist, year, track, disc, genre, comment) or audio property (format, duration, bitrate, sample rate, channels) as a table column.

#### Scenario: Audio property column
- **WHEN** user adds "Duration" as a column
- **THEN** the table displays a Duration column showing the duration of each file

#### Scenario: Tag field column
- **WHEN** user adds "Album Artist" as a column
- **THEN** the table displays an Album Artist column showing the album artist tag of each file

### Requirement: Column reorder via drag
The system SHALL allow the user to reorder columns by dragging a column header to a new position. The # column SHALL always remain in the first position and SHALL NOT be draggable.

#### Scenario: Drag column to new position
- **WHEN** user drags the "Album" column header and drops it between "Filename" and "Title"
- **THEN** the column order updates to show Album between Filename and Title

#### Scenario: Row number column is fixed
- **WHEN** user attempts to drag the # column
- **THEN** the # column remains in the first position and cannot be moved

### Requirement: Column settings persist across sessions
The system SHALL save the current column configuration (which columns are visible, their order, and their widths) when any column setting changes. The system SHALL restore the saved column configuration when the application starts. If no saved configuration exists, the system SHALL use the default columns.

#### Scenario: Column settings are restored on restart
- **WHEN** user customizes columns (adds Bitrate, removes Genre, reorders), closes the app, and reopens it
- **THEN** the table displays the previously saved column configuration

#### Scenario: Fallback to defaults on missing config
- **WHEN** the application starts and no column configuration file exists or it is corrupted
- **THEN** the table displays the default columns: #, Filename, Title, Artist, Album, Year, Track, Genre, Format

### Requirement: Performance with large file lists
The system SHALL use virtualized rendering so that only visible rows (plus a small overscan buffer) are rendered in the DOM. The table SHALL handle 1,000+ files without degraded scrolling performance or UI jank.

#### Scenario: Scrolling through 1,000 files
- **WHEN** user loads 1,000 audio files and scrolls through the file list
- **THEN** scrolling is smooth with no visible lag or frame drops

#### Scenario: DOM node count stays bounded
- **WHEN** 1,000 files are loaded
- **THEN** the number of rendered table rows in the DOM does not exceed the visible rows plus a reasonable overscan buffer (not all 1,000 rows)
