import pkg from "./package.json";
// @ts-ignore
import base from "../../vite.base";
import tsconfig from "./tsconfig.json";

export default base({
  name: "core",
  pkg,
  tsconfig,
});
