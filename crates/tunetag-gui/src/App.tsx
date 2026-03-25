import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MenuBar from "./components/MenuBar";
import SplitPane from "./components/SplitPane";
import StatusBar from "./components/StatusBar";
import FileList from "./components/FileList";
import TagPanel from "./components/TagPanel";
import { FilesProvider, useFiles } from "./FilesContext";
import type { FileEntry } from "./types";

function AppInner() {
  const { state, setFiles } = useFiles();

  const loadDroppedPaths = useCallback(
    async (paths: string[]) => {
      try {
        const entries = await invoke<FileEntry[]>("scan_paths", {
          paths,
          recursive: state.recursive,
        });
        setFiles(entries);
      } catch {
        // Ignore errors
      }
    },
    [state.recursive, setFiles],
  );

  // Listen for Tauri drag-drop events
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length > 0) {
            loadDroppedPaths(paths);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadDroppedPaths]);

  return (
    <div className="h-screen flex flex-col bg-surface text-on-surface overflow-hidden">
      <MenuBar />
      <SplitPane
        left={<TagPanel />}
        right={<FileList />}
        defaultLeftWidth={288}
        minLeft={220}
        minRight={400}
      />
      <StatusBar
        filesLoaded={state.files.size}
        filesSelected={state.selectedIds.size}
        filesUnsaved={0}
      />
    </div>
  );
}

function App() {
  return (
    <FilesProvider>
      <AppInner />
    </FilesProvider>
  );
}

export default App;
