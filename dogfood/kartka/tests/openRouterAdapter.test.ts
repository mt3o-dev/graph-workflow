import { describe, test, expect } from "bun:test";
import { createOpenRouterAdapter } from "../src/adapters/llm/openRouterAdapter";
import type { LlmCallLogRepoPort, LogLlmCallInput } from "../src/core/ports/llmCallLogRepoPort";

// No real network calls — fetchImpl is injected with a fake Response, per
// slice 2's testing requirement.
function makeFakeLlmCallLogRepo() {
  const calls: LogLlmCallInput[] = [];
  const repo: LlmCallLogRepoPort = {
    async logCall(input) {
      calls.push(input);
      return { ...input, id: "fake", requestedAt: new Date() };
    },
  };
  return { repo, calls };
}

function fakeFetch(response: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({
    ok,
    status,
    json: async () => response,
  })) as unknown as typeof fetch;
}

describe("openRouterAdapter (fake fetch, no network)", () => {
  test("returns validated drafts and logs a success call with usage/cost", async () => {
    const { repo, calls } = makeFakeLlmCallLogRepo();
    const fetchImpl = fakeFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              drafts: [{ type: "basic", payload: { front: "Q", back: "A" }, confidence: 0.7, rationale: "r" }],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });

    const adapter = createOpenRouterAdapter({ apiKey: "test-key", model: "anthropic/claude-3.5-haiku", fetchImpl }, repo);
    const drafts = await adapter.generateCards({ sourceText: "source", setId: "set-1", userId: "user-1" });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.type).toBe("basic");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.status).toBe("success");
    expect(calls[0]!.totalTokens).toBe(120);
    expect(calls[0]!.estimatedCostUsd).toBeGreaterThan(0);
  });

  test("returns [] (not a crash) and still logs success when the model's content is garbage", async () => {
    const { repo, calls } = makeFakeLlmCallLogRepo();
    const fetchImpl = fakeFetch({
      choices: [{ message: { content: "sorry, I can't help with that today!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const adapter = createOpenRouterAdapter({ apiKey: "test-key", model: "anthropic/claude-3.5-haiku", fetchImpl }, repo);
    const drafts = await adapter.generateCards({ sourceText: "source", setId: "set-1", userId: "user-1" });

    expect(drafts).toEqual([]);
    expect(calls[0]!.status).toBe("success"); // the HTTP call itself succeeded
  });

  test("logs an error call and throws when OpenRouter returns a non-OK response", async () => {
    const { repo, calls } = makeFakeLlmCallLogRepo();
    const fetchImpl = fakeFetch({ error: { message: "Invalid API key" } }, false, 401);

    const adapter = createOpenRouterAdapter({ apiKey: "bad-key", model: "anthropic/claude-3.5-haiku", fetchImpl }, repo);

    await expect(adapter.generateCards({ sourceText: "source", setId: "set-1", userId: "user-1" })).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.status).toBe("error");
    expect(calls[0]!.errorMessage).toContain("Invalid API key");
  });
});
