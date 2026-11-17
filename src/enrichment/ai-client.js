export function createAiClient(env, options) {
  const {
    normalizeBaseUrl,
    normalizeList,
    clampNumber,
    delay,
    safeErrorMessage,
    retryableStatuses,
    maxRetries: defaultMaxRetries,
    retryBaseDelayMs,
  } = options;

  return {
    callText,
    requestCompletion,
    requestCompletionWithFallback,
  };

  async function callText(request) {
    const baseUrl = normalizeBaseUrl(env.AI_BASE_URL);
    const model = String(env.AI_MODEL || "").trim();

    if (!baseUrl) throw new Error("Missing AI_BASE_URL");
    if (!model) throw new Error("Missing AI_MODEL");
    if (!env.AI_API_KEY) throw new Error("Missing AI_API_KEY");

    return requestCompletionWithFallback({ ...request, model });
  }

  async function requestCompletionWithFallback(request, dependencies = {}) {
    const models = normalizeList([
      request.model || env.AI_MODEL,
      ...String(env.AI_FALLBACK_MODELS || "").split(","),
    ]).filter(Boolean);
    let lastError;

    for (const model of models) {
      try {
        return await requestCompletion({ ...request, model }, {
          ...dependencies,
          maxRetries: dependencies.maxRetries ?? 1,
        });
      } catch (error) {
        lastError = error;
        if (!/status (404|429|500|502|503|504)|тимчасово недоступний/i.test(String(error?.message || error))) throw error;
        console.warn("AI model fallback:", { model, error: safeErrorMessage(error) });
      }
    }

    throw lastError || new Error("No AI model is available");
  }

  async function requestCompletion(request, dependencies = {}) {
    const baseUrl = normalizeBaseUrl(env.AI_BASE_URL);
    const fetchImpl = dependencies.fetchImpl || fetch;
    const sleepImpl = dependencies.sleepImpl || delay;
    const model = String(request.model || env.AI_MODEL || "").trim();
    const maxRetries = clampNumber(dependencies.maxRetries ?? defaultMaxRetries, 0, 5);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetchImpl(baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.AI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? 900,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text || data?.response || "";
        if (!String(content).trim()) throw new Error("AI returned empty response");
        return String(content).trim();
      }

      const retryable = retryableStatuses.has(response.status);
      const retryAfterSeconds = Number(response.headers.get("retry-after") || 0);
      await response.body?.cancel();

      if (!retryable || attempt === maxRetries) {
        if (retryable) throw new Error("Gemini тимчасово недоступний після " + (attempt + 1) + " спроб (status " + response.status + ")");
        throw new Error("AI request failed with status " + response.status);
      }

      const exponentialDelay = retryBaseDelayMs * 2 ** attempt;
      const retryAfterDelay = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
      await sleepImpl(Math.min(Math.max(exponentialDelay, retryAfterDelay), 10000));
    }

    throw new Error("Gemini тимчасово недоступний");
  }
}
