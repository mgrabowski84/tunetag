function FileList() {
  return (
    <section className="flex-1 flex flex-col bg-surface-container-lowest overflow-hidden">
      {/* Table header — always visible */}
      <div className="shrink-0 overflow-x-auto">
        <table className="w-full border-collapse text-left table-fixed min-w-[700px]">
          <colgroup>
            <col className="w-10" />
            <col className="w-10" />
            <col />
            <col className="w-40" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-14" />
            <col className="w-14" />
            <col className="w-20" />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="bg-surface-container-high border-b border-slate-200">
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter text-center">
                #
              </th>
              <th className="px-2 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter">
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Filename
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Title
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Artist
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Album
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Year
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Track
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Genre
              </th>
              <th className="px-3 py-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-tighter border-l border-slate-200/40">
                Format
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center text-on-surface-variant/60 text-sm">
        Open files or drag and drop audio files here
      </div>
    </section>
  );
}

export default FileList;
