import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default ({
  name,
  tsconfig,
  pkg,
}: {
  name: string;
  tsconfig: { references?: Array<{ path: string }> };
  pkg: Record<string, unknown>;
}) =>
  defineConfig({
    plugins: [
      dts({
        tsconfigPath: './tsconfig.json',
      }),
    ],
    build: {
      lib: {
        entry: './src/index.ts',
        name,
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external: [
          ...Object.keys(('dependencies' in pkg && pkg.dependencies) ?? {}),
          ...Object.keys(('peerDependencies' in pkg && pkg.peerDependencies) ?? {}),
          ...(('references' in tsconfig && tsconfig.references) || []).map((x: any) => x.path),
          /^node:.*$/,
          /node_modules/,
        ],
      },
      target: 'node20',
      emptyOutDir: true,
    },
  });
