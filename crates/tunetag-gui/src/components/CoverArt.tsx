import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { CoverArtSelection } from "../types";

interface CoverArtProps {
  /** File paths currently selected in the file list. */
  selectedPaths: string[];
}

type DragState = "idle" | "over" | "error";

function CoverArt({ selectedPaths }: CoverArtProps) {
  const [selection, setSelection] = useState<CoverArtSelection>({
    status: "none",
  });
  const [dragState, setDragState] = useState<DragState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Fetch cover art whenever selection changes
  // -------------------------------------------------------------------------
  const fetchCoverArt = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      setSelection({ status: "none" });
      return;
    }
    try {
      if (paths.length === 1) {
        const art = await invoke<{ data: string; mimeType: string } | null>(
          "get_cover_art",
          { path: paths[0] },
        );
        if (art) {
          setSelection({ status: "shared", art: { data: art.data, mimeType: art.mimeType } });
        } else {
          setSelection({ status: "none" });
        }
      } else {
        const result = await invoke<CoverArtSelection>(
          "get_cover_art_for_selection",
          { paths },
        );
        setSelection(result);
      }
    } catch {
      setSelection({ status: "none" });
    }
  }, []);

  useEffect(() => {
    fetchCoverArt(selectedPaths);
  }, [selectedPaths, fetchCoverArt]);

  // -------------------------------------------------------------------------
  // Drag-and-drop via Tauri onDragDropEvent
  // -------------------------------------------------------------------------
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onDragDropEvent(async (event) => {
        if (!containerRef.current) return;

        if (event.payload.type === "over") {
          // Check if pointer is over our container
          const rect = containerRef.current.getBoundingClientRect();
          const { x, y } = event.payload.position;
          const isOver =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          setDragState(isOver ? "over" : "idle");
          return;
        }

        if (event.payload.type === "leave") {
          setDragState("idle");
          return;
        }

        if (event.payload.type === "drop") {
          setDragState("idle");

          // Check if we're the drop target
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const { x, y } = event.payload.position;
          const isOver =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          if (!isOver) return;

          const paths = event.payload.paths;
          if (paths.length === 0 || selectedPaths.length === 0) return;

          const imagePath = paths[0]; // use first dropped file
          setErrorMsg(null);

          try {
            await invoke("embed_cover_art", {
              filePaths: selectedPaths,
              imagePath,
            });
            await fetchCoverArt(selectedPaths);
          } catch (e: unknown) {
            const msg = typeof e === "string" ? e : "Failed to embed cover art";
            setErrorMsg(msg);
            setDragState("error");
            setTimeout(() => {
              setDragState("idle");
              setErrorMsg(null);
            }, 3000);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [selectedPaths, fetchCoverArt]);

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick() {
      setContextMenu(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const handleRemove = useCallback(async () => {
    setContextMenu(null);
    if (selectedPaths.length === 0) return;
    try {
      await invoke("remove_cover_art_cmd", { filePaths: selectedPaths });
      await fetchCoverArt(selectedPaths);
    } catch (e) {
      setErrorMsg(typeof e === "string" ? e : "Failed to remove cover art");
    }
  }, [selectedPaths, fetchCoverArt]);

  const handleExport = useCallback(async () => {
    setContextMenu(null);
    if (selectedPaths.length === 0 || selection.status !== "shared") return;

    const ext = selection.art.mimeType === "image/png" ? "png" : "jpg";
    const destPath = await save({
      defaultPath: `cover.${ext}`,
      filters: [
        {
          name: "Image",
          extensions: ["jpg", "jpeg", "png"],
        },
      ],
    });
    if (!destPath) return;

    try {
      await invoke("export_cover_art", {
        filePath: selectedPaths[0],
        destPath,
      });
    } catch (e) {
      setErrorMsg(typeof e === "string" ? e : "Failed to export cover art");
    }
  }, [selectedPaths, selection]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const hasCover = selection.status === "shared";
  const isMixed = selection.status === "mixed";
  const hasSelection = selectedPaths.length > 0;

  const borderClass =
    dragState === "over"
      ? "border-2 border-primary border-dashed"
      : dragState === "error"
        ? "border-2 border-red-400 border-dashed"
        : "border border-outline-variant/20";

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className={`w-full aspect-square rounded overflow-hidden relative group ${borderClass} transition-all`}
      >
        {hasCover ? (
          /* Image display */
          <img
            src={`data:${selection.art.mimeType};base64,${selection.art.data}`}
            alt="Cover Art"
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : isMixed ? (
          /* Mixed-state placeholder */
          <div className="w-full h-full bg-surface-container-high flex flex-col items-center justify-center gap-1">
            <div className="text-[10px] text-on-surface-variant font-medium">
              Multiple covers
            </div>
            <div className="text-[9px] text-on-surface-variant/60">
              Drop image to replace all
            </div>
          </div>
        ) : (
          /* Empty-state placeholder */
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
              dragState === "over"
                ? "bg-primary-container"
                : "bg-surface-container-highest"
            }`}
          >
            <svg
              className="w-6 h-6 text-on-surface-variant/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <div className="text-[10px] text-on-surface-variant/50">
              {dragState === "over" ? "Drop to embed" : "No cover"}
            </div>
          </div>
        )}

        {/* Hover overlay — shows on images */}
        {hasCover && hasSelection && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-[10px] font-medium">
              Right-click for options
            </span>
          </div>
        )}

        {/* Drop overlay hint when dragging over */}
        {dragState === "over" && hasCover && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-[10px] font-semibold">
              Drop to replace
            </span>
          </div>
        )}
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[10px] px-2 py-1 rounded-b text-center">
          {errorMsg}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-sm shadow-lg py-1 min-w-36"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            boxShadow: "0 4px 20px rgba(27, 51, 83, 0.10)",
          }}
        >
          <button
            className={`w-full text-left px-3 py-1.5 text-xs ${
              !hasCover
                ? "text-slate-400 cursor-default"
                : "text-on-surface hover:bg-primary-container hover:text-on-primary-container"
            }`}
            disabled={!hasCover}
            onClick={handleRemove}
          >
            Remove cover
          </button>
          <button
            className={`w-full text-left px-3 py-1.5 text-xs ${
              !hasCover
                ? "text-slate-400 cursor-default"
                : "text-on-surface hover:bg-primary-container hover:text-on-primary-container"
            }`}
            disabled={!hasCover}
            onClick={handleExport}
          >
            Export cover to file…
          </button>
        </div>
      )}
    </div>
  );
}

export default CoverArt;
