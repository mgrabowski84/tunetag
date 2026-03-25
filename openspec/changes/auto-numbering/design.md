## Context

TuneTag is a cross-platform audio tag editor (Tauri v2 + React/TypeScript frontend, Rust backend). Tag edits happen in-memory on the frontend — the Rust backend is only invoked on explicit save. The PRD (§7.8) specifies an auto-numbering wizard that assigns sequential track numbers (and optionally a disc number) to selected files via a modal dialog from the Convert menu. The operation must integrate with the undo/redo stack as a single undo step.

The numbering logic is straightforward — the interesting design decisions are around the modal dialog flow, how sort order interacts with the file list, and how the operation is represented as an undoable command.

## Goals / Non-Goals

**Goals:**
- Implement the auto-numbering modal dialog with all options from the PRD: starting number, total tracks, N/Total toggle, disc number, sort order
- Show a live preview table in the dialog so users see exactly what will change before committing
- Integrate with the undo/redo system as a single reversible command
- Implement the matching `tunetag autonumber` CLI subcommand

**Non-Goals:**
- Per-file number overrides in the dialog (the wizard assigns sequential numbers; per-file editing is done in the tag panel)
- Auto-detecting disc boundaries within a selection (user provides a fixed disc number)
- Renumbering files on disk — this only writes in-memory tag values
- Track number padding or zero-fill formatting (Track field stores the raw number string, e.g., "3/12")

## Decisions

### Decision 1: Numbering algorithm

**Choice:** Given a sorted list of N files and user options (start, total, format, disc), generate an assignment list:
- For file at index `i`: track number = `start + i`
- Track value string = `"{track}/{total}"` if N/Total mode, else `"{track}"`
- If disc is provided: disc value string = `"{disc}"` (same for all files); otherwise disc is left unchanged

**Rationale:** The algorithm is intentionally simple — a linear sequence starting from a user-specified number. This matches Mp3tag's behavior and covers the vast majority of use cases (numbering one album's worth of files).

**Edge cases:**
- If start + N - 1 exceeds total (when total is provided), the preview still shows the computed numbers — total is informational and does not cap the sequence. This matches Mp3tag's behavior.
- Zero or negative start values are rejected by input validation (minimum: 1).

### Decision 2: Sort order for numbering

**Choice:** Two modes:
1. **File list order** (default): Use the current order of the selected files as displayed in the file list. This respects any user-applied column sort.
2. **By filename**: Sort selected files alphabetically by filename (lexicographic, case-insensitive) before numbering.

**Rationale:** File list order is the intuitive default — "number them in the order I see them." Filename sort is useful when files are named like `01 - Track.mp3`, `02 - Track.mp3` and the user wants to ensure numbering matches the name order regardless of the current list sort. These are the same two options Mp3tag offers.

**Implementation:** The frontend passes the selected file IDs to the dialog. The dialog either preserves the order (file list order) or re-sorts by filename. The sort happens in the dialog component before generating the preview.

### Decision 3: Single undo command for the entire operation

**Choice:** Applying auto-numbering creates a single `AutoNumberCommand` that captures the before-state (previous Track and Disc values) for every affected file and the after-state (new values). Undo restores all files to their previous Track/Disc values in one step.

**Rationale:** The PRD (§7.6) explicitly lists auto-numbering as a single undo step. The command captures per-file before/after snapshots for the Track field and, if disc was set, the Disc field. This follows the same pattern as other multi-file commands (e.g., `EditFieldCommand`).

**Command shape:**
```typescript
interface AutoNumberCommand extends Command {
  label: string;            // e.g., "Auto-number 12 tracks"
  fileIds: string[];
  before: Map<string, { track: string; disc: string }>;
  after: Map<string, { track: string; disc: string }>;
}
```

### Decision 4: Modal dialog with live preview

**Choice:** The auto-numbering dialog is a modal with form controls at the top and a preview table below. The preview updates immediately as the user changes any option (start number, total, format, disc, sort order). The table columns are: #, Filename, Current Track, New Track, and (if disc is set) Current Disc, New Disc.

**Rationale:** Live preview eliminates mistakes — the user sees exactly what will happen before clicking Apply. Recomputing the preview is trivial (iterating over N files with simple string formatting), so there is no performance concern even for large selections.

**Dialog flow:**
1. User selects files and opens Convert → Auto-number tracks…
2. Modal opens with defaults: start=1, total=selection count, format=N/Total, no disc, sort=file list order
3. User adjusts options; preview table updates live
4. User clicks OK → `AutoNumberCommand` is created and executed via the undo stack → modal closes
5. User clicks Cancel → modal closes, no changes

### Decision 5: Total tracks — auto vs. manual

**Choice:** The "Total tracks" field is auto-filled with the selection count when the dialog opens and when the start number changes. The user can manually override it. If the N/Total toggle is set to N-only, the total field is disabled (its value is irrelevant).

**Rationale:** Auto-filling from selection count is the right default for the common case (numbering one album). Manual override covers cases where the user is numbering a subset of an album (e.g., files 5–8 of a 12-track album, total should be 12 not 4).

### Decision 6: CLI subcommand design

**Choice:** The CLI subcommand mirrors the dialog options:
```
tunetag autonumber <files…> --start 1 --total 12 --disc 1 --format "n/total"
```
- `--start` (default: 1): starting track number
- `--total` (optional): total tracks; if omitted, defaults to file count
- `--disc` (optional): disc number to write
- `--format` (default: "n/total"): `"n/total"` or `"n"`
- Files are numbered in the order provided on the command line (no sort option; the shell controls ordering)
- Supports `--dry-run` to preview without writing

**Rationale:** The CLI operates on the file system directly (reads, modifies, and saves tags in one pass via lofty). There is no undo in the CLI. The `--dry-run` flag serves as the preview equivalent.

## Risks / Trade-offs

- **[Risk] File list order ambiguity** — If the user has not explicitly sorted the file list, the "file list order" is the order files were loaded (which depends on OS directory enumeration order). → Mitigation: The preview table shows exactly which file gets which number, so the user can verify before committing. The "by filename" sort option provides a deterministic alternative.

- **[Trade-off] No per-file number override** — The wizard assigns strictly sequential numbers. If a user needs to skip a number or assign non-sequential values, they must edit track numbers manually in the tag panel. This keeps the wizard simple and matches Mp3tag's behavior.

- **[Trade-off] Total does not cap the sequence** — If start=1 and total=10 but 15 files are selected, files 11–15 get tracks 11/10, 12/10, etc. This is intentional — total is metadata ("this album has 10 tracks"), not a constraint. The preview makes this visible.

- **[Risk] CLI writes immediately** — Unlike the GUI (which writes in-memory and requires explicit save), `tunetag autonumber` writes tags to disk immediately. An incorrect invocation could overwrite existing track numbers. → Mitigation: `--dry-run` flag lets users preview before committing.
