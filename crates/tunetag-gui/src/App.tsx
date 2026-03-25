import MenuBar from "./components/MenuBar";
import SplitPane from "./components/SplitPane";
import StatusBar from "./components/StatusBar";
import FileList from "./components/FileList";
import TagPanel from "./components/TagPanel";

function App() {
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
      <StatusBar filesLoaded={0} filesSelected={0} filesUnsaved={0} />
    </div>
  );
}

export default App;
