import pkg from "./package.json";
// @ts-ignore
import tsconfig from "./tsconfig.json";
// @ts-ignore
import base from "../../vite.base";

export default base({
  name: "task-source",
  pkg,
  tsconfig,
});
