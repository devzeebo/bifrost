import { defineEngine } from "@bifrost-ai/engines";

const first = defineEngine({
  name: "first",
  prepare: (call) => call,
});

const second = defineEngine({
  name: "second",
  receive: (result) => result,
});

export default [first, second];
