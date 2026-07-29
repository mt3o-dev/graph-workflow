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
  /**
   * All logged calls, newest first — fed into core/domain/adminAnalytics.ts's
   * pure aggregation function. Unfiltered/unpaginated: the admin cost
   * dashboard is a "simple summary, not full BI" (slice 4 scope), and
   * llm_call_log is expected to stay small enough for this dogfood app; if
   * that stops being true, add date-range filtering here first.
   */
  listAll(): Promise<LlmCallLog[]>;
}
