import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TagFields, TagEditState, TagFieldKey } from "./types";
import {
  UndoRedoManager,
  EditFieldCommand,
  captureSnapshot,
} from "./UndoRedoManager";
import type { EditorTagState } from "./UndoRedoManager";

// ---------------------------------------------------------------------------
// Reducer actions
// ---------------------------------------------------------------------------

type TagEditAction =
  | { type: "APPLY_EDITOR_STATE"; editorState: EditorTagState }
  | { type: "CLEAR_EDITS"; paths: string[] }
  | { type: "CLEAR_ALL_EDITS" };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FullTagEditState extends TagEditState {
  /** Saved snapshots: filePath → tag fields at last save (or initial load) */
  savedSnapshots: Map<string, Partial<TagFields>>;
}

function reducer(
  state: FullTagEditState,
  action: TagEditAction,
): FullTagEditState {
  switch (action.type) {
    case "APPLY_EDITOR_STATE":
      return {
        ...state,
        editedTags: new Map(action.editorState.editedTags),
      };
    case "CLEAR_EDITS": {
      const next = new Map(state.editedTags);
      const savedNext = new Map(state.savedSnapshots);
      for (const path of action.paths) {
        // On save: clear edits and record the saved snapshot
        const edits = next.get(path);
        if (edits) savedNext.set(path, { ...edits });
        next.delete(path);
      }
      return { editedTags: next, savedSnapshots: savedNext };
    }
    case "CLEAR_ALL_EDITS":
      return { editedTags: new Map(), savedSnapshots: new Map() };
  }
}

const initialState: FullTagEditState = {
  editedTags: new Map(),
  savedSnapshots: new Map(),
};

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface TagEditContextValue {
  state: TagEditState;
  setField: (paths: string[], field: TagFieldKey, value: string) => void;
  clearEdits: (paths: string[]) => void;
  clearAllEdits: () => void;
  getEffectiveFields: (path: string, loaded: TagFields) => TagFields;
  getMergedFields: (
    entries: { path: string; loaded: TagFields }[],
  ) => Record<TagFieldKey, string>;
  isDirty: boolean;
  dirtyCount: number;
  dirtyPaths: Set<string>;
  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undo: () => void;
  redo: () => void;
}

const TagEditContext = createContext<TagEditContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TagEditProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // UndoRedoManager is mutable — use a ref to avoid re-creating on each render
  const managerRef = useRef(new UndoRedoManager());

  // Force re-render when stacks change (manager is mutated in-place)
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // ------------------------------------------------------------------
  // setField — goes through the undo/redo manager
  // ------------------------------------------------------------------
  const setField = useCallback(
    (paths: string[], field: TagFieldKey, value: string) => {
      const manager = managerRef.current;
      const currentEditedTags = new Map(state.editedTags);

      // Capture before snapshot for affected paths+field
      const beforeSnapshot = captureSnapshot(paths, [field], (path, f) => {
        const edits = currentEditedTags.get(path);
        return (edits?.[f] as string) ?? "";
      });

      // After snapshot
      const afterSnapshot = new Map(
        paths.map((p) => [p, { [field]: value } as Partial<TagFields>]),
      );

      const fieldLabel =
        field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1");
      const label =
        paths.length === 1
          ? `Edit ${fieldLabel}`
          : `Edit ${fieldLabel} on ${paths.length} files`;

      const cmd = new EditFieldCommand({
        label,
        filePaths: paths,
        before: beforeSnapshot,
        after: afterSnapshot,
      });

      // Build mutable editor state for the manager to mutate
      const editorState: EditorTagState = { editedTags: currentEditedTags };
      manager.execute(editorState, cmd);

      dispatch({ type: "APPLY_EDITOR_STATE", editorState });
      refresh();
    },
    [state.editedTags, refresh],
  );

  // ------------------------------------------------------------------
  // undo / redo
  // ------------------------------------------------------------------
  const undo = useCallback(() => {
    const manager = managerRef.current;
    if (!manager.canUndo) return;

    const editorState: EditorTagState = {
      editedTags: new Map(state.editedTags),
    };
    manager.undo(editorState);
    dispatch({ type: "APPLY_EDITOR_STATE", editorState });
    refresh();
  }, [state.editedTags, refresh]);

  const redo = useCallback(() => {
    const manager = managerRef.current;
    if (!manager.canRedo) return;

    const editorState: EditorTagState = {
      editedTags: new Map(state.editedTags),
    };
    manager.redo(editorState);
    dispatch({ type: "APPLY_EDITOR_STATE", editorState });
    refresh();
  }, [state.editedTags, refresh]);

  // ------------------------------------------------------------------
  // clearEdits (after save) and clearAllEdits (Close All / new folder)
  // ------------------------------------------------------------------
  const clearEdits = useCallback((paths: string[]) => {
    dispatch({ type: "CLEAR_EDITS", paths });
    // Don't clear undo stack on save — PRD requirement
  }, []);

  const clearAllEdits = useCallback(() => {
    dispatch({ type: "CLEAR_ALL_EDITS" });
    managerRef.current.clear();
    refresh();
  }, [refresh]);

  // ------------------------------------------------------------------
  // Derived helpers
  // ------------------------------------------------------------------
  const getEffectiveFields = useCallback(
    (path: string, loaded: TagFields): TagFields => {
      const edits = state.editedTags.get(path);
      if (!edits) return loaded;
      return { ...loaded, ...edits };
    },
    [state.editedTags],
  );

  const getMergedFields = useCallback(
    (
      entries: { path: string; loaded: TagFields }[],
    ): Record<TagFieldKey, string> => {
      if (entries.length === 0) {
        return {
          title: "",
          artist: "",
          album: "",
          albumArtist: "",
          year: "",
          track: "",
          disc: "",
          genre: "",
          comment: "",
        };
      }

      const fields: TagFieldKey[] = [
        "title",
        "artist",
        "album",
        "albumArtist",
        "year",
        "track",
        "disc",
        "genre",
        "comment",
      ];

      const result = {} as Record<TagFieldKey, string>;

      for (const field of fields) {
        const values = entries.map(({ path, loaded }) => {
          const edits = state.editedTags.get(path);
          if (edits && field in edits) return edits[field] as string;
          return loaded[field];
        });

        const first = values[0];
        const allSame = values.every((v) => v === first);
        result[field] = allSame ? first : "<keep>";
      }

      return result;
    },
    [state.editedTags],
  );

  const dirtyPaths = new Set(state.editedTags.keys());
  const isDirty = dirtyPaths.size > 0;
  const dirtyCount = dirtyPaths.size;

  const manager = managerRef.current;

  return (
    <TagEditContext.Provider
      value={{
        state,
        setField,
        clearEdits,
        clearAllEdits,
        getEffectiveFields,
        getMergedFields,
        isDirty,
        dirtyCount,
        dirtyPaths,
        canUndo: manager.canUndo,
        canRedo: manager.canRedo,
        undoLabel: manager.undoLabel,
        redoLabel: manager.redoLabel,
        undo,
        redo,
      }}
    >
      {children}
    </TagEditContext.Provider>
  );
}

export function useTagEdit(): TagEditContextValue {
  const ctx = useContext(TagEditContext);
  if (!ctx) throw new Error("useTagEdit must be used within TagEditProvider");
  return ctx;
}
