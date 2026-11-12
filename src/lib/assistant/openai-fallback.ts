export type AssistantFallbackReason =
  | "not_configured"
  | "quota_or_rate_limit"
  | "authentication"
  | "timeout"
  | "local_budget_guard"
  | "provider_error"
  | "empty_response";

export function classifyAssistantFallback(
  error: unknown,
): AssistantFallbackReason {
  const record =
    error && typeof error === "object"
      ? (error as { status?: unknown; code?: unknown; name?: unknown })
      : {};
  const status = Number(record.status ?? 0);
  const code = typeof record.code === "string" ? record.code : "";
  const name =
    error instanceof Error
      ? error.name
      : typeof record.name === "string"
        ? record.name
        : "";

  if (status === 401 || status === 403 || code === "invalid_api_key")
    return "authentication";
  if (
    status === 402 ||
    status === 429 ||
    code === "insufficient_quota" ||
    code === "rate_limit_exceeded"
  )
    return "quota_or_rate_limit";
  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "APIConnectionTimeoutError"
  )
    return "timeout";
  return "provider_error";
}
