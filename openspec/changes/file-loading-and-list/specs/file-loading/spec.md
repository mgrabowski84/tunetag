## ADDED Requirements

### Requirement: Open individual files via dialog
The system SHALL provide a File > Open Files menu item (Ctrl+O) that opens a native file dialog allowing the user to select one or more audio files. Only supported formats (MP3, FLAC, M4A) SHALL be shown in the dialog filter. Selected files SHALL be scanned for tags and audio properties and added to the file list.

#### Scenario: User opens files via menu
- **WHEN** user selects File > Open Files and picks one or more supported audio files
- **THEN** the system reads tags and audio properties from each file and adds them to the file list

#### Scenario: User cancels the file dialog
- **WHEN** user opens File > Open Files and cancels the dialog without selecting any files
- **THEN** the file list remains unchanged

### Requirement: Open folder via dialog
The system SHALL provide a File > Open Folder menu item (Ctrl+Shift+O) that opens a native folder selection dialog. All supported audio files in the selected folder SHALL be scanned and added to the file list. If the recursive subfolder toggle is enabled, subfolders SHALL be scanned recursively.

#### Scenario: User opens a folder non-recursively
- **WHEN** user selects File > Open Folder, picks a folder, and recursive mode is OFF
- **THEN** the system scans only the top-level directory for supported files and adds them to the file list

#### Scenario: User opens a folder recursively
- **WHEN** user selects File > Open Folder, picks a folder, and recursive mode is ON
- **THEN** the system scans the directory and all subfolders for supported files and adds them to the file list

### Requirement: Drag-and-drop files and folders
The system SHALL accept files and folders dropped onto the application window. Dropped files SHALL be filtered to supported formats. Dropped folders SHALL be scanned according to the current recursive toggle setting. Resulting files SHALL be added to the file list.

#### Scenario: User drops audio files onto the app
- **WHEN** user drags and drops one or more supported audio files onto the application window
- **THEN** the system reads their tags and audio properties and adds them to the file list

#### Scenario: User drops a folder onto the app
- **WHEN** user drags and drops a folder onto the application window
- **THEN** the system scans the folder (respecting the recursive toggle) and adds all supported files to the file list

#### Scenario: User drops unsupported files
- **WHEN** user drags and drops files with unsupported extensions (e.g., .txt, .wav)
- **THEN** the unsupported files are silently ignored and only supported files are added

### Requirement: Recursive subfolder toggle
The system SHALL provide a toggle in the View menu to enable or disable recursive subfolder scanning. When enabled, all folder-based operations (Open Folder, drag-and-drop of folders) SHALL scan subfolders recursively. When disabled, only the top-level directory SHALL be scanned.

#### Scenario: Toggle recursive mode on
- **WHEN** user enables the recursive subfolder toggle in the View menu
- **THEN** subsequent folder open and folder drop operations scan all subfolders

#### Scenario: Toggle recursive mode off
- **WHEN** user disables the recursive subfolder toggle in the View menu
- **THEN** subsequent folder open and folder drop operations scan only the top-level directory

### Requirement: Supported format filtering
The system SHALL only load files with the extensions `.mp3`, `.flac`, or `.m4a` (case-insensitive). Files with any other extension SHALL be skipped during scanning.

#### Scenario: Mixed folder with supported and unsupported files
- **WHEN** the system scans a folder containing MP3, FLAC, M4A, and other file types (e.g., .jpg, .txt, .wav)
- **THEN** only .mp3, .flac, and .m4a files are loaded; all other files are ignored

#### Scenario: Case-insensitive extension matching
- **WHEN** the system encounters files with extensions like .MP3, .Flac, or .M4A
- **THEN** the files are recognized as supported and loaded normally

### Requirement: Read tags and audio properties on load
The system SHALL read tag metadata (title, artist, album, album artist, year, track, disc, genre, comment) and audio properties (duration, bitrate, sample rate, channels) from each file when it is loaded. The reading SHALL use the lofty crate. If a file cannot be read (corrupted or unreadable), it SHALL be skipped and not added to the file list.

#### Scenario: File with complete tags
- **WHEN** the system loads an MP3 file that has title, artist, album, year, track, and genre tags set
- **THEN** all tag values and audio properties are read and available for display

#### Scenario: File with missing tags
- **WHEN** the system loads a file that has no tags set
- **THEN** the file is loaded with empty/null tag fields; audio properties (duration, bitrate, etc.) are still read from the audio stream

#### Scenario: Corrupted or unreadable file
- **WHEN** the system attempts to load a file that cannot be parsed by lofty
- **THEN** the file is skipped and not added to the file list; no error dialog is shown to the user

### Requirement: Replace file list on new open
The system SHALL replace the current file list when a new Open Files or Open Folder operation is performed. Previously loaded files SHALL be cleared. Drag-and-drop SHALL also replace the current list.

#### Scenario: Opening new folder replaces existing files
- **WHEN** the file list contains files from a previous load and the user opens a new folder
- **THEN** the previous files are removed and only files from the new folder are displayed
