import { buildImages, type BuildImagesOptions } from "../images/build.js";
import { readRegistry, type RegistryOptions } from "../images/registry.js";
import { AgentFs } from "./agent-fs.js";
import { CONTAINER_INPUT, CONTAINER_OUTPUT } from "./base/constants.js";
import { resolveBinding } from "./binding-registry.js";
import { ensureDockerImage } from "./ensure-image.js";
import { runBoundAgent } from "./run-bound.js";
import { isStockAgentName } from "./stock.js";
import { readTrajectory, type Trajectory } from "./trajectory/index.js";
import type { AgentBinding, AgentRunResult, RunAgentOptions } from "./types.js";

type FromBinding = {
  readonly __fromBinding: AgentBinding;
};

/**
 * Resolve a stock short name (`cursor`, `claude`) or a registry image tag
 * (`cursor:node`) and run it with the matching binding.
 */
export class Agent {
  readonly name: string;
  readonly image: string;
  /** Host-staged files mounted read-only at `/agent/input`. */
  readonly input: AgentFs;
  /** Host-staged files mounted read-write at `/agent/output`. */
  readonly output: AgentFs;
  private readonly binding: AgentBinding;
  private readonly registryOptions: RegistryOptions;

  constructor(name: string, options?: RegistryOptions);
  constructor(fromBinding: FromBinding);
  constructor(nameOrBinding: string | FromBinding, options: RegistryOptions = {}) {
    this.input = new AgentFs(CONTAINER_INPUT);
    this.output = new AgentFs(CONTAINER_OUTPUT);

    if (typeof nameOrBinding !== "string") {
      const binding = nameOrBinding.__fromBinding;
      this.name = binding.image;
      this.image = binding.image;
      this.binding = binding;
      this.registryOptions = {};
      return;
    }

    const resolved = lookupAgent(nameOrBinding, options);
    this.name = nameOrBinding;
    this.image = resolved.image;
    this.binding = resolved.binding;
    this.registryOptions = options;
  }

  /** Wrap a custom binding that is not registered by name. */
  static fromBinding(binding: AgentBinding): Agent {
    return new Agent({ __fromBinding: binding });
  }

  async ensureImage(): Promise<void> {
    await ensureDockerImage(this.image);
  }

  async buildImage(options?: BuildImagesOptions): Promise<void> {
    await buildImages({ ...this.registryOptions, ...options });
  }

  async run(options: RunAgentOptions): Promise<AgentRunResult> {
    const inputHost = await this.input.ensure();
    const outputHost = await this.output.ensure();
    await this.output.clear();

    return runBoundAgent(this.binding, {
      workspace: options.workspace,
      prompt: options.prompt,
      image: options.image ?? this.image,
      ...(options.model !== undefined ? { model: options.model } : {}),
      ioVolumes: [
        { host: inputHost, container: this.input.containerPath, mode: "ro" },
        { host: outputHost, container: this.output.containerPath },
      ],
    });
  }

  /** Load and normalize the NDJSON trajectory written by the last {@link run}. */
  async trajectory(): Promise<Trajectory> {
    return readTrajectory(this.output, this.binding.trajectoryKind, this.binding.adaptEvents);
  }
}

function lookupAgent(
  name: string,
  options: RegistryOptions,
): { image: string; binding: AgentBinding } {
  if (isStockAgentName(name)) {
    const binding = resolveBinding(name);
    return { image: binding.image, binding };
  }

  const entry = readRegistry(options).images[name];
  if (entry === undefined) {
    throw new Error(
      `Unknown agent "${name}". Import \`@clanker-cleanroom/<agent>/register\` for a stock ` +
        `name, or use a tag recorded in clanker-cleanroom.images.json via buildImages().`,
    );
  }

  if (entry.agent === undefined) {
    throw new Error(`Image "${name}" is not a runnable agent (no stock agent in its FROM chain).`);
  }

  const stockBinding = resolveBinding(entry.agent);
  const binding: AgentBinding = { ...stockBinding, image: entry.image };
  return { image: entry.image, binding };
}
