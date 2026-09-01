import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "./components/App.js";
import { connectUiEvents } from "./store/connectUiEvents.js";
import { dispatchFixtureWorkItems } from "./store/fixtures.js";
import { createAppStore } from "./store/store.js";
import "./styles.css";

const store = createAppStore();

const useFixtures = import.meta.env.VITE_UI_FIXTURES === "1";
if (useFixtures) {
  dispatchFixtureWorkItems(store);
} else {
  connectUiEvents(store);
}

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
