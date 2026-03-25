import { useState, useRef, useEffect, useCallback } from "react";
import { ID3_GENRES } from "../genres";

interface GenreComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isKeep?: boolean;
}

function GenreCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = "",
  isKeep = false,
}: GenreComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync input with external value when not focused/open
  const displayValue = isKeep ? "<keep>" : value;

  const filtered = query.trim()
    ? ID3_GENRES.filter((g) =>
        g.toLowerCase().includes(query.toLowerCase()),
      )
    : ID3_GENRES;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    // If showing <keep> and user starts typing, clear it
    setQuery(v === "<keep>" ? "" : v);
    onChange(v === "<keep>" ? "" : v);
    setOpen(true);
  };

  const handleFocus = () => {
    if (isKeep) {
      setQuery("");
    } else {
      setQuery(value);
    }
    setOpen(true);
  };

  const handleSelect = useCallback(
    (genre: string) => {
      onChange(genre);
      setQuery(genre);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
  };

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={open ? query : displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full h-7 bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 text-[12px] px-2 pr-6 focus:ring-2 focus:ring-primary focus:outline-none rounded-sm transition-shadow disabled:opacity-60 ${
          isKeep ? "italic text-on-surface-variant" : ""
        }`}
      />
      {/* Chevron icon */}
      <svg
        className="absolute right-1.5 top-1.5 w-3.5 h-3.5 text-slate-400 pointer-events-none"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
      {/* Dropdown */}
      {open && !disabled && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-8 bg-white border border-slate-200 rounded-sm shadow-lg z-50 max-h-48 overflow-y-auto"
          style={{ boxShadow: "0 4px 20px rgba(27, 51, 83, 0.10)" }}
        >
          {filtered.slice(0, 100).map((genre) => (
            <button
              key={genre}
              className="w-full text-left px-2 py-1 text-[12px] text-on-surface hover:bg-primary-container hover:text-on-primary-container"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                handleSelect(genre);
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GenreCombobox;
