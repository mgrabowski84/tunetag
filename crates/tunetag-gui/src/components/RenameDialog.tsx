import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RenamePreviewRow {
  originalPath: string;
  originalName: string;
  newName: string;
  isNoop: boolean;
}

interface RenamePreviewResponse {
  rows: RenamePreviewRow[];
  collisions: string[];
  permissionErrors: string[];
}

interface RenameResult {
  originalPath: string;
  newPath: string | null;
  error: string | null;
  skipped: boolean;
}

interface RenameDialogProps {
  /** File paths of selected files. */
  selectedPaths: string[];
  /** Called when dialog is closed (cancel or done). */
  onClose: () => void;
  /** Called with old→new path mapping after successful rename. */
  onRenamed: (mapping: Record<string, string>) => void;
}

const PLACEHOLDERS = [
  "%title%", "%artist%", "%album%", "%year%",
  "%track%", "%disc%", "%albumartist%", "%genre%",
];

function RenameDialog({ selectedPaths, onClose, onRenamed }: RenameDialogProps) {
  const [format, setFormat] = useState("%artist% - %title%");
  const [livePreview, setLivePreview] = useState<string>("");
  const [preview, setPreview] = useState<RenamePreviewResponse | null>(null);
  const [renameResults, setRenameResults] = useState<RenameResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstPath = selectedPaths[0] ?? null;

  // Live preview — debounced 150ms
  useEffect(() => {
    if (!firstPath || !format.trim()) {
      setLivePreview("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await invoke<string>("rename_preview_single", {
          filePath: firstPath,
          format,
        });
        setLivePreview(result);
      } catch {
        setLivePreview("(preview failed)");
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [format, firstPath]);

  const handlePreviewAll = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    try {
      const result = await invoke<RenamePreviewResponse>("rename_preview", {
        filePaths: selectedPaths,
        format,
      });
      setPreview(result);
    } catch (e) {
      setPreview({
        rows: [],
        collisions: [String(e)],
        permissionErrors: [],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPaths, format]);

  const handleRename = useCallback(async () => {
    setLoading(true);
    try {
      const results = await invoke<RenameResult[]>("rename_execute", {
        filePaths: selectedPaths,
        format,
      });
      setRenameResults(results);

      // Build old→new path mapping for file list update
      const mapping: Record<string, string> = {};
      for (const r of results) {
        if (!r.error && !r.skipped && r.newPath) {
          mapping[r.originalPath] = r.newPath;
        }
      }
      if (Object.keys(mapping).length > 0) {
        onRenamed(mapping);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPaths, format, onRenamed]);

  const hasErrors =
    preview &&
    (preview.collisions.length > 0 || preview.permissionErrors.length > 0);

  const canRename = preview && !hasErrors && preview.rows.some((r) => !r.isNoop);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-white rounded-lg w-[640px] max-h-[80vh] flex flex-col"
        style={{ boxShadow: "0 8px 32px rgba(27, 51, 83, 0.15)" }}
      >
        {/* Header */}
        <div className="p-5 pb-0">
          <h2 className="text-sm font-semibold text-on-surface mb-0.5">
            Rename Files from Tags
          </h2>
          <p className="text-xs text-on-surface-variant">
            {selectedPaths.length} file{selectedPaths.length !== 1 ? "s" : ""} selected
          </p>
        </div>

        {/* Format string */}
        <div className="p-5 pb-3">
          <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
            Format String
          </label>
          <input
            type="text"
            value={format}
            onChange={(e) => { setFormat(e.target.value); setPreview(null); }}
            className="w-full h-8 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm font-mono"
            placeholder="%artist% - %title%"
            autoFocus
          />
          {/* Placeholder chips */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p}
                className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container-low rounded text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container"
                onClick={() => setFormat((f) => f + p)}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Live preview */}
          {livePreview && (
            <div className="mt-2 text-[11px] text-on-surface-variant">
              Preview:{" "}
              <span className="font-mono text-on-surface font-medium">
                {livePreview}
              </span>
            </div>
          )}
        </div>

        {/* Errors / warnings */}
        {hasErrors && (
          <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-200 rounded-sm">
            {preview!.collisions.map((c, i) => (
              <div key={i} className="text-[11px] text-red-700">
                {c}
              </div>
            ))}
            {preview!.permissionErrors.map((e, i) => (
              <div key={i} className="text-[11px] text-red-700">
                {e}
              </div>
            ))}
          </div>
        )}

        {/* Preview table */}
        {preview && preview.rows.length > 0 && (
          <div className="flex-1 overflow-auto mx-5 mb-3 border border-slate-200 rounded-sm min-h-0">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-surface-container-high sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter">
                    Current Name
                  </th>
                  <th className="w-6 text-center px-1 text-on-surface-variant">→</th>
                  <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter">
                    New Name
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-100 ${
                      row.isNoop ? "opacity-40" : ""
                    } ${i % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low"}`}
                  >
                    <td className="px-3 py-1 font-mono truncate max-w-[240px]">
                      {row.originalName}
                    </td>
                    <td className="text-center text-slate-400 text-[10px]">→</td>
                    <td
                      className={`px-3 py-1 font-mono truncate max-w-[240px] ${
                        row.isNoop ? "" : "text-primary font-medium"
                      }`}
                    >
                      {row.newName}
                      {row.isNoop && (
                        <span className="text-[10px] text-slate-400 ml-1">(unchanged)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rename results */}
        {renameResults && (
          <div className="mx-5 mb-3 p-3 bg-slate-50 rounded-sm border border-slate-200">
            <div className="text-[11px] font-medium text-on-surface mb-1">
              Renamed {renameResults.filter((r) => !r.error && !r.skipped).length}/
              {renameResults.length} files
            </div>
            {renameResults
              .filter((r) => r.error)
              .map((r, i) => (
                <div key={i} className="text-[11px] text-red-600">
                  {r.originalPath.split("/").pop()}: {r.error}
                </div>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center p-4 pt-0">
          <button
            className="px-3 py-1.5 text-xs bg-surface-container rounded text-on-surface hover:bg-surface-container-high"
            onClick={handlePreviewAll}
            disabled={loading || !format.trim()}
          >
            {loading ? "Loading…" : "Preview All"}
          </button>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-slate-100 rounded"
              onClick={onClose}
            >
              {renameResults ? "Close" : "Cancel"}
            </button>
            {!renameResults && (
              <button
                className="px-4 py-1.5 text-xs bg-gradient-to-b from-primary to-primary-dim text-on-primary rounded shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canRename || loading}
                onClick={handleRename}
              >
                Rename
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RenameDialog;
