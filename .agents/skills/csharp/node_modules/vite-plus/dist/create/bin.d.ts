//#region src/create/bin.d.ts
interface Options {
  directory?: string;
  interactive: boolean;
  list: boolean;
  help: boolean;
  verbose: boolean;
  agent?: string | string[] | false;
  editor?: string | false;
  git?: boolean;
  hooks?: boolean;
  packageManager?: string;
  /**
   * Approve and run gated dependency build scripts without prompting. Useful in
   * non-interactive runs that need a ready-to-use project.
   */
  approveBuilds?: boolean;
}
//#endregion
export { Options };