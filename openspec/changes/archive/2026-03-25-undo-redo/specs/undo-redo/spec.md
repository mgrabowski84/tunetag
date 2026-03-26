## ADDED Requirements

### Requirement: Undo reverts the last action
The system SHALL revert the most recent tag-mutating action when the user triggers Undo (Ctrl/Cmd+Z or Edit → Undo), restoring all affected files to their state before that action.

#### Scenario: Undo a single-field edit
- **WHEN** the user edits the Artist field on one file and then triggers Undo
- **THEN** the Artist field reverts to its previous value

#### Scenario: Undo a multi-file edit
- **WHEN** the user writes "Radiohead" to the Artist field on 5 selected files and then triggers Undo
- **THEN** all 5 files revert to their previous Artist values in a single undo step

#### Scenario: Undo when stack is empty
- **WHEN** the user triggers Undo and the undo stack is empty
- **THEN** nothing happens and no error is shown

### Requirement: Redo re-applies the last undone action
The system SHALL re-apply the most recently undone action when the user triggers Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y or Edit → Redo).

#### Scenario: Redo after undo
- **WHEN** the user undoes an Artist edit and then triggers Redo
- **THEN** the Artist field is set back to the value it had after the original edit

#### Scenario: Redo is cleared by a new action
- **WHEN** the user undoes an action and then performs a new edit (instead of Redo)
- **THEN** the redo stack is cleared and the undone action cannot be redone

#### Scenario: Redo when stack is empty
- **WHEN** the user triggers Redo and the redo stack is empty
- **THEN** nothing happens and no error is shown

### Requirement: Each discrete user action is one undo step
The system SHALL treat each discrete user action as a single undo step. Discrete actions include: editing a tag field, applying metadata lookup results, auto-numbering tracks, setting cover art, and removing cover art.

#### Scenario: Metadata lookup apply is one step
- **WHEN** the user applies MusicBrainz lookup results that update Title, Artist, Album, and Year on 12 files
- **THEN** a single Undo reverts all fields on all 12 files to their pre-lookup values

#### Scenario: Auto-number is one step
- **WHEN** the user runs auto-numbering on 10 files setting Track on each
- **THEN** a single Undo reverts all 10 files' Track fields to their previous values

#### Scenario: Cover art set is one step
- **WHEN** the user drags a new cover image onto 3 selected files
- **THEN** a single Undo reverts all 3 files to their previous cover art (or no cover art)

### Requirement: Stack depth is limited to 100 actions
The undo stack SHALL hold a maximum of 100 actions. When a new action is executed and the stack already contains 100 entries, the oldest entry SHALL be discarded.

#### Scenario: 101st action drops the oldest
- **WHEN** the user has performed 100 actions and performs a 101st
- **THEN** the oldest action is dropped from the undo stack and the 101st action is added
- **AND** only the 100 most recent actions are undoable

### Requirement: Undo stack is per-session and clears on close
The undo and redo stacks SHALL be cleared when files are closed (Close All, or opening a new folder that replaces the current file list). The stacks SHALL NOT persist across application restarts.

#### Scenario: Close All clears the stack
- **WHEN** the user selects File → Close All
- **THEN** both the undo and redo stacks are emptied

#### Scenario: Opening a new folder clears the stack
- **WHEN** the user opens a new folder (replacing the current file list)
- **THEN** both the undo and redo stacks are emptied

### Requirement: Saving does not clear the undo stack
The undo and redo stacks SHALL NOT be cleared when the user saves files. After saving, the user SHALL still be able to undo previous actions.

#### Scenario: Undo after save re-marks file as unsaved
- **WHEN** the user edits Artist, saves the file, and then triggers Undo
- **THEN** the Artist field reverts to its pre-edit value
- **AND** the file is marked as unsaved (because current state differs from the on-disk state)

#### Scenario: Undo and redo back to saved state clears dirty flag
- **WHEN** the user edits Artist, saves, undoes the edit, and then redoes it
- **THEN** after Redo the file is marked as saved (current state matches on-disk state)

### Requirement: Dirty-state tracking integrates with undo/redo
The system SHALL correctly update each file's unsaved/dirty indicator after every undo and redo operation by comparing the file's current in-memory tag state against its last-saved (or initially-loaded) state.

#### Scenario: Multiple edits, save, partial undo
- **WHEN** the user makes 3 edits to a file, saves, then undoes 2 of the 3 edits
- **THEN** the file is marked as unsaved (current state differs from saved state)

#### Scenario: Undo all changes on an unsaved file
- **WHEN** the user makes 3 edits to a file (without saving) and then undoes all 3
- **THEN** the file is marked as saved (current state matches the originally-loaded state)

### Requirement: Edit menu reflects undo/redo availability
The Edit menu SHALL show "Undo" and "Redo" items. Each item SHALL be disabled (greyed out) when its respective stack is empty. When enabled, the menu item SHALL include the label of the action (e.g., "Undo Edit Artist").

#### Scenario: Menu items disabled when stacks are empty
- **WHEN** no actions have been performed (or all have been undone with no redo available)
- **THEN** Edit → Undo is disabled and Edit → Redo is disabled

#### Scenario: Menu items show action label
- **WHEN** the last action was "Edit Artist on 3 files"
- **THEN** Edit → Undo displays "Undo Edit Artist on 3 files"

### Requirement: Keyboard shortcuts for undo and redo
The system SHALL support the following keyboard shortcuts for undo/redo:
- Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (macOS)
- Redo: Ctrl+Shift+Z (Windows/Linux) or Cmd+Shift+Z (macOS), and additionally Ctrl+Y (Windows/Linux)

#### Scenario: Ctrl+Z triggers undo
- **WHEN** the user presses Ctrl+Z (or Cmd+Z on macOS) and the undo stack is non-empty
- **THEN** the most recent action is undone

#### Scenario: Ctrl+Shift+Z triggers redo
- **WHEN** the user presses Ctrl+Shift+Z (or Cmd+Shift+Z on macOS) and the redo stack is non-empty
- **THEN** the most recently undone action is re-applied

#### Scenario: Ctrl+Y triggers redo on Windows/Linux
- **WHEN** the user presses Ctrl+Y on Windows or Linux and the redo stack is non-empty
- **THEN** the most recently undone action is re-applied
