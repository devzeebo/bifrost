import { defineEngine } from "@agent/engines";

const local = defineEngine({
  name: "local",
  prepare: (call) => call,
});

export default { engines: [local] };
