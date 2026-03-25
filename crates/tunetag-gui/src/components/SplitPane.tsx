import { useState, useRef, useCallback, useEffect } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // 0-1, default 0.6
  minLeft?: number; // pixels
  minRight?: number; // pixels
}

function SplitPane({
  left,
  right,
  defaultSplit = 0.6,
  minLeft = 200,
  minRight = 250,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(defaultSplit);
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

      // Clamp to min sizes
      const minSplit = minLeft / totalWidth;
      const maxSplit = (totalWidth - minRight) / totalWidth;
      const newSplit = Math.max(minSplit, Math.min(maxSplit, x / totalWidth));
      setSplit(newSplit);
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
      <div
        className="overflow-hidden"
        style={{ width: `${split * 100}%` }}
      >
        {left}
      </div>
      <div
        className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize shrink-0 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div
        className="overflow-auto"
        style={{ width: `${(1 - split) * 100}%` }}
      >
        {right}
      </div>
    </div>
  );
}

export default SplitPane;
