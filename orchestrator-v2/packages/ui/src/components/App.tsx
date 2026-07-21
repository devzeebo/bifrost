import { useSelector } from "react-redux";

import type { RootState } from "../store/store.js";
import { WorkItemTree } from "./WorkItemTree.js";

export function App() {
  const connectionStatus = useSelector((state: RootState) => state.ui.connectionStatus);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Open work</h1>
        <p className={`connection connection-${connectionStatus}`}>{connectionStatus}</p>
      </header>
      <main>
        <WorkItemTree />
      </main>
    </div>
  );
}
