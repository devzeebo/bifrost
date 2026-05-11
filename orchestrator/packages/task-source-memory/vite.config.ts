// @ts-ignore
import base from "../../vite.base";
import pkg from "./package.json";
// @ts-ignore
import tsconfig from "./tsconfig.json";

export default base({
  name: "tast-source-memory",
  pkg,
  tsconfig,
});
