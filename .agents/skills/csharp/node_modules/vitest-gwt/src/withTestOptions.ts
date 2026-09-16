import type {
  TestOptions,
  SuiteCollector,
  RunnerTestSuite,
  TestRunner,
} from "vitest";

const suiteOptions = new WeakMap<object, TestOptions>();

export type WithTestOptions = (
  configure: (curr: TestOptions) => any,
) => void;

export type GetCurrentSuite = typeof TestRunner.getCurrentSuite;

export type WithTestOptionsBuilder = (
  getSuite: GetCurrentSuite,
) => WithTestOptions;

const getSuiteTask = (
  collector: SuiteCollector,
): RunnerTestSuite | undefined => collector.suite;

const resolveFromSuite = (
  suite: RunnerTestSuite | undefined,
): TestOptions | undefined => {
  let current: RunnerTestSuite | undefined = suite;

  while (current) {
    const options = suiteOptions.get(current);
    if (options) {
      return options;
    }
    current = current.suite;
  }

  return undefined;
};

export const resolveTestOptions = (
  collector: SuiteCollector,
): TestOptions | undefined => {
  const options = resolveFromSuite(getSuiteTask(collector));

  if (options == null || Object.keys(options).length === 0) {
    return undefined;
  }

  return options;
};

const withTestOptionsBuilder: WithTestOptionsBuilder =
  (getSuite) =>
  (configure): void => {
    const collector = getSuite();
    const suiteTask = getSuiteTask(collector);
    const parentOptions = suiteTask?.suite
      ? resolveFromSuite(suiteTask.suite)
      : undefined;
    const testOptions: TestOptions = { ...parentOptions };

    configure(testOptions);

    if (suiteTask) {
      suiteOptions.set(suiteTask, testOptions);
    }
  };

export default withTestOptionsBuilder;
