import MenuBar from "./components/MenuBar";
import SplitPane from "./components/SplitPane";
import StatusBar from "./components/StatusBar";
import FileList from "./components/FileList";
import TagPanel from "./components/TagPanel";

function App() {
  return (
    <div className="h-screen flex flex-col bg-white text-gray-900">
      <MenuBar />
      <SplitPane
        left={<TagPanel />}
        right={<FileList />}
        defaultSplit={0.25}
        minLeft={220}
        minRight={400}
      />
      <StatusBar filesLoaded={0} filesSelected={0} filesUnsaved={0} />
    </div>
  );
}

export default App;
