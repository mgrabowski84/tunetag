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

interface FileListProps {
  dirtyPaths?: Set<string>;
  /** Ref to the Title input in TagPanel for Enter-to-edit focus */
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Whether a progressive scan is in progress */
  scanning?: boolean;
  /** Number of files loaded so far during a progressive scan */
  scanCount?: number;
}

function FileList({ dirtyPaths = new Set(), titleInputRef, scanning = false, scanCount = 0 }: FileListProps) {
  const { state, setSort, selectFile } = useFiles();
  const { files, sortedIds, sort, selectedIds } = state;

  // Keyboard nav state
  const [cursorIndex, setCursorIndex] = useState<number>(-1);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Type-to-jump
  const prefixRef = useRef<string>("");
  const prefixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    (id: string, idx: number, e: React.MouseEvent) => {
      selectFile(id, e.ctrlKey || e.metaKey, e.shiftKey);
      setCursorIndex(idx);
      if (!e.shiftKey) setAnchorIndex(idx);
    },
    [selectFile],
  );

  // Scroll cursor row into view
  const scrollCursorIntoView = useCallback((idx: number) => {
    const el = rowRefs.current.get(idx);
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  // Move cursor and select, then scroll
  const moveCursor = useCallback(
    (newIdx: number, shift: boolean) => {
      const clamped = Math.max(0, Math.min(sortedIds.length - 1, newIdx));
      if (shift) {
        const anchor = anchorIndex ?? cursorIndex;
        const lo = Math.min(anchor, clamped);
        const hi = Math.max(anchor, clamped);
        // Select the range
        for (let i = lo; i <= hi; i++) {
          const id = sortedIds[i];
          if (id) selectFile(id, i > lo, false);
        }
        setCursorIndex(clamped);
      } else {
        const id = sortedIds[clamped];
        if (id) {
          selectFile(id, false, false);
          setAnchorIndex(clamped);
        }
        setCursorIndex(clamped);
      }
      scrollCursorIntoView(clamped);
    },
    [sortedIds, cursorIndex, anchorIndex, selectFile, scrollCursorIntoView],
  );

  // Keyboard handler for the file list container
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (sortedIds.length === 0) return;
      const ctrl = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveCursor(cursorIndex < 0 ? 0 : cursorIndex + 1, e.shiftKey);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveCursor(cursorIndex < 0 ? 0 : cursorIndex - 1, e.shiftKey);
          break;
        case "Home":
          e.preventDefault();
          moveCursor(0, e.shiftKey);
          break;
        case "End":
          e.preventDefault();
          moveCursor(sortedIds.length - 1, e.shiftKey);
          break;
        case "PageDown": {
          e.preventDefault();
          const pageSize = parentRef.current
            ? Math.floor(parentRef.current.clientHeight / ROW_HEIGHT)
            : 10;
          moveCursor(cursorIndex + pageSize, e.shiftKey);
          break;
        }
        case "PageUp": {
          e.preventDefault();
          const pageSize = parentRef.current
            ? Math.floor(parentRef.current.clientHeight / ROW_HEIGHT)
            : 10;
          moveCursor(cursorIndex - pageSize, e.shiftKey);
          break;
        }
        case "Enter":
          e.preventDefault();
          if (selectedIds.size > 0) {
            titleInputRef?.current?.focus();
          }
          break;
        case "Tab":
          e.preventDefault();
          titleInputRef?.current?.focus();
          break;
        default: {
          // Type-to-jump: printable characters, no modifiers
          if (
            e.key.length === 1 &&
            !ctrl &&
            !e.altKey
          ) {
            e.preventDefault();
            prefixRef.current += e.key.toLowerCase();
            if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
            prefixTimeoutRef.current = setTimeout(() => {
              prefixRef.current = "";
            }, 1000);

            const prefix = prefixRef.current;
            const matchIdx = sortedIds.findIndex((id) => {
              const entry = files.get(id);
              return entry?.filename.toLowerCase().startsWith(prefix);
            });
            if (matchIdx >= 0) {
              moveCursor(matchIdx, false);
            }
          }
        }
      }
    },
    [sortedIds, cursorIndex, anchorIndex, selectedIds, moveCursor, titleInputRef, files],
  );

  // Attach keyboard listener to container when focused
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
      {/* Loading bar — shown during progressive scan */}
      {scanning && (
        <div className="shrink-0 h-6 px-3 flex items-center gap-2 bg-primary-container border-b border-primary/20">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-[11px] text-on-primary-container font-medium">
            Loading… {scanCount} file{scanCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
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
          className="flex-1 overflow-auto outline-none"
          tabIndex={0}
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
              const isDirty = dirtyPaths.has(entry.path);
              const isEven = virtualRow.index % 2 === 0;
              const isCursor = virtualRow.index === cursorIndex;

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
                  ref={(el) => {
                    if (el) rowRefs.current.set(virtualRow.index, el);
                    else rowRefs.current.delete(virtualRow.index);
                  }}
                  className={`flex items-center cursor-default ${bgClass} hover:brightness-[0.97] ${isCursor ? "outline outline-1 outline-primary/40" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={(e) => handleRowClick(id, virtualRow.index, e)}
                >
                  {/* Row number */}
                  <div
                    className="shrink-0 px-3 text-[11px] text-on-surface-variant text-center tabular-nums"
                    style={{ width: 40 }}
                  >
                    {virtualRow.index + 1}
                  </div>
                  {/* STAT — dirty indicator */}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: 20 }}
                  >
                    {isDirty && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
                        title="Unsaved changes"
                      />
                    )}
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
