import OpenAI from 'openai';

// Default model name fallback
const defaultModelName = process.env.DEFAULT_MODEL_NAME || 'deepseek-chat';

/**
 * Dynamic AI client factory.
 * Reads per-request headers set by the frontend (from localStorage config).
 * Supports: DeepSeek, Kimi, Gemini (OpenAI-compat), Claude (via proxy), OpenAI, Custom.
 *
 * IMPORTANT: When the user provides a custom baseUrl (e.g. DeepSeek), we MUST
 * NOT fall back to the sandbox proxy (OPENAI_BASE_URL env var), which only
 * supports a limited set of models.  We therefore never read OPENAI_BASE_URL
 * here; the only fallback is the user-supplied value.
 */
export function createAIClient(req: Request): OpenAI {
  const customApiKey = req.headers.get('x-custom-api-key');
  const customBaseUrl = req.headers.get('x-custom-base-url');

  if (customApiKey && customBaseUrl) {
    // Claude via Anthropic's native API requires special headers.
    const isAnthropicNative = customBaseUrl.includes('api.anthropic.com');
    const defaultHeaders: Record<string, string> = {};
    if (isAnthropicNative) {
      defaultHeaders['anthropic-version'] = '2023-06-01';
      defaultHeaders['x-api-key'] = customApiKey;
    }

    return new OpenAI({
      apiKey: customApiKey,
      // Use the user-supplied base URL directly — do NOT fall back to env proxy
      baseURL: customBaseUrl,
      defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      // Increase timeout for slower providers (reasoning models need more time)
      timeout: 180_000,
    });
  }

  // No user config provided — throw a clear error so the frontend can guide the user
  throw new Error('NO_API_KEY_CONFIGURED');
}

/**
 * Get the model name from the request header, falling back to env default.
 */
export function getModelName(req: Request): string {
  return req.headers.get('x-custom-model') || defaultModelName;
}

/**
 * Get the provider name from the request header.
 */
export function getProvider(req: Request): string {
  return req.headers.get('x-custom-provider') || '';
}

/**
 * Remove trailing commas before } or ] — a common quirk in Kimi/Moonshot output.
 */
function fixTrailingCommas(json: string): string {
  let fixed = json.replace(/,\s*([}\]])/g, '$1');
  // Fix malformed hashtag strings: #"tag" → "#tag"
  // e.g. #"祛湿茶" → "#祛湿茶"
  fixed = fixed.replace(/#"([^"]+)"/g, '"#$1"');
  return fixed;
}

/**
 * Strip markdown code fences and extract the first valid JSON object/array.
 * Handles:
 *   - ```json ... ``` or ``` ... ``` wrappers (Gemini, Kimi, etc.)
 *   - Leading/trailing prose around the JSON block
 *   - Trailing commas before } or ] (common Kimi quirk)
 *   - Single-line JSON embedded in text
 */
export function cleanJsonResponse(raw: string): string {
  // 1. Remove ```json ... ``` or ``` ... ``` wrappers
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fixTrailingCommas(fenceMatch[1].trim());
  }

  // 2. Try to extract the outermost { ... } or [ ... ] block
  //    Use a greedy match to get the largest possible JSON block
  const objMatch = raw.match(/\{[\s\S]*\}/);
  const arrMatch = raw.match(/\[[\s\S]*\]/);

  if (objMatch && arrMatch) {
    // Return whichever appears first in the string
    const result = raw.indexOf(objMatch[0]) <= raw.indexOf(arrMatch[0])
      ? objMatch[0]
      : arrMatch[0];
    return fixTrailingCommas(result.trim());
  }
  if (objMatch) return fixTrailingCommas(objMatch[0].trim());
  if (arrMatch) return fixTrailingCommas(arrMatch[0].trim());

  return fixTrailingCommas(raw.trim());
}

/**
 * Determine if a model does NOT support response_format: { type: "json_object" }.
 * Kimi (Moonshot) and Gemini (via third-party proxy) reject or ignore this parameter,
 * causing them to return plain text or error responses.
 *
 * NOTE: Gemini's official API supports json_object, but third-party proxies
 * (e.g. gdoubolai.com) may not relay it correctly, so we use prompt-based JSON
 * instruction for all Gemini models to be safe.
 */
export function isJsonFormatUnsupported(modelName: string, provider?: string): boolean {
  const lower = modelName.toLowerCase();
  const prov  = (provider || '').toLowerCase();
  return (
    prov === 'kimi' ||
    prov === 'gemini' ||
    lower.startsWith('moonshot') ||
    lower.includes('moonshot') ||
    lower.startsWith('gemini')
  );
}

/**
 * Determine if a model is a reasoning/thinking model that does NOT support
 * response_format: { type: "json_object" }.
 *
 * Reasoning models (gpt-5, o1, o3, o4 series) require JSON to be requested
 * via prompt instructions only — passing response_format causes them to ignore
 * the instruction or return empty content.
 */
export function isReasoningModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return (
    lower.startsWith('o1') ||
    lower.startsWith('o3') ||
    lower.startsWith('o4') ||
    lower === 'gpt-5' ||
    lower.startsWith('gpt-5-') ||
    lower.includes('-o1') ||
    lower.includes('-o3')
  );
}
