function TagPanel() {
  return (
    <aside className="flex flex-col h-full bg-slate-100 shrink-0 overflow-hidden">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {/* Header */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface">
            TAG PANEL
          </h2>
          <p className="text-[10px] text-on-surface-variant">Edit Selection</p>
        </div>

        {/* Cover Art */}
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
        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Title
            </label>
            <input
              type="text"
              disabled
              placeholder="No file selected"
              className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
            />
          </div>

          {/* Artist + Album Artist (2-col) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant block">
                Artist
              </label>
              <input
                type="text"
                disabled
                placeholder="No file selected"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant block">
                Album Artist
              </label>
              <input
                type="text"
                disabled
                placeholder="No file selected"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
            </div>
          </div>

          {/* Album */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Album
            </label>
            <input
              type="text"
              disabled
              placeholder="No file selected"
              className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
            />
          </div>

          {/* Year + Track + Disc (3-col) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant block">
                Year
              </label>
              <input
                type="text"
                disabled
                placeholder="—"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant block">
                Track
              </label>
              <input
                type="text"
                disabled
                placeholder="—"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-on-surface-variant block">
                Disc
              </label>
              <input
                type="text"
                disabled
                placeholder="—"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Genre
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="No file selected"
                className="w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 pr-6 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60"
              />
              <svg
                className="absolute right-1.5 top-1.5 w-3.5 h-3.5 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-on-surface-variant block">
              Comment
            </label>
            <textarea
              disabled
              placeholder="No file selected"
              className="w-full h-14 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 py-1 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm resize-none transition-shadow disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Save Button — pinned at bottom */}
      <div className="p-4 bg-slate-100">
        <button
          className="w-full h-9 bg-gradient-to-b from-primary to-primary-dim text-on-primary text-xs font-semibold rounded flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
        >
          Save Changes (Ctrl+S)
        </button>
      </div>
    </aside>
  );
}

export default TagPanel;
