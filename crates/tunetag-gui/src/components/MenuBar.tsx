import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFiles } from "../FilesContext";
import type { FileEntry } from "../types";

interface MenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
  action?: () => void;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const { state, setFiles, toggleRecursive } = useFiles();

  const handleOpenFiles = useCallback(async () => {
    setOpenMenu(null);
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Audio Files",
            extensions: ["mp3", "flac", "m4a", "MP3", "FLAC", "M4A"],
          },
        ],
      });
      if (!selected) return;

      // selected is string | string[] depending on multiple
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;

      const entries = await invoke<FileEntry[]>("scan_paths", {
        paths,
        recursive: false,
      });
      setFiles(entries);
    } catch {
      // User cancelled or error — do nothing
    }
  }, [setFiles]);

  const handleOpenFolder = useCallback(async () => {
    setOpenMenu(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (!selected) return;

      const folderPath = typeof selected === "string" ? selected : selected[0];
      if (!folderPath) return;

      const entries = await invoke<FileEntry[]>("scan_paths", {
        paths: [folderPath],
        recursive: state.recursive,
      });
      setFiles(entries);
    } catch {
      // User cancelled or error — do nothing
    }
  }, [state.recursive, setFiles]);

  const handleToggleRecursive = useCallback(() => {
    setOpenMenu(null);
    toggleRecursive();
  }, [toggleRecursive]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "O") {
        e.preventDefault();
        handleOpenFolder();
      } else if (e.ctrlKey && !e.shiftKey && e.key === "o") {
        e.preventDefault();
        handleOpenFiles();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenFiles, handleOpenFolder]);

  const menus: Menu[] = [
    {
      label: "File",
      items: [
        {
          label: "Open Files\u2026",
          shortcut: "Ctrl+O",
          action: handleOpenFiles,
        },
        {
          label: "Open Folder\u2026",
          shortcut: "Ctrl+Shift+O",
          action: handleOpenFolder,
        },
        { separator: true, label: "" },
        { label: "Save", shortcut: "Ctrl+S", disabled: true },
        { separator: true, label: "" },
        { label: "Close All", disabled: true },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", disabled: true },
        { label: "Redo", shortcut: "Ctrl+Shift+Z", disabled: true },
        { separator: true, label: "" },
        { label: "Select All", shortcut: "Ctrl+A", disabled: true },
      ],
    },
    {
      label: "Convert",
      items: [
        { label: "Rename Files from Tags\u2026", disabled: true },
        { label: "Auto-number Tracks\u2026", disabled: true },
      ],
    },
    {
      label: "Tag Sources",
      items: [{ label: "MusicBrainz\u2026", disabled: true }],
    },
    {
      label: "View",
      items: [
        {
          label: "Toggle Recursive Folder Loading",
          checked: state.recursive,
          action: handleToggleRecursive,
        },
        { separator: true, label: "" },
        { label: "Refresh", shortcut: "F5", disabled: true },
      ],
    },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuBarRef.current &&
        !menuBarRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      ref={menuBarRef}
      className="flex h-10 w-full items-center px-4 justify-between bg-slate-50 border-b border-slate-200/50 select-none shrink-0 z-50"
    >
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold tracking-tighter text-slate-900">
          TuneTag
        </span>
        <nav className="flex items-center gap-1">
          {menus.map((menu, idx) => (
            <div key={menu.label} className="relative">
              <button
                className={`text-xs font-medium tracking-tight px-2 py-1 rounded transition-colors ${
                  openMenu === idx
                    ? "text-primary font-semibold bg-slate-200/50"
                    : "text-slate-600 hover:bg-slate-200/50"
                }`}
                onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
                onMouseEnter={() => {
                  if (openMenu !== null) setOpenMenu(idx);
                }}
              >
                {menu.label}
              </button>
              {openMenu === idx && (
                <div
                  className="absolute left-0 top-8 bg-surface-bright border border-slate-200/60 min-w-48 py-1 z-50 rounded-md"
                  style={{ boxShadow: "0 4px 20px rgba(27, 51, 83, 0.06)" }}
                >
                  {menu.items.map((item, itemIdx) =>
                    item.separator ? (
                      <div
                        key={`sep-${itemIdx}`}
                        className="h-px bg-slate-200/60 my-1"
                      />
                    ) : (
                      <button
                        key={item.label}
                        className={`w-full text-left px-3 py-1.5 flex justify-between items-center text-xs ${
                          item.disabled
                            ? "text-slate-400 cursor-default"
                            : "text-on-surface hover:bg-primary-container hover:text-on-primary-container"
                        }`}
                        disabled={item.disabled}
                        onClick={() => {
                          if (item.action) {
                            item.action();
                          } else {
                            setOpenMenu(null);
                          }
                        }}
                      >
                        <span className="flex items-center gap-2">
                          {item.checked !== undefined && (
                            <span
                              className={`w-3 h-3 border rounded-sm flex items-center justify-center text-[9px] ${
                                item.checked
                                  ? "bg-primary border-primary text-on-primary"
                                  : "border-outline-variant"
                              }`}
                            >
                              {item.checked ? "\u2713" : ""}
                            </span>
                          )}
                          {item.label}
                        </span>
                        {item.shortcut && (
                          <span className="ml-8 text-[10px] text-slate-400 font-mono">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

    </header>
  );
}

export default MenuBar;
