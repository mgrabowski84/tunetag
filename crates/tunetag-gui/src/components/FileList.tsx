function FileList() {
  return (
    <div className="h-full flex flex-col">
      {/* Column headers */}
      <div className="flex items-center h-7 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 select-none shrink-0">
        <span className="w-10 text-center">#</span>
        <span className="flex-1 px-2">Filename</span>
        <span className="w-32 px-2">Title</span>
        <span className="w-28 px-2">Artist</span>
        <span className="w-28 px-2">Album</span>
        <span className="w-14 px-2">Year</span>
        <span className="w-14 px-2">Track</span>
        <span className="w-20 px-2">Genre</span>
        <span className="w-14 px-2">Format</span>
      </div>
      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Open files or drag and drop audio files here
      </div>
    </div>
  );
}

export default FileList;
