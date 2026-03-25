import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type { TagFields, TagEditState, TagFieldKey } from "./types";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type TagEditAction =
  | {
      type: "SET_FIELD";
      /** File paths to apply the edit to (all selected files). */
      paths: string[];
      field: TagFieldKey;
      value: string;
    }
  | {
      type: "CLEAR_EDITS";
      /** File paths to clear from editedTags (after successful save). */
      paths: string[];
    }
  | { type: "CLEAR_ALL_EDITS" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: TagEditState, action: TagEditAction): TagEditState {
  switch (action.type) {
    case "SET_FIELD": {
      const next = new Map(state.editedTags);
      for (const path of action.paths) {
        const existing = next.get(path) ?? {};
        next.set(path, { ...existing, [action.field]: action.value });
      }
      return { editedTags: next };
    }
    case "CLEAR_EDITS": {
      const next = new Map(state.editedTags);
      for (const path of action.paths) {
        next.delete(path);
      }
      return { editedTags: next };
    }
    case "CLEAR_ALL_EDITS":
      return { editedTags: new Map() };
  }
}

const initialState: TagEditState = {
  editedTags: new Map(),
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TagEditContextValue {
  state: TagEditState;
  setField: (paths: string[], field: TagFieldKey, value: string) => void;
  clearEdits: (paths: string[]) => void;
  clearAllEdits: () => void;
  /** Derive the effective tag fields for a single file (edits override loaded). */
  getEffectiveFields: (path: string, loaded: TagFields) => TagFields;
  /** Compute merged view for multiple selected files. */
  getMergedFields: (
    entries: { path: string; loaded: TagFields }[],
  ) => Record<TagFieldKey, string>;
  /** True if any file has pending edits. */
  isDirty: boolean;
  /** Number of files with pending edits. */
  dirtyCount: number;
  /** Set of dirty file paths. */
  dirtyPaths: Set<string>;
}

const TagEditContext = createContext<TagEditContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TagEditProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setField = useCallback(
    (paths: string[], field: TagFieldKey, value: string) => {
      dispatch({ type: "SET_FIELD", paths, field, value });
    },
    [],
  );

  const clearEdits = useCallback((paths: string[]) => {
    dispatch({ type: "CLEAR_EDITS", paths });
  }, []);

  const clearAllEdits = useCallback(() => {
    dispatch({ type: "CLEAR_ALL_EDITS" });
  }, []);

  const getEffectiveFields = useCallback(
    (path: string, loaded: TagFields): TagFields => {
      const edits = state.editedTags.get(path);
      if (!edits) return loaded;
      return { ...loaded, ...edits };
    },
    [state.editedTags],
  );

  const getMergedFields = useCallback(
    (entries: { path: string; loaded: TagFields }[]): Record<TagFieldKey, string> => {
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
        // Get effective value for each file
        const values = entries.map(({ path, loaded }) => {
          const edits = state.editedTags.get(path);
          // If the user has explicitly edited this field, use the edited value
          if (edits && field in edits) {
            return edits[field] as string;
          }
          return loaded[field];
        });

        // If all values are the same → show it; if differ → show <keep>
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
