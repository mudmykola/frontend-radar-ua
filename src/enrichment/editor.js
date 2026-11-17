export function createAiEditor(env, options) {
  const { callText, requestCompletionWithFallback } = options;

  return { extractFacts, summarize };

  async function extractFacts(request) {
    return callText({
      temperature: 0,
      maxTokens: request.maxTokens || 900,
      system: request.system,
      prompt: request.prompt,
    });
  }

  async function summarize(request) {
    return requestCompletionWithFallback({
      model: request.model,
      temperature: request.temperature ?? 0.2,
      maxTokens: request.maxTokens || 1800,
      system: request.system,
      prompt: request.prompt,
    });
  }
}
