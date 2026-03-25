import { useMemo, useCallback } from "react";
import { useFiles } from "../FilesContext";
import { useTagEdit } from "../TagEditContext";
import { tagFieldsFromEntry, KEEP_PLACEHOLDER } from "../types";
import type { TagFieldKey } from "../types";
import GenreCombobox from "./GenreCombobox";

const INPUT_CLASS =
  "w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60";

const KEEP_CLASS =
  "w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow italic text-on-surface-variant";

function TagField({
  label,
  field,
  value,
  disabled,
  onChange,
  multiline = false,
}: {
  label: string;
  field: TagFieldKey;
  value: string;
  disabled: boolean;
  onChange: (field: TagFieldKey, value: string) => void;
  multiline?: boolean;
}) {
  const isKeep = value === KEEP_PLACEHOLDER;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(field, e.target.value);
    },
    [field, onChange],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Clear <keep> on focus so user starts fresh
      if (isKeep) {
        e.target.value = "";
        onChange(field, "");
      }
    },
    [field, isKeep, onChange],
  );

  return (
    <div className="space-y-0.5">
      <label className="text-[11px] font-medium text-on-surface-variant block">
        {label}
      </label>
      {multiline ? (
        <textarea
          disabled={disabled}
          value={isKeep ? "<keep>" : value}
          onChange={handleChange}
          onFocus={handleFocus}
          className={`${isKeep ? "italic text-on-surface-variant" : ""} w-full h-14 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 py-1 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm resize-none transition-shadow disabled:opacity-60`}
          placeholder={disabled ? "No file selected" : ""}
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={isKeep ? "<keep>" : value}
          onChange={handleChange}
          onFocus={handleFocus}
          className={isKeep ? KEEP_CLASS : INPUT_CLASS}
          placeholder={disabled ? "No file selected" : ""}
        />
      )}
    </div>
  );
}

interface TagPanelProps {
  onSave: () => void;
}

function TagPanel({ onSave }: TagPanelProps) {
  const { state: filesState } = useFiles();
  const { getMergedFields, setField, dirtyPaths } = useTagEdit();

  const { files, selectedIds } = filesState;

  // Get selected file entries
  const selectedEntries = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => files.get(id))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((e) => ({ path: e.path, loaded: tagFieldsFromEntry(e) }));
  }, [files, selectedIds]);

  const hasSelection = selectedEntries.length > 0;

  // Compute merged display values
  const merged = useMemo(
    () => getMergedFields(selectedEntries),
    [getMergedFields, selectedEntries],
  );

  // Selected file paths (for dispatching edits)
  const selectedPaths = useMemo(
    () => selectedEntries.map((e) => e.path),
    [selectedEntries],
  );

  const handleChange = useCallback(
    (field: TagFieldKey, value: string) => {
      if (selectedPaths.length > 0) {
        setField(selectedPaths, field, value);
      }
    },
    [selectedPaths, setField],
  );

  // Check if any selected file is dirty
  const anyDirty = useMemo(
    () => selectedPaths.some((p) => dirtyPaths.has(p)),
    [selectedPaths, dirtyPaths],
  );

  return (
    <aside className="flex flex-col h-full bg-slate-100 shrink-0 overflow-hidden">
      <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface">
              TAG PANEL
            </h2>
            <p className="text-[10px] text-on-surface-variant">
              {hasSelection
                ? `${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""} selected`
                : "Edit Selection"}
            </p>
          </div>
          {anyDirty && (
            <span className="text-[10px] font-medium text-primary mt-0.5">
              Unsaved
            </span>
          )}
        </div>

        {/* Cover Art placeholder (cover-art change will implement this) */}
        <div className="aspect-square w-full bg-surface-container-highest rounded border border-outline-variant/20 flex items-center justify-center overflow-hidden relative group">
          <span className="text-xs text-on-surface-variant">No cover</span>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button className="bg-white/20 backdrop-blur-md p-2 rounded-full hover:bg-white/40 text-white text-sm">
              +
            </button>
            <button className="bg-white/20 backdrop-blur-md p-2 rounded-full hover:bg-white/40 text-white text-sm">
              &times;
            </button>
          </div>
        </div>

        {/* Tag Fields */}
        <div className="space-y-2.5">
          {/* Title */}
          <TagField
            label="Title"
            field="title"
            value={merged.title}
            disabled={!hasSelection}
            onChange={handleChange}
          />

          {/* Artist + Album Artist (2-col) */}
          <div className="grid grid-cols-2 gap-2">
            <TagField
              label="Artist"
              field="artist"
              value={merged.artist}
              disabled={!hasSelection}
              onChange={handleChange}
            />
            <TagField
              label="Album Artist"
              field="albumArtist"
              value={merged.albumArtist}
              disabled={!hasSelection}
              onChange={handleChange}
            />
          </div>

          {/* Album */}
          <TagField
            label="Album"
            field="album"
            value={merged.album}
            disabled={!hasSelection}
            onChange={handleChange}
          />

          {/* Year + Track + Disc (3-col) */}
          <div className="grid grid-cols-3 gap-2">
            <TagField
              label="Year"
              field="year"
              value={merged.year}
              disabled={!hasSelection}
              onChange={handleChange}
            />
            <TagField
              label="Track"
              field="track"
              value={merged.track}
              disabled={!hasSelection}
              onChange={handleChange}
            />
            <TagField
              label="Disc"
              field="disc"
              value={merged.disc}
              disabled={!hasSelection}
              onChange={handleChange}
            />
          </div>

          {/* Genre — combobox */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Genre
            </label>
            <GenreCombobox
              value={merged.genre === KEEP_PLACEHOLDER ? "" : merged.genre}
              isKeep={merged.genre === KEEP_PLACEHOLDER}
              onChange={(v) => handleChange("genre", v)}
              disabled={!hasSelection}
              placeholder={!hasSelection ? "No file selected" : ""}
            />
          </div>

          {/* Comment */}
          <TagField
            label="Comment"
            field="comment"
            value={merged.comment}
            disabled={!hasSelection}
            onChange={handleChange}
            multiline
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 bg-slate-100 shrink-0">
        <button
          onClick={onSave}
          disabled={!hasSelection || !anyDirty}
          className="w-full h-9 bg-gradient-to-b from-primary to-primary-dim text-on-primary text-xs font-semibold rounded flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Changes (Ctrl+S)
        </button>
      </div>
    </aside>
  );
}

export default TagPanel;
