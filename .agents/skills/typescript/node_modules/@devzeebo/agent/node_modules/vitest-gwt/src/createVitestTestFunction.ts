import type { test as vitestTest, SuiteCollector, TestOptions } from "vitest";
import type { TestFunction } from "gwt-runner";
import type { GetCurrentSuite } from "./withTestOptions";
import { resolveTestOptions } from "./withTestOptions";

export type CreateVitestTestFunction = (
  test: typeof vitestTest,
  getSuite: GetCurrentSuite,
) => TestFunction;

const createVitestTestFunction: CreateVitestTestFunction =
  (test, getSuite) =>
  (name, callback) => {
    const options: TestOptions | undefined = resolveTestOptions(
      getSuite() as SuiteCollector,
    );

    if (options) {
      return test(name, options, callback);
    }

    return test(name, callback);
  };

export default createVitestTestFunction;
