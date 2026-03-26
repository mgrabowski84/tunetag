import { describe, it, expect, beforeEach } from "vitest";
import {
  UndoRedoManager,
  EditFieldCommand,
  captureSnapshot,
} from "./UndoRedoManager";
import type { EditorTagState } from "./UndoRedoManager";
import type { TagFields } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<EditorTagState>): EditorTagState {
  return {
    editedTags: new Map(),
    ...overrides,
  };
}

function makeEditCmd(
  path: string,
  field: keyof TagFields,
  before: string,
  after: string,
): EditFieldCommand {
  const beforeSnap = new Map([[path, { [field]: before } as Partial<TagFields>]]);
  const afterSnap = new Map([[path, { [field]: after } as Partial<TagFields>]]);
  return new EditFieldCommand({
    label: `Edit ${field}`,
    filePaths: [path],
    before: beforeSnap,
    after: afterSnap,
  });
}

// ---------------------------------------------------------------------------
// 7.1: UndoRedoManager core operations
// ---------------------------------------------------------------------------

describe("UndoRedoManager", () => {
  let manager: UndoRedoManager;
  let state: EditorTagState;

  beforeEach(() => {
    manager = new UndoRedoManager();
    state = makeState();
  });

  it("execute applies the command and pushes to undo stack", () => {
    const cmd = makeEditCmd("/a.mp3", "artist", "", "Radiohead");
    manager.execute(state, cmd);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("Radiohead");
    expect(manager.canUndo).toBe(true);
    expect(manager.canRedo).toBe(false);
  });

  it("undo reverses the command and pushes to redo stack", () => {
    const cmd = makeEditCmd("/a.mp3", "artist", "", "Radiohead");
    manager.execute(state, cmd);
    manager.undo(state);
    // After undo: artist should revert to ""
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("");
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(true);
  });

  it("redo re-applies the command", () => {
    const cmd = makeEditCmd("/a.mp3", "artist", "", "Radiohead");
    manager.execute(state, cmd);
    manager.undo(state);
    manager.redo(state);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("Radiohead");
    expect(manager.canUndo).toBe(true);
    expect(manager.canRedo).toBe(false);
  });

  it("execute clears the redo stack", () => {
    const cmd1 = makeEditCmd("/a.mp3", "artist", "", "A");
    const cmd2 = makeEditCmd("/a.mp3", "artist", "A", "B");
    manager.execute(state, cmd1);
    manager.undo(state);
    expect(manager.canRedo).toBe(true);
    manager.execute(state, cmd2);
    expect(manager.canRedo).toBe(false);
  });

  it("enforces 100-action stack depth limit", () => {
    for (let i = 0; i < 105; i++) {
      manager.execute(state, makeEditCmd("/a.mp3", "title", "", `Title ${i}`));
    }
    expect(manager.undoStackSize).toBe(100);
  });

  it("clear empties both stacks", () => {
    manager.execute(state, makeEditCmd("/a.mp3", "artist", "", "X"));
    manager.undo(state);
    manager.clear();
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(false);
  });

  it("shows undo/redo labels", () => {
    const cmd = makeEditCmd("/a.mp3", "artist", "", "Radiohead");
    manager.execute(state, cmd);
    expect(manager.undoLabel).toBe("Edit artist");
    manager.undo(state);
    expect(manager.redoLabel).toBe("Edit artist");
  });

  it("undo returns null on empty stack", () => {
    const result = manager.undo(state);
    expect(result).toBeNull();
  });

  it("redo returns null on empty stack", () => {
    const result = manager.redo(state);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7.2: EditFieldCommand apply/undo
// ---------------------------------------------------------------------------

describe("EditFieldCommand", () => {
  it("apply sets the after-snapshot values", () => {
    const state = makeState();
    const cmd = makeEditCmd("/a.mp3", "artist", "", "Radiohead");
    cmd.apply(state);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("Radiohead");
  });

  it("undo restores the before-snapshot values", () => {
    const state = makeState();
    const cmd = makeEditCmd("/a.mp3", "artist", "Original", "New");
    cmd.apply(state);
    cmd.undo(state);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("Original");
  });

  it("undo removes the entry when before-snapshot was empty", () => {
    const state = makeState();
    // Before had no edits
    const before = new Map([["/a.mp3", {} as Partial<TagFields>]]);
    const after = new Map([["/a.mp3", { artist: "New" } as Partial<TagFields>]]);
    const cmd = new EditFieldCommand({ label: "Edit artist", filePaths: ["/a.mp3"], before, after });
    cmd.apply(state);
    expect(state.editedTags.has("/a.mp3")).toBe(true);
    cmd.undo(state);
    expect(state.editedTags.has("/a.mp3")).toBe(false);
  });

  it("applies to multiple files (single undo step)", () => {
    const state = makeState();
    const before = new Map([
      ["/a.mp3", { artist: "" } as Partial<TagFields>],
      ["/b.mp3", { artist: "" } as Partial<TagFields>],
    ]);
    const after = new Map([
      ["/a.mp3", { artist: "Radiohead" } as Partial<TagFields>],
      ["/b.mp3", { artist: "Radiohead" } as Partial<TagFields>],
    ]);
    const cmd = new EditFieldCommand({
      label: "Edit artist on 2 files",
      filePaths: ["/a.mp3", "/b.mp3"],
      before,
      after,
    });
    cmd.apply(state);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("Radiohead");
    expect(state.editedTags.get("/b.mp3")?.artist).toBe("Radiohead");

    cmd.undo(state);
    expect(state.editedTags.get("/a.mp3")?.artist).toBe("");
    expect(state.editedTags.get("/b.mp3")?.artist).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 7.4: Multi-file edit is a single undo step
// ---------------------------------------------------------------------------

describe("Multi-file undo step", () => {
  it("editing 50 files counts as one undo step", () => {
    const manager = new UndoRedoManager();
    const state = makeState();

    const paths = Array.from({ length: 50 }, (_, i) => `/file${i}.mp3`);
    const before = new Map(paths.map((p) => [p, { artist: "" } as Partial<TagFields>]));
    const after = new Map(paths.map((p) => [p, { artist: "Radiohead" } as Partial<TagFields>]));
    const cmd = new EditFieldCommand({ label: "Edit artist on 50 files", filePaths: paths, before, after });

    manager.execute(state, cmd);
    expect(manager.undoStackSize).toBe(1);

    manager.undo(state);
    expect(manager.undoStackSize).toBe(0);
    for (const p of paths) {
      expect(state.editedTags.get(p)?.artist).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// captureSnapshot helper
// ---------------------------------------------------------------------------

describe("captureSnapshot", () => {
  it("captures current values from a getter", () => {
    const paths = ["/a.mp3", "/b.mp3"];
    const values: Record<string, string> = { "/a.mp3": "Rock", "/b.mp3": "Jazz" };
    const snap = captureSnapshot(paths, ["genre"], (path) => values[path] ?? "");
    expect(snap.get("/a.mp3")?.genre).toBe("Rock");
    expect(snap.get("/b.mp3")?.genre).toBe("Jazz");
  });
});
