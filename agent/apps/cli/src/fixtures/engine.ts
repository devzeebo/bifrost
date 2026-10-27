import { defineEngine } from "@bifrost-ai/engines";

const affinity = defineEngine({
  name: "affinity",
  prepare: (call) => call,
});

export default affinity;
