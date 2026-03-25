import { useState, useRef, useCallback, useEffect } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // pixels, default 288 (w-72)
  minLeft?: number; // pixels
  minRight?: number; // pixels
}

function SplitPane({
  left,
  right,
  defaultLeftWidth = 288,
  minLeft = 220,
  minRight = 400,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const x = e.clientX - rect.left;

      const maxLeft = totalWidth - minRight;
      const newWidth = Math.max(minLeft, Math.min(maxLeft, x));
      setLeftWidth(newWidth);
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeft, minRight]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden"
      style={{ cursor: isDragging ? "col-resize" : undefined }}
    >
      {/* Left panel */}
      <div
        className="overflow-hidden shrink-0"
        style={{ width: `${leftWidth}px` }}
      >
        {left}
      </div>
      {/* Invisible drag handle — tonal separation does the visual work */}
      <div
        className="w-1 cursor-col-resize shrink-0 hover:bg-primary/20 transition-colors"
        onMouseDown={handleMouseDown}
      />
      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

export default SplitPane;
