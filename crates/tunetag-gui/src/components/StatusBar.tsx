interface StatusBarProps {
  filesLoaded: number;
  filesSelected: number;
  filesUnsaved: number;
}

function StatusBar({
  filesLoaded,
  filesSelected,
  filesUnsaved,
}: StatusBarProps) {
  return (
    <div className="flex items-center h-6 px-3 bg-gray-100 border-t border-gray-300 text-xs text-gray-600 select-none shrink-0">
      <span>{filesLoaded} files loaded</span>
      <span className="mx-2 text-gray-300">|</span>
      <span>{filesSelected} selected</span>
      <span className="mx-2 text-gray-300">|</span>
      <span>{filesUnsaved} unsaved</span>
    </div>
  );
}

export default StatusBar;
