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
    <div className="h-full flex flex-col p-3 bg-gray-50">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Tag Panel</h2>
      <div className="flex-1 space-y-2">
        {fields.map((field) => (
          <div key={field}>
            <label className="block text-xs text-gray-500 mb-0.5">
              {field}
            </label>
            {field === "Comment" ? (
              <textarea
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white resize-none h-16"
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
      {/* Cover art placeholder */}
      <div className="mt-3">
        <label className="block text-xs text-gray-500 mb-1">Cover Art</label>
        <div className="w-full aspect-square bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-gray-400 text-xs">
          No cover
        </div>
      </div>
      {/* Save button */}
      <button
        className="mt-3 w-full py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled
      >
        Save
      </button>
    </div>
  );
}

export default TagPanel;
