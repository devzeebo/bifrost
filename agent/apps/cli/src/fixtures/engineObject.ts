import { defineEngine } from "@bifrost-ai/engines";

const local = defineEngine({
  name: "local",
  prepare: (call) => call,
});

export default { engines: [local] };
