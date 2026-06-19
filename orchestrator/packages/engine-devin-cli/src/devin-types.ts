export type ParsedOutput = {
  summary: string;
  sessionId?: string;
};

export type DevinCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
};
