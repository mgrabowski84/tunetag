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
    <footer className="flex justify-between items-center px-3 bg-slate-50 border-t border-slate-200/50 h-6 select-none shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[10px] font-mono tracking-tight text-slate-500">
          {filesLoaded} files loaded | {filesSelected} selected | {filesUnsaved}{" "}
          unsaved
        </span>
        <div className="h-3 w-px bg-slate-300" />
        <span className="text-[10px] font-mono tracking-tight text-primary">
          Ready
        </span>
      </div>
      <div className="flex items-center">
        <span className="text-[10px] font-mono tracking-tight text-slate-400">
          v0.1.0
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
