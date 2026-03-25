function TagPanel() {
  const fields = [
    "Title",
    "Artist",
    "Album",
    "Album Artist",
    "Year",
    "Track",
    "Disc",
    "Genre",
    "Comment",
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Cover art - fixed height at top */}
      <div className="shrink-0 p-3 pb-2">
        <div className="w-full h-32 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-400 text-xs">
          No cover
        </div>
      </div>
      {/* Tag fields - scrollable area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1.5 min-h-0">
        {fields.map((field) => (
          <div key={field}>
            <label className="block text-xs text-gray-500 mb-0.5">
              {field}
            </label>
            {field === "Comment" ? (
              <textarea
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white resize-none h-14"
                disabled
                placeholder="No file selected"
              />
            ) : (
              <input
                type="text"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                disabled
                placeholder="No file selected"
              />
            )}
          </div>
        ))}
      </div>
      {/* Save button - pinned at bottom */}
      <div className="shrink-0 p-3 pt-2">
        <button
          className="w-full py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default TagPanel;
