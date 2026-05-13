import pkg from "./package.json";
// @ts-ignore
import base from "../../vite.base";
// @ts-ignore
import tsconfig from "./tsconfig.json";

export default base({
  name: "cli",
  pkg,
  tsconfig,
});
