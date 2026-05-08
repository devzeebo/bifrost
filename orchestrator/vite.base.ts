import { type UserConfig, defineConfig } from "vite";
import dts from "vite-plugin-dts";

type ViteBaseOptions = {
  name: string;
  tsconfig: { references?: { path: string }[] };
  pkg: Record<string, unknown>;
};

export default ({
  name,
  tsconfig,
  pkg,
}: ViteBaseOptions): UserConfig =>
  defineConfig({
    plugins: [
      dts({
        tsconfigPath: "./tsconfig.json",
      }),
    ],
    build: {
      lib: {
        entry: "./src/index.ts",
        name,
        formats: ["es"],
        fileName: "index",
      },
      rollupOptions: {
        external: [
          ...Object.keys(("dependencies" in pkg && pkg.dependencies) ?? {}),
          ...Object.keys(("peerDependencies" in pkg && pkg.peerDependencies) ?? {}),
          ...(("references" in tsconfig && tsconfig.references) || []).map((ref: { path: string }) => ref.path),
          /^node:.*$/,
          /node_modules/,
        ],
      },
      target: "node24",
      emptyOutDir: true,
    },
  });
