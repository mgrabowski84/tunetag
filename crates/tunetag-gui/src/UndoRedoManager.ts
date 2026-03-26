import type { TagFields } from "./types";

const MAX_STACK_DEPTH = 100;

// ---------------------------------------------------------------------------
// Editor state shape (minimal — only the tag data that commands mutate)
// ---------------------------------------------------------------------------

export interface EditorTagState {
  /** filePath → current in-memory tag edits (sparse, relative to loaded tags) */
  editedTags: Map<string, Partial<TagFields>>;
}

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

export interface Command {
  /** Human-readable label for the Edit menu (e.g. "Edit Artist on 3 files") */
  label: string;
  /** File paths (by path, matching editedTags keys) affected by this command */
  filePaths: string[];
  /** Apply (or re-apply after redo) the mutation */
  apply(state: EditorTagState): void;
  /** Reverse the mutation */
  undo(state: EditorTagState): void;
}

// ---------------------------------------------------------------------------
// UndoRedoManager
// ---------------------------------------------------------------------------

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  /** Execute a command: apply it and push onto the undo stack. Clears redo stack. */
  execute(state: EditorTagState, cmd: Command): void {
    cmd.apply(state);
    this.undoStack.push(cmd);
    // Enforce depth limit — drop oldest
    if (this.undoStack.length > MAX_STACK_DEPTH) {
      this.undoStack.shift();
    }
    // New action always clears redo stack
    this.redoStack = [];
  }

  /** Undo the last command. Returns the undone command, or null if stack is empty. */
  undo(state: EditorTagState): Command | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo(state);
    this.redoStack.push(cmd);
    return cmd;
  }

  /** Redo the last undone command. Returns the redone command, or null if stack is empty. */
  redo(state: EditorTagState): Command | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.apply(state);
    this.undoStack.push(cmd);
    return cmd;
  }

  /** Clear both stacks (on Close All / new folder load). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    const top = this.undoStack[this.undoStack.length - 1];
    return top ? top.label : null;
  }

  get redoLabel(): string | null {
    const top = this.redoStack[this.redoStack.length - 1];
    return top ? top.label : null;
  }

  get undoStackSize(): number {
    return this.undoStack.length;
  }

  get redoStackSize(): number {
    return this.redoStack.length;
  }
}

// ---------------------------------------------------------------------------
// EditFieldCommand — the main command type for tag panel edits
// ---------------------------------------------------------------------------

/**
 * Snapshot of one or more tag fields for a set of files.
 * filePath → { field → value }
 */
type FieldSnapshot = Map<string, Partial<TagFields>>;

export class EditFieldCommand implements Command {
  label: string;
  filePaths: string[];

  private before: FieldSnapshot;
  private after: FieldSnapshot;

  constructor(params: {
    label: string;
    filePaths: string[];
    before: FieldSnapshot;
    after: FieldSnapshot;
  }) {
    this.label = params.label;
    this.filePaths = params.filePaths;
    this.before = params.before;
    this.after = params.after;
  }

  apply(state: EditorTagState): void {
    for (const [path, fields] of this.after) {
      const existing = state.editedTags.get(path) ?? {};
      state.editedTags.set(path, { ...existing, ...fields });
    }
  }

  undo(state: EditorTagState): void {
    for (const [path, fields] of this.before) {
      if (Object.keys(fields).length === 0) {
        // No edits existed before — remove the entry entirely
        state.editedTags.delete(path);
      } else {
        const existing = state.editedTags.get(path) ?? {};
        state.editedTags.set(path, { ...existing, ...fields });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: create a snapshot of specific fields from editedTags + loaded values
// ---------------------------------------------------------------------------

/**
 * Capture the current values of `changedFields` for each file path.
 * `getEffective` should return the current effective value for a field.
 */
export function captureSnapshot(
  filePaths: string[],
  changedFields: (keyof TagFields)[],
  getEffective: (path: string, field: keyof TagFields) => string,
): FieldSnapshot {
  const snapshot: FieldSnapshot = new Map();
  for (const path of filePaths) {
    const fields: Partial<TagFields> = {};
    for (const field of changedFields) {
      fields[field] = getEffective(path, field);
    }
    snapshot.set(path, fields);
  }
  return snapshot;
}
