import { useSelector } from "react-redux";

import type { RootState } from "../store/store.js";
import { WorkItemTree } from "./WorkItemTree.js";

export function App() {
  const connectionStatus = useSelector((state: RootState) => state.ui.connectionStatus);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-block">
          <p className="brand-mark">Bifrost</p>
          <h1>Open work</h1>
        </div>
        <p className={`connection connection-${connectionStatus}`}>
          <span className="connection-dot" aria-hidden="true" />
          {connectionStatus}
        </p>
      </header>
      <main>
        <WorkItemTree />
      </main>
    </div>
  );
}
