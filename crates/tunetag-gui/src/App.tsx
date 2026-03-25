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
        left={<FileList />}
        right={<TagPanel />}
        defaultSplit={0.6}
      />
      <StatusBar filesLoaded={0} filesSelected={0} filesUnsaved={0} />
    </div>
  );
}

export default App;
