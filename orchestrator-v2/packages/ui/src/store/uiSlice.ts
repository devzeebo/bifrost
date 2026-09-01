import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UiState = {
  expandedWorkflowIds: Record<string, boolean>;
  connectionStatus: "connecting" | "connected" | "disconnected";
};

const initialState: UiState = {
  expandedWorkflowIds: {},
  connectionStatus: "connecting",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleWorkflowExpanded(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.expandedWorkflowIds[id] = !(state.expandedWorkflowIds[id] ?? true);
    },
    setConnectionStatus(state, action: PayloadAction<UiState["connectionStatus"]>) {
      state.connectionStatus = action.payload;
    },
  },
});

export const { toggleWorkflowExpanded, setConnectionStatus } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
