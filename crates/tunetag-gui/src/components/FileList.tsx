import { useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useFiles } from "../FilesContext";
import {
  ALL_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  formatDuration,
  formatBitrate,
  formatSampleRate,
  formatChannels,
  type ColumnDef,
  type FileEntry,
  type SortDirection,
  type ColumnSetting,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

const ROW_HEIGHT = 32;
const OVERSCAN = 5;

/** Get visible columns from settings, preserving order. */
function getVisibleColumns(settings: ColumnSetting[]): ColumnDef[] {
  return settings
    .filter((s) => s.visible)
    .map((s) => {
      const def = ALL_COLUMNS.find((c) => c.id === s.field);
      if (!def) return null;
      return { ...def, width: s.width };
    })
    .filter((c): c is ColumnDef => c !== null);
}

/** Build default column settings. */
function defaultColumnSettings(): ColumnSetting[] {
  return ALL_COLUMNS.map((c) => ({
    field: c.id,
    width: c.width,
    visible: DEFAULT_VISIBLE_COLUMNS.includes(c.id),
  }));
}

/** Format a cell value for display. */
function formatCell(col: ColumnDef, entry: FileEntry): string {
  const field = col.field as keyof FileEntry;
  const val = entry[field];

  switch (field) {
    case "durationSecs":
      return formatDuration(val as number | null);
    case "bitrateKbps":
      return formatBitrate(val as number | null);
    case "sampleRateHz":
      return formatSampleRate(val as number | null);
    case "channels":
      return formatChannels(val as number | null);
    default:
      return val != null ? String(val) : "";
  }
}

function FileList() {
  const { state, setSort, selectFile } = useFiles();
  const { files, sortedIds, sort, selectedIds } = state;

  const parentRef = useRef<HTMLDivElement>(null);
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(
    defaultColumnSettings,
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Drag reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Load column config on mount
  useEffect(() => {
    invoke<{ columns: ColumnSetting[] } | null>("load_column_config")
      .then((config) => {
        if (config && config.columns.length > 0) {
          // Merge with ALL_COLUMNS to catch any new columns added since last save
          const knownFields = new Set(config.columns.map((c) => c.field));
          const merged = [
            ...config.columns,
            ...ALL_COLUMNS.filter((c) => !knownFields.has(c.id)).map((c) => ({
              field: c.id,
              width: c.width,
              visible: false,
            })),
          ];
          setColumnSettings(merged);
        }
      })
      .catch(() => {
        // Ignore errors, use defaults
      });
  }, []);

  // Save column config whenever it changes
  const saveColumnConfig = useCallback(
    (settings: ColumnSetting[]) => {
      invoke("save_column_config", {
        config: { columns: settings },
      }).catch(() => {
        // Ignore save errors
      });
    },
    [],
  );

  const visibleColumns = getVisibleColumns(columnSettings);

  const virtualizer = useVirtualizer({
    count: sortedIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const handleHeaderClick = useCallback(
    (col: ColumnDef) => {
      if (!col.sortable) return;
      const field = col.field as string;
      if (sort && sort.column === field) {
        const newDir: SortDirection =
          sort.direction === "asc" ? "desc" : "asc";
        setSort({ column: field, direction: newDir });
      } else {
        setSort({ column: field, direction: "asc" });
      }
    },
    [sort, setSort],
  );

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      selectFile(id, e.ctrlKey || e.metaKey, e.shiftKey);
    },
    [selectFile],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleToggleColumn = useCallback(
    (field: string) => {
      const newSettings = columnSettings.map((s) =>
        s.field === field ? { ...s, visible: !s.visible } : s,
      );
      setColumnSettings(newSettings);
      saveColumnConfig(newSettings);
    },
    [columnSettings, saveColumnConfig],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Drag-to-reorder handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIdx(idx);
    },
    [],
  );

  const handleDrop = useCallback(
    (_e: React.DragEvent, dropIdx: number) => {
      if (dragIdx === null || dragIdx === dropIdx) {
        setDragIdx(null);
        setDragOverIdx(null);
        return;
      }

      // Reorder visible columns in settings
      // We need to map visible column indices back to settings indices
      const visibleSettingsIndices = columnSettings
        .map((s, i) => (s.visible ? i : -1))
        .filter((i) => i !== -1);

      const fromSettingsIdx = visibleSettingsIndices[dragIdx];
      const toSettingsIdx = visibleSettingsIndices[dropIdx];

      if (fromSettingsIdx === undefined || toSettingsIdx === undefined) {
        setDragIdx(null);
        setDragOverIdx(null);
        return;
      }

      const newSettings = [...columnSettings];
      const [moved] = newSettings.splice(fromSettingsIdx, 1);
      // Adjust target index if needed
      const adjustedTo =
        toSettingsIdx > fromSettingsIdx ? toSettingsIdx - 1 : toSettingsIdx;
      // Find the actual position in the full array
      const insertBefore = newSettings[adjustedTo];
      const insertIdx = insertBefore
        ? newSettings.indexOf(insertBefore)
        : newSettings.length;
      newSettings.splice(insertIdx, 0, moved);

      setColumnSettings(newSettings);
      saveColumnConfig(newSettings);
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, columnSettings, saveColumnConfig],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  // Total table width
  const totalWidth = 40 + visibleColumns.reduce((sum, c) => sum + c.width, 0);

  return (
    <section className="flex-1 flex flex-col bg-surface-container-lowest overflow-hidden">
      {/* Table header */}
      <div className="shrink-0 overflow-x-auto" onContextMenu={handleContextMenu}>
        <div style={{ minWidth: `${totalWidth}px` }}>
          <div className="flex bg-surface-container-high border-b border-slate-200">
            {/* Row number column — fixed, not draggable */}
            <div
              className="shrink-0 px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter text-center"
              style={{ width: 40 }}
            >
              #
            </div>
            {/* Data columns */}
            {visibleColumns.map((col, idx) => {
              const isActive = sort?.column === col.field;
              return (
                <div
                  key={col.id}
                  className={`shrink-0 px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40 select-none ${
                    col.sortable ? "cursor-pointer hover:bg-surface-container-highest" : ""
                  } ${dragOverIdx === idx ? "bg-primary-container/30" : ""}`}
                  style={{ width: col.width }}
                  onClick={() => handleHeaderClick(col)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span>{col.label}</span>
                  {isActive && (
                    <span className="ml-1 text-primary">
                      {sort?.direction === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context menu for column customization */}
      {contextMenu && (
        <div
          className="fixed bg-surface-bright border border-slate-200/60 py-1 z-[100] rounded-md min-w-48"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            boxShadow: "0 4px 20px rgba(27, 51, 83, 0.06)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-slate-200/40">
            Columns
          </div>
          {ALL_COLUMNS.map((col) => {
            const setting = columnSettings.find((s) => s.field === col.id);
            const checked = setting?.visible ?? false;
            return (
              <button
                key={col.id}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-on-surface hover:bg-primary-container hover:text-on-primary-container"
                onClick={() => handleToggleColumn(col.id)}
              >
                <span
                  className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center text-[10px] ${
                    checked
                      ? "bg-primary border-primary text-on-primary"
                      : "border-outline-variant"
                  }`}
                >
                  {checked ? "\u2713" : ""}
                </span>
                <span>{col.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table body — virtualized */}
      {sortedIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant/60 text-sm">
          Open files or drag and drop audio files here
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: `${totalWidth}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const id = sortedIds[virtualRow.index];
              const entry = files.get(id);
              if (!entry) return null;

              const isSelected = selectedIds.has(id);
              const isEven = virtualRow.index % 2 === 0;

              let bgClass: string;
              if (isSelected) {
                bgClass = "bg-primary-container text-on-primary-container";
              } else if (isEven) {
                bgClass = "bg-surface-container-lowest";
              } else {
                bgClass = "bg-surface-container-low";
              }

              return (
                <div
                  key={id}
                  className={`flex items-center cursor-default ${bgClass} hover:brightness-[0.97]`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={(e) => handleRowClick(id, e)}
                >
                  {/* Row number */}
                  <div
                    className="shrink-0 px-3 text-[11px] text-on-surface-variant text-center tabular-nums"
                    style={{ width: 40 }}
                  >
                    {virtualRow.index + 1}
                  </div>
                  {/* Data cells */}
                  {visibleColumns.map((col) => (
                    <div
                      key={col.id}
                      className="shrink-0 px-3 text-[12px] text-on-surface truncate"
                      style={{ width: col.width, lineHeight: `${ROW_HEIGHT}px` }}
                      title={formatCell(col, entry)}
                    >
                      {formatCell(col, entry)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default FileList;
