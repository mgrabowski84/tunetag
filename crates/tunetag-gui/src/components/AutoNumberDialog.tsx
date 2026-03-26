import { useState, useMemo, useCallback } from "react";
import { useTagEdit } from "../TagEditContext";

interface AutoNumberDialogProps {
  /** Selected file entries (id + filename + current track/disc) */
  selectedEntries: Array<{
    id: string;
    path: string;
    filename: string;
    track: string | null;
    disc: string | null;
  }>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Core numbering function (task 1.1-1.2)
// ---------------------------------------------------------------------------

interface NumberingOptions {
  start: number;
  total: number | null;
  writeTotal: boolean;
  disc: number | null;
  sortByFilename: boolean;
}

interface NumberingResult {
  path: string;
  filename: string;
  currentTrack: string;
  newTrack: string;
  newDisc: string | null;
}

function computeNumbering(
  entries: AutoNumberDialogProps["selectedEntries"],
  opts: NumberingOptions,
): NumberingResult[] {
  const start = Math.max(1, opts.start);
  const total = opts.total != null ? Math.max(1, opts.total) : null;
  const disc = opts.disc != null ? Math.max(1, opts.disc) : null;

  // Sort
  const sorted = [...entries];
  if (opts.sortByFilename) {
    sorted.sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" }),
    );
  }

  return sorted.map((entry, idx) => {
    const trackNum = start + idx;
    const newTrack =
      opts.writeTotal && total != null
        ? `${trackNum}/${total}`
        : `${trackNum}`;
    const newDisc = disc != null ? `${disc}` : null;

    return {
      path: entry.path,
      filename: entry.filename,
      currentTrack: entry.track ?? "",
      newTrack,
      newDisc,
    };
  });
}



// ---------------------------------------------------------------------------
// Dialog component (tasks 3.1-3.8)
// ---------------------------------------------------------------------------

function AutoNumberDialog({ selectedEntries, onClose }: AutoNumberDialogProps) {
  const { setField } = useTagEdit();
  const [start, setStart] = useState(1);
  const [totalOverride, setTotalOverride] = useState<string>("");
  const [writeTotal, setWriteTotal] = useState(true);
  const [disc, setDisc] = useState<string>("");
  const [sortByFilename, setSortByFilename] = useState(false);

  const total = totalOverride.trim()
    ? parseInt(totalOverride, 10) || selectedEntries.length
    : selectedEntries.length;

  const opts: NumberingOptions = {
    start,
    total: writeTotal ? total : null,
    writeTotal,
    disc: disc.trim() ? parseInt(disc, 10) || null : null,
    sortByFilename,
  };

  // Live preview (task 3.5-3.6)
  const preview = useMemo(
    () => computeNumbering(selectedEntries, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEntries, start, totalOverride, writeTotal, disc, sortByFilename],
  );

  // OK — apply via setField for each file (integrates with undo)
  const handleApply = useCallback(() => {
    for (const result of preview) {
      setField([result.path], "track", result.newTrack);
      if (result.newDisc != null) {
        setField([result.path], "disc", result.newDisc);
      }
    }
    onClose();
  }, [preview, setField, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        className="bg-white rounded-lg w-[560px] max-h-[80vh] flex flex-col"
        style={{ boxShadow: "0 8px 32px rgba(27, 51, 83, 0.15)" }}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold text-on-surface mb-0.5">
            Auto-number Tracks
          </h2>
          <p className="text-xs text-on-surface-variant">
            {selectedEntries.length} file
            {selectedEntries.length !== 1 ? "s" : ""} selected
          </p>
        </div>

        {/* Options */}
        <div className="px-5 pb-3 grid grid-cols-3 gap-3">
          {/* Starting track */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Starting Track
            </label>
            <input
              type="number"
              min={1}
              value={start}
              onChange={(e) => setStart(parseInt(e.target.value, 10) || 1)}
              className="w-full h-7 bg-surface-container-lowest ring-1 ring-outline-variant/20 border-none text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm"
            />
          </div>

          {/* Total tracks */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Total Tracks
            </label>
            <input
              type="number"
              min={1}
              value={totalOverride}
              onChange={(e) => setTotalOverride(e.target.value)}
              placeholder={`${selectedEntries.length}`}
              disabled={!writeTotal}
              className="w-full h-7 bg-surface-container-lowest ring-1 ring-outline-variant/20 border-none text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm disabled:opacity-40"
            />
          </div>

          {/* Disc number */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Disc Number
            </label>
            <input
              type="number"
              min={1}
              value={disc}
              onChange={(e) => setDisc(e.target.value)}
              placeholder="—"
              className="w-full h-7 bg-surface-container-lowest ring-1 ring-outline-variant/20 border-none text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="px-5 pb-3 flex gap-4">
          <label className="flex items-center gap-1.5 text-[12px] text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={writeTotal}
              onChange={(e) => setWriteTotal(e.target.checked)}
              className="accent-primary"
            />
            Write as N/Total
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={sortByFilename}
              onChange={(e) => setSortByFilename(e.target.checked)}
              className="accent-primary"
            />
            Sort by filename
          </label>
        </div>

        {/* Preview table (task 3.5) */}
        <div className="flex-1 overflow-auto mx-5 mb-3 border border-slate-200 rounded-sm min-h-0">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-surface-container-high sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-8">
                  #
                </th>
                <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter">
                  Filename
                </th>
                <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-20">
                  Current
                </th>
                <th className="text-left px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter w-20">
                  New
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr
                  key={row.path}
                  className={`border-t border-slate-100 ${
                    i % 2 === 0
                      ? "bg-surface-container-lowest"
                      : "bg-surface-container-low"
                  }`}
                >
                  <td className="px-3 py-1 text-on-surface-variant tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1 truncate max-w-[200px]">
                    {row.filename}
                  </td>
                  <td className="px-3 py-1 font-mono text-on-surface-variant">
                    {row.currentTrack || "—"}
                  </td>
                  <td className="px-3 py-1 font-mono text-primary font-medium">
                    {row.newTrack}
                    {row.newDisc && (
                      <span className="text-on-surface-variant ml-1">
                        (d:{row.newDisc})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 p-4 pt-0">
          <button
            className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-slate-100 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-xs bg-gradient-to-b from-primary to-primary-dim text-on-primary rounded shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutoNumberDialog;
