import type { LlmCallLog } from "../domain/types";

export interface LogLlmCallInput {
  userId: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  status: "success" | "error";
  errorMessage: string | null;
}

export interface LlmCallLogRepoPort {
  /** Records one OpenRouter call, success or failure. Read later by slice 4's admin analytics. */
  logCall(input: LogLlmCallInput): Promise<LlmCallLog>;
}
