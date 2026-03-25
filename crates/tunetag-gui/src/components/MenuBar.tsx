import { useState, useRef, useEffect } from "react";

interface MenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const menus: Menu[] = [
  {
    label: "File",
    items: [
      { label: "Open Files\u2026", shortcut: "Ctrl+O" },
      { label: "Open Folder\u2026", shortcut: "Ctrl+Shift+O" },
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
      { label: "Toggle Recursive Folder Loading" },
      { separator: true, label: "" },
      { label: "Refresh", shortcut: "F5" },
    ],
  },
];

function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={menuBarRef}
      className="flex items-center h-8 bg-gray-100 border-b border-gray-300 text-sm select-none shrink-0"
    >
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative">
          <button
            className={`px-3 h-8 hover:bg-gray-200 ${
              openMenu === idx ? "bg-gray-200" : ""
            }`}
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            onMouseEnter={() => {
              if (openMenu !== null) setOpenMenu(idx);
            }}
          >
            {menu.label}
          </button>
          {openMenu === idx && (
            <div className="absolute left-0 top-8 bg-white border border-gray-300 shadow-lg rounded-sm min-w-48 py-1 z-50">
              {menu.items.map((item, itemIdx) =>
                item.separator ? (
                  <div
                    key={`sep-${itemIdx}`}
                    className="h-px bg-gray-200 my-1"
                  />
                ) : (
                  <button
                    key={item.label}
                    className={`w-full text-left px-4 py-1 flex justify-between items-center ${
                      item.disabled
                        ? "text-gray-400 cursor-default"
                        : "hover:bg-blue-500 hover:text-white"
                    }`}
                    disabled={item.disabled}
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-8 text-xs opacity-60">
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
    </div>
  );
}

export default MenuBar;
