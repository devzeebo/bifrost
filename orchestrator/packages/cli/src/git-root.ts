import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolve the git repository root by walking up from the current directory.
 * FR-6: projectDir Resolution
 * US-10: projectDir resolved from git root of CWD
 *
 * @param startPath - The starting directory path
 * @returns The git root directory path, or null if not found
 */
export const resolveGitRoot = async (startPath: string): Promise<string | null> => {
  let currentPath = resolve(startPath);

  // Walk up the directory tree
  while (currentPath !== '/') {
    const gitDir = resolve(currentPath, '.git');

    if (existsSync(gitDir)) {
      return currentPath;
    }

    // Move up one directory
    const parentPath = resolve(currentPath, '..');

    // Prevent infinite loop
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  // No git root found
  return null;
};
