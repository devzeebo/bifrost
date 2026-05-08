import { describe, expect, it } from "vitest";
import { resolveGitRoot } from "./git-root.js";

describe("Git Root Resolution - US-10", () => {
  describe("FR-6: projectDir Resolution", () => {
    it("should set projectDir to git root when run from inside repository", async () => {
      // Given a developer runs the orchestrator from a directory inside a git repository
      // When the orchestrator program starts
      const root = await resolveGitRoot("/home/devzeebo/git/bifrost/orchestrator/packages/cli");

      // Then projectDir is set to the git root
      expect(root).toContain("/bifrost");
    });

    it("should find git root from subdirectory", async () => {
      // Given a git repository rooted at /home/user/myrepo
      // And a developer runs the orchestrator from /home/user/myrepo/src/lib
      const root = await resolveGitRoot("/home/devzeebo/git/bifrost/orchestrator/packages/cli/src");

      // When the orchestrator program starts
      // Then projectDir is /home/user/myrepo
      expect(root).toBeTruthy();
    });

    it("should exit with error when not inside a git repository", async () => {
      // Given a developer runs the orchestrator from a directory that is not inside any git repository
      // When the orchestrator program starts
      const root = await resolveGitRoot("/tmp/nonexistent/path");

      // Then it exits with a descriptive error stating that no git root could be found
      expect(root).toBeNull();
    });
  });
});
