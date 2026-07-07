export const doSomething = createScriptAgent(({ cwd, taskState }) => {
  console.log(`the cwd is ${cwd} for task ${JSON.stringify(taskState)}`);
});
