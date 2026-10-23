import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems.js";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses.js";

export type TranscriptItem = ResponseInputItem;

export type Transcript = {
  appendUser: (text: string) => void;
  appendModelOutput: (output: readonly ResponseOutputItem[]) => void;
  appendToolOutput: (call: ResponseFunctionToolCall, output: string) => void;
  snapshot: () => readonly TranscriptItem[];
};

export const createTranscript = (items: readonly TranscriptItem[] = []): Transcript => {
  const input: TranscriptItem[] = [...items];

  return {
    appendUser: (text) => {
      input.push({ role: "user", content: text });
    },
    appendModelOutput: (output) => {
      input.push(...toResponseInputItems(output));
    },
    appendToolOutput: (call, output) => {
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output,
        ...(call.caller == null ? {} : { caller: call.caller }),
      });
    },
    snapshot: () => [...input],
  };
};
