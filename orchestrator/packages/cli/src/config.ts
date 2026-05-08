import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as yamlParse } from 'yaml';

export type TaskSourceConfig = {
  type: string;
  settings?: Record<string, unknown>;
};

export type EngineConfig = {
  type: string;
  settings?: Record<string, unknown>;
};

export type TaskStateStoreConfig = {
  type: 'redis' | 'memory' | 'file';
  settings?: Record<string, unknown>;
};

export type OrchestrateConfig = {
  task_source: TaskSourceConfig;
  engine: EngineConfig;
  task_state_store: TaskStateStoreConfig;
  concurrency: number;
  claimant: string | null;
  logging: 'normal' | 'verbose';
};

export type OrchestratorConfig = {
  orchestrate: OrchestrateConfig;
};

const DEFAULT_CONFIG: OrchestratorConfig = {
  orchestrate: {
    task_source: { type: 'memory' },
    engine: { type: 'test' },
    task_state_store: { type: 'memory' },
    concurrency: 1,
    claimant: null,
    logging: 'normal',
  },
};

/**
 * Load .orchestrator.yaml configuration file.
 * FR-13: Configuration
 * US-8: System Administrator - Configure Multiple Sources and Engines
 *
 * @param projectDir - The project directory path
 * @returns Parsed configuration
 */
export const loadConfig = async (projectDir: string): Promise<OrchestratorConfig> => {
  // Try project directory first, then home directory
  const projectConfigPath = resolve(projectDir, '.orchestrator.yaml');
  const homeConfigPath = resolve(homedir(), '.orchestrator.yaml');

  let configContent: string;

  try {
    configContent = await readFile(projectConfigPath, 'utf-8');
  } catch {
    try {
      configContent = await readFile(homeConfigPath, 'utf-8');
    } catch {
      // No config file found, return defaults
      return DEFAULT_CONFIG;
    }
  }

  const parsed = yamlParse(configContent) as Record<string, unknown>;

  if (!parsed.orchestrate) {
    return DEFAULT_CONFIG;
  }

  const orchestrate = parsed.orchestrate as Record<string, unknown>;

  // Validate task source type
  const taskSource = orchestrate.task_source as TaskSourceConfig | undefined;
  const taskSourceType = taskSource?.type || 'memory';

  // FR-13: If unknown task source type, raise error
  const validTaskSourceTypes = ['api', 'memory', 'file', 'queue'];
  if (!validTaskSourceTypes.includes(taskSourceType)) {
    throw new Error(`Unknown task source type: ${taskSourceType}`);
  }

  // Extract settings
  const taskSourceSettings = (taskSource?.settings as Record<string, unknown>) || {};

  const engine = orchestrate.engine as EngineConfig | undefined;
  const engineSettings = (engine?.settings as Record<string, unknown>) || {};

  const taskStateStore = orchestrate.task_state_store as TaskStateStoreConfig | undefined;
  const taskStateStoreSettings = (taskStateStore?.settings as Record<string, unknown>) || {};

  // Parse optional fields with defaults
  const concurrency = typeof orchestrate.concurrency === 'number' ? orchestrate.concurrency : 1;
  const claimant = typeof orchestrate.claimant === 'string' ? orchestrate.claimant : null;
  const logging = (orchestrate.logging === 'verbose' ? 'verbose' : 'normal') as
    | 'normal'
    | 'verbose';

  return {
    orchestrate: {
      task_source: {
        type: taskSourceType,
        settings: taskSourceSettings,
      },
      engine: {
        type: engine?.type || 'test',
        settings: engineSettings,
      },
      task_state_store: {
        type: (taskStateStore?.type as 'redis' | 'memory' | 'file') || 'memory',
        settings: taskStateStoreSettings,
      },
      concurrency,
      claimant,
      logging,
    },
  };
};
