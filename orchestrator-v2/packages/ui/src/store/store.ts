import { configureStore } from "@reduxjs/toolkit";

import { uiReducer } from "./uiSlice.js";
import { workItemsReducer } from "./workItemsSlice.js";

export function createAppStore() {
  return configureStore({
    reducer: {
      workItems: workItemsReducer,
      ui: uiReducer,
    },
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
