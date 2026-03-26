import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type { FileEntry, SortConfig } from "./types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FilesState {
  /** All loaded files keyed by id. */
  files: Map<string, FileEntry>;
  /** Sorted list of file IDs for display order. */
  sortedIds: string[];
  /** Current sort configuration. */
  sort: SortConfig | null;
  /** Currently selected file IDs. */
  selectedIds: Set<string>;
  /** Whether to scan folders recursively. */
  recursive: boolean;
}

const initialState: FilesState = {
  files: new Map(),
  sortedIds: [],
  sort: null,
  selectedIds: new Set(),
  recursive: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type FilesAction =
  | { type: "SET_FILES"; payload: FileEntry[] }
  | { type: "SET_SORT"; payload: SortConfig | null }
  | { type: "SELECT"; payload: { id: string; ctrl: boolean; shift: boolean } }
  | { type: "SELECT_ALL" }
  | { type: "CLEAR_SELECTION" }
  | { type: "TOGGLE_RECURSIVE" }
  | { type: "UPDATE_PATHS"; payload: Record<string, string> }; // oldPath → newPath

// ---------------------------------------------------------------------------
// Sorting helper
// ---------------------------------------------------------------------------

function sortIds(
  files: Map<string, FileEntry>,
  ids: string[],
  sort: SortConfig | null,
): string[] {
  if (!sort) return ids;

  const sorted = [...ids];
  const { column, direction } = sort;
  const dir = direction === "asc" ? 1 : -1;

  sorted.sort((aId, bId) => {
    const a = files.get(aId);
    const b = files.get(bId);
    if (!a || !b) return 0;

    const aVal = a[column as keyof FileEntry];
    const bVal = b[column as keyof FileEntry];

    // Handle nulls — nulls go to the end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return dir * aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return dir * (aVal - bVal);
    }

    // Fallback: string comparison
    return dir * String(aVal).localeCompare(String(bVal));
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function filesReducer(state: FilesState, action: FilesAction): FilesState {
  switch (action.type) {
    case "SET_FILES": {
      const files = new Map<string, FileEntry>();
      const ids: string[] = [];
      for (const entry of action.payload) {
        files.set(entry.id, entry);
        ids.push(entry.id);
      }
      const sortedIds = sortIds(files, ids, state.sort);
      return {
        ...state,
        files,
        sortedIds,
        selectedIds: new Set(),
      };
    }

    case "SET_SORT": {
      const sort = action.payload;
      const sortedIds = sortIds(state.files, [...state.sortedIds], sort);
      return { ...state, sort, sortedIds };
    }

    case "SELECT": {
      const { id, ctrl, shift } = action.payload;
      let newSelected: Set<string>;

      if (shift && state.selectedIds.size > 0) {
        // Range selection: from last selected to clicked
        const lastSelected = [...state.selectedIds].pop()!;
        const startIdx = state.sortedIds.indexOf(lastSelected);
        const endIdx = state.sortedIds.indexOf(id);
        if (startIdx === -1 || endIdx === -1) {
          newSelected = new Set([id]);
        } else {
          const low = Math.min(startIdx, endIdx);
          const high = Math.max(startIdx, endIdx);
          newSelected = new Set(state.selectedIds);
          for (let i = low; i <= high; i++) {
            newSelected.add(state.sortedIds[i]);
          }
        }
      } else if (ctrl) {
        // Toggle selection
        newSelected = new Set(state.selectedIds);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
      } else {
        // Single selection
        newSelected = new Set([id]);
      }

      return { ...state, selectedIds: newSelected };
    }

    case "SELECT_ALL": {
      return { ...state, selectedIds: new Set(state.sortedIds) };
    }

    case "CLEAR_SELECTION": {
      return { ...state, selectedIds: new Set() };
    }

    case "TOGGLE_RECURSIVE": {
      return { ...state, recursive: !state.recursive };
    }

    case "UPDATE_PATHS": {
      // Update file entries after rename: oldPath → newPath
      const mapping = action.payload;
      const next = new Map(state.files);
      for (const [oldPath, newPath] of Object.entries(mapping)) {
        // Find the entry by path
        for (const [id, entry] of next) {
          if (entry.path === oldPath) {
            const newFilename = newPath.split("/").pop() ?? entry.filename;
            next.set(id, { ...entry, path: newPath, filename: newFilename });
            break;
          }
        }
      }
      return { ...state, files: next };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FilesContextValue {
  state: FilesState;
  setFiles: (files: FileEntry[]) => void;
  setSort: (sort: SortConfig | null) => void;
  selectFile: (id: string, ctrl: boolean, shift: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleRecursive: () => void;
  updatePaths: (mapping: Record<string, string>) => void;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export function FilesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(filesReducer, initialState);

  const setFiles = useCallback(
    (files: FileEntry[]) => dispatch({ type: "SET_FILES", payload: files }),
    [],
  );

  const setSort = useCallback(
    (sort: SortConfig | null) => dispatch({ type: "SET_SORT", payload: sort }),
    [],
  );

  const selectFile = useCallback(
    (id: string, ctrl: boolean, shift: boolean) =>
      dispatch({ type: "SELECT", payload: { id, ctrl, shift } }),
    [],
  );

  const selectAll = useCallback(
    () => dispatch({ type: "SELECT_ALL" }),
    [],
  );

  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    [],
  );

  const toggleRecursive = useCallback(
    () => dispatch({ type: "TOGGLE_RECURSIVE" }),
    [],
  );

  const updatePaths = useCallback(
    (mapping: Record<string, string>) =>
      dispatch({ type: "UPDATE_PATHS", payload: mapping }),
    [],
  );

  return (
    <FilesContext.Provider
      value={{
        state,
        setFiles,
        setSort,
        selectFile,
        selectAll,
        clearSelection,
        toggleRecursive,
        updatePaths,
      }}
    >
      {children}
    </FilesContext.Provider>
  );
}

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error("useFiles must be used within a FilesProvider");
  return ctx;
}
