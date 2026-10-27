import { defineEngine } from "@agent/engines";

const affinity = defineEngine({
  name: "affinity",
  prepare: (call) => call,
});

export default affinity;
