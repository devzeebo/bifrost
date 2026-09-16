import type {
  beforeEach as vitestBeforeEach,
  afterEach as vitestAfterEach,
} from "vitest";
import { TestContext } from "gwt-runner";

export type AspectFunction<T = unknown> = {
  (this: T): unknown;
  timeout?: number;
};

export type WithAspectBuilder = (
  beforeEach: typeof vitestBeforeEach,
  afterEach: typeof vitestAfterEach,
) => <T>(before: AspectFunction<T>, after?: AspectFunction<T>) => void;

const withAspectBuilder: WithAspectBuilder =
  (beforeEach, afterEach) =>
  <T>(before: AspectFunction<T>, after?: AspectFunction<T>): void => {
    beforeEach(async () => {
      TestContext.createContext();

      await (before.bind(TestContext.context as T) as any)();
    }, before.timeout);

    afterEach(async () => {
      if (after) {
        await (after.bind(TestContext.context as T) as any)();
      }

      TestContext.releaseContext();
    }, after?.timeout);
  };

export default withAspectBuilder;
