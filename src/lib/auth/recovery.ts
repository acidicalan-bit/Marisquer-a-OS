export type RecoveryTokens = {
  accessToken: string;
  refreshToken: string;
};

export function parseRecoveryTokens(hash: string): RecoveryTokens | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));

  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function getCanonicalAppOrigin(requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configured ? new URL(configured) : new URL(requestUrl);

  if (origin.hostname === "0.0.0.0") origin.hostname = "127.0.0.1";

  return origin.origin;
}
