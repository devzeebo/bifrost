//#region src/utils/tsgolint-path.d.ts
declare function resolveWindowsTsgolintExecutable(pathCandidates: string[], options: {
  exists: (path: string) => boolean;
  getRealpathCandidates?: () => string[];
}): string;
declare function resolveTsgolintExecutable(tsgolintBinPath: string, scriptUrl: string): string;
//#endregion
export { resolveTsgolintExecutable, resolveWindowsTsgolintExecutable };