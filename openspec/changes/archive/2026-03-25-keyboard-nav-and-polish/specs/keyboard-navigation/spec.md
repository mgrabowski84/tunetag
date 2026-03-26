## ADDED Requirements

### Requirement: Arrow key navigation
The file list SHALL move the cursor and selection by one row when Arrow Up or Arrow Down is pressed while the file list is focused. Arrow Up SHALL move to the previous row; Arrow Down SHALL move to the next row. If the cursor is at the first row, Arrow Up SHALL have no effect. If the cursor is at the last row, Arrow Down SHALL have no effect. The newly focused row SHALL be scrolled into view if it is not already visible.

#### Scenario: Arrow Down moves cursor to next row
- **WHEN** the file list is focused and the cursor is on row 3 of 10
- **THEN** pressing Arrow Down moves the cursor and selection to row 4, and row 4 is scrolled into view if necessary

#### Scenario: Arrow Up moves cursor to previous row
- **WHEN** the file list is focused and the cursor is on row 5
- **THEN** pressing Arrow Up moves the cursor and selection to row 4

#### Scenario: Arrow Up at first row has no effect
- **WHEN** the file list is focused and the cursor is on row 1
- **THEN** pressing Arrow Up does nothing; the cursor remains on row 1

#### Scenario: Arrow Down at last row has no effect
- **WHEN** the file list is focused and the cursor is on the last row
- **THEN** pressing Arrow Down does nothing; the cursor remains on the last row

### Requirement: Shift+Arrow extends selection range
The file list SHALL extend the selection range when Shift+Arrow Up or Shift+Arrow Down is pressed. The anchor point SHALL be set on the first Shift+Arrow press (the row where Shift was first held). Subsequent Shift+Arrow presses SHALL select all rows between the anchor and the current cursor position (inclusive). Releasing Shift and pressing Arrow without Shift SHALL reset the anchor and selection to the new cursor position.

#### Scenario: Shift+Down extends selection downward
- **WHEN** the cursor is on row 3 and Shift+Arrow Down is pressed twice
- **THEN** rows 3, 4, and 5 are selected, with the cursor on row 5 and the anchor on row 3

#### Scenario: Shift+Up extends selection upward
- **WHEN** the cursor is on row 5 and Shift+Arrow Up is pressed twice
- **THEN** rows 3, 4, and 5 are selected, with the cursor on row 3 and the anchor on row 5

#### Scenario: Arrow without Shift resets to single selection
- **WHEN** rows 3–5 are selected via Shift+Arrow and Arrow Down is pressed without Shift
- **THEN** only row 6 is selected, and the anchor is reset

### Requirement: Home and End navigation
The file list SHALL move the cursor and selection to the first row when Home is pressed and to the last row when End is pressed. The target row SHALL be scrolled into view.

#### Scenario: Home jumps to first row
- **WHEN** the file list is focused and the cursor is on row 50
- **THEN** pressing Home moves the cursor and selection to row 1, scrolling to the top

#### Scenario: End jumps to last row
- **WHEN** the file list is focused and the cursor is on row 1 and there are 100 files loaded
- **THEN** pressing End moves the cursor and selection to row 100, scrolling to the bottom

### Requirement: Page Up and Page Down navigation
The file list SHALL move the cursor by one visible page height when Page Up or Page Down is pressed. The page size SHALL be calculated as the number of fully visible rows in the file list viewport. If fewer rows remain than a full page, the cursor SHALL move to the first row (Page Up) or last row (Page Down).

#### Scenario: Page Down moves cursor by one page
- **WHEN** the file list shows 20 rows per page and the cursor is on row 5
- **THEN** pressing Page Down moves the cursor and selection to row 25

#### Scenario: Page Down near end of list clamps to last row
- **WHEN** the file list shows 20 rows per page, the cursor is on row 90, and there are 100 files
- **THEN** pressing Page Down moves the cursor and selection to row 100

#### Scenario: Page Up near start of list clamps to first row
- **WHEN** the file list shows 20 rows per page and the cursor is on row 10
- **THEN** pressing Page Up moves the cursor and selection to row 1

### Requirement: Tab focus management
Pressing Tab while the file list is focused SHALL move focus to the tag panel. Pressing Tab (or Shift+Tab cycling back) from the tag panel SHALL return focus to the file list. The file list and tag panel SHALL be the only two top-level tab stops for this focus cycle.

#### Scenario: Tab from file list to tag panel
- **WHEN** the file list is focused and Tab is pressed
- **THEN** focus moves to the first input field in the tag panel

#### Scenario: Tab back to file list from tag panel
- **WHEN** the tag panel is focused and Shift+Tab is pressed on the first field (or Tab on the last field wraps)
- **THEN** focus returns to the file list container, and keyboard navigation resumes from the current cursor position

### Requirement: Enter begins editing in tag panel
Pressing Enter while the file list is focused and at least one file is selected SHALL move focus to the tag panel and place the cursor in the first editable field (Title). If no files are selected, Enter SHALL have no effect.

#### Scenario: Enter with selection moves focus to tag panel
- **WHEN** the file list is focused and one or more files are selected
- **THEN** pressing Enter moves focus to the Title field in the tag panel

#### Scenario: Enter with no selection has no effect
- **WHEN** the file list is focused and no files are selected
- **THEN** pressing Enter does nothing

### Requirement: Type-to-jump
When the file list is focused and a printable character is typed without modifier keys (Ctrl, Cmd, Alt), the character SHALL be appended to a prefix buffer. The file list SHALL jump the cursor and selection to the first filename that starts with the accumulated prefix (case-insensitive match). The prefix buffer SHALL reset to empty after 1 second of no typing. If no filename matches the prefix, the cursor SHALL not move.

#### Scenario: Single character jumps to first match
- **WHEN** the file list is focused and the user types "r"
- **THEN** the cursor jumps to the first filename starting with "r" (case-insensitive)

#### Scenario: Multiple characters refine the prefix
- **WHEN** the user types "r" then "a" within 1 second
- **THEN** the cursor jumps to the first filename starting with "ra"

#### Scenario: Prefix resets after 1 second of inactivity
- **WHEN** the user types "r", waits 2 seconds, then types "b"
- **THEN** the prefix is "b" (not "rb"), and the cursor jumps to the first filename starting with "b"

#### Scenario: No match leaves cursor unchanged
- **WHEN** the user types "zzz" and no filename starts with "zzz"
- **THEN** the cursor remains on its current row

#### Scenario: Modifier keys do not trigger type-to-jump
- **WHEN** the user presses Ctrl+S while the file list is focused
- **THEN** the type-to-jump buffer is not modified, and the Ctrl+S shortcut is handled normally

### Requirement: Scroll into view on cursor movement
Any action that moves the cursor (Arrow, Shift+Arrow, Home, End, Page Up, Page Down, type-to-jump) SHALL scroll the file list so that the cursor row is visible. Scrolling SHALL use nearest-edge behavior — the list SHALL scroll the minimum amount necessary to make the cursor row fully visible.

#### Scenario: Cursor moves below visible area
- **WHEN** the cursor moves to a row that is below the visible scroll area
- **THEN** the file list scrolls down so the cursor row is at the bottom edge of the visible area

#### Scenario: Cursor is already visible
- **WHEN** the cursor moves to a row that is already within the visible scroll area
- **THEN** the file list does not scroll
