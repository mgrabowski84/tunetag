import { useEffect, useCallback, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MenuBar from "./components/MenuBar";
import SplitPane from "./components/SplitPane";
import StatusBar from "./components/StatusBar";
import FileList from "./components/FileList";
import TagPanel from "./components/TagPanel";
import RenameDialog from "./components/RenameDialog";
import AutoNumberDialog from "./components/AutoNumberDialog";
import MusicBrainzDialog from "./components/MusicBrainzDialog";
import { FilesProvider, useFiles } from "./FilesContext";
import { TagEditProvider, useTagEdit } from "./TagEditContext";
import type { FileEntry, TagUpdate, SaveResult } from "./types";

// ---------------------------------------------------------------------------
// Save error dialog component
// ---------------------------------------------------------------------------

interface SaveErrorDialogProps {
  result: SaveResult;
  total: number;
  onClose: () => void;
}

function SaveErrorDialog({ result, total, onClose }: SaveErrorDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-white rounded-lg w-[520px] p-5 max-h-[80vh] flex flex-col"
        style={{ boxShadow: "0 8px 32px rgba(27, 51, 83, 0.15)" }}
      >
        <h2 className="text-sm font-semibold text-on-surface mb-1">
          Save Results
        </h2>
        <p className="text-xs text-on-surface-variant mb-3">
          Saved {result.succeeded.length}/{total} files.{" "}
          {result.failed.length > 0 && (
            <span className="text-red-600 font-medium">
              {result.failed.length} failed:
            </span>
          )}
        </p>
        {result.failed.length > 0 && (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-sm mb-4">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-container-high sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 text-on-surface-variant font-medium text-[11px]">
                    File
                  </th>
                  <th className="text-left px-3 py-1.5 text-on-surface-variant font-medium text-[11px]">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((e, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? "bg-surface-container-lowest"
                        : "bg-surface-container-low"
                    }
                  >
                    <td className="px-3 py-1 truncate max-w-[200px]">
                      {e.path.split("/").pop()}
                    </td>
                    <td className="px-3 py-1 text-red-600 truncate">
                      {e.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end">
          <button
            className="px-4 py-1.5 text-xs bg-gradient-to-b from-primary to-primary-dim text-on-primary rounded shadow-sm hover:opacity-90"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app inner (has access to both contexts)
// ---------------------------------------------------------------------------

function AppInner() {
  const { state: filesState, setFiles, updatePaths } = useFiles();
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showAutoNumberDialog, setShowAutoNumberDialog] = useState(false);
  const [showMusicBrainzDialog, setShowMusicBrainzDialog] = useState(false);
  const fileListRef = useRef<HTMLDivElement | null>(null);
  const {
    state: editState,
    clearEdits,
    clearAllEdits,
    isDirty,
    dirtyCount,
    dirtyPaths,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    undo,
    redo,
  } = useTagEdit();

  const [saveErrorResult, setSaveErrorResult] = useState<{
    result: SaveResult;
    total: number;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Sync dirty state to Rust backend (for close prompt)
  // -------------------------------------------------------------------------
  useEffect(() => {
    invoke("set_has_unsaved_changes", { dirty: isDirty }).catch(() => {});
  }, [isDirty]);

  // -------------------------------------------------------------------------
  // Update window title with asterisk when dirty
  // -------------------------------------------------------------------------
  useEffect(() => {
    const title = isDirty ? "*TuneTag" : "TuneTag";
    getCurrentWebviewWindow().setTitle(title).catch(() => {});
  }, [isDirty]);

  // -------------------------------------------------------------------------
  // Save handler
  // -------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    const { files, selectedIds } = filesState;
    if (selectedIds.size === 0) return;

    // Build updates for selected files that have edits
    const updates: TagUpdate[] = [];
    for (const id of selectedIds) {
      const entry = files.get(id);
      if (!entry) continue;
      const edits = editState.editedTags.get(entry.path);
      if (!edits) continue; // no edits for this file

      const fields: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(edits)) {
        fields[k] = v ?? null;
      }
      updates.push({ path: entry.path, fields });
    }

    if (updates.length === 0) return;

    try {
      const result = await invoke<SaveResult>("save_tags", { updates });

      // Clear edits for succeeded files
      if (result.succeeded.length > 0) {
        clearEdits(result.succeeded);
      }

      // Show error dialog if any failed
      if (result.failed.length > 0) {
        setSaveErrorResult({ result, total: updates.length });
      }
    } catch (e) {
      setSaveErrorResult({
        result: {
          succeeded: [],
          failed: [{ path: "All files", error: String(e) }],
        },
        total: updates.length,
      });
    }
  }, [filesState, editState.editedTags, clearEdits]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
  // -------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (ctrl && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
      } else if (
        (ctrl && e.shiftKey && e.key === "z") ||
        (ctrl && e.key === "y")
      ) {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, canUndo, canRedo, undo, redo]);

  // -------------------------------------------------------------------------
  // Drag and drop
  // -------------------------------------------------------------------------
  const loadDroppedPaths = useCallback(
    async (paths: string[]) => {
      try {
        const entries = await invoke<FileEntry[]>("scan_paths", {
          paths,
          recursive: filesState.recursive,
        });
        setFiles(entries);
      } catch {
        // Ignore errors
      }
    },
    [filesState.recursive, setFiles],
  );

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length > 0) {
            loadDroppedPaths(paths);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadDroppedPaths]);

  // -------------------------------------------------------------------------
  // Refresh handler (F5 / View → Refresh)
  // -------------------------------------------------------------------------
  const handleRefresh = useCallback(async () => {
    if (filesState.files.size === 0) return;

    if (isDirty) {
      const confirmed = window.confirm(
        `You have unsaved changes in ${dirtyCount} file${dirtyCount !== 1 ? "s" : ""}. Refresh will discard them. Continue?`,
      );
      if (!confirmed) return;
    }

    const paths = Array.from(filesState.files.values()).map((f) => f.path);
    try {
      const result = await invoke<{
        updated: typeof filesState.files extends Map<string, infer V> ? V[] : never;
        deleted: string[];
      }>("refresh_files", { paths });

      // Re-build files from updated
      setFiles(result.updated as Parameters<typeof setFiles>[0]);
      clearAllEdits();
      fileListRef.current?.focus();
    } catch {
      // Silently ignore refresh errors
    }
  }, [filesState.files, isDirty, dirtyCount, setFiles, clearAllEdits]);

  // F5 keyboard shortcut for refresh
  useEffect(() => {
    function handleF5(e: KeyboardEvent) {
      if (e.key === "F5") {
        e.preventDefault();
        handleRefresh();
      }
    }
    document.addEventListener("keydown", handleF5);
    return () => document.removeEventListener("keydown", handleF5);
  }, [handleRefresh]);

  return (
    <div className="h-screen flex flex-col bg-surface text-on-surface overflow-hidden">
      <MenuBar
        canUndo={canUndo}
        canRedo={canRedo}
        undoLabel={undoLabel}
        redoLabel={redoLabel}
        onUndo={undo}
        onRedo={redo}
        onCloseAll={clearAllEdits}
        hasSelection={filesState.selectedIds.size > 0}
        onRenameFromTags={() => setShowRenameDialog(true)}
        onAutoNumber={() => setShowAutoNumberDialog(true)}
        onRefresh={handleRefresh}
        onMusicBrainz={() => setShowMusicBrainzDialog(true)}
      />
      <SplitPane
        left={<TagPanel onSave={handleSave} />}
        right={<FileList dirtyPaths={dirtyPaths} />}
        defaultLeftWidth={288}
        minLeft={220}
        minRight={400}
      />
      <StatusBar
        filesLoaded={filesState.files.size}
        filesSelected={filesState.selectedIds.size}
        filesUnsaved={dirtyCount}
      />

      {/* Auto-number dialog */}
      {showAutoNumberDialog && (
        <AutoNumberDialog
          selectedEntries={Array.from(filesState.selectedIds)
            .map((id) => filesState.files.get(id))
            .filter((e): e is NonNullable<typeof e> => e != null)
            .map((e) => ({
              id: e.id,
              path: e.path,
              filename: e.filename,
              track: e.track,
              disc: e.disc,
            }))}
          onClose={() => setShowAutoNumberDialog(false)}
        />
      )}

      {/* MusicBrainz dialog */}
      {showMusicBrainzDialog && (
        <MusicBrainzDialog
          selectedFiles={Array.from(filesState.selectedIds)
            .map((id) => filesState.files.get(id))
            .filter((e): e is NonNullable<typeof e> => e != null)}
          onClose={() => setShowMusicBrainzDialog(false)}
        />
      )}

      {/* Rename dialog */}
      {showRenameDialog && (
        <RenameDialog
          selectedPaths={Array.from(filesState.selectedIds)
            .map((id) => filesState.files.get(id)?.path)
            .filter((p): p is string => p != null)}
          onClose={() => setShowRenameDialog(false)}
          onRenamed={(mapping) => {
            updatePaths(mapping);
            setShowRenameDialog(false);
          }}
        />
      )}

      {/* Save error dialog */}
      {saveErrorResult && (
        <SaveErrorDialog
          result={saveErrorResult.result}
          total={saveErrorResult.total}
          onClose={() => setSaveErrorResult(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <FilesProvider>
      <TagEditProvider>
        <AppInner />
      </TagEditProvider>
    </FilesProvider>
  );
}

export default App;
