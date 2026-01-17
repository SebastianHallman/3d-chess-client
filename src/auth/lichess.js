const STORAGE_TOKEN = "lichess_access_token";
const STORAGE_VERIFIER = "lichess_pkce_verifier";
const STORAGE_STATE = "lichess_oauth_state";

const DEFAULT_CONFIG = {
  clientId: "",
  redirectUri: "",
  oauthUrl: "https://lichess.org/oauth",
  tokenUrl: "https://lichess.org/api/token",
  scope: "challenge:write board:play"
};

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer).slice(0, length);
}

function saveVerifier(verifier) {
  sessionStorage.setItem(STORAGE_VERIFIER, verifier);
}

function getVerifier() {
  return sessionStorage.getItem(STORAGE_VERIFIER);
}

function clearVerifier() {
  sessionStorage.removeItem(STORAGE_VERIFIER);
}

function saveState(state) {
  sessionStorage.setItem(STORAGE_STATE, state);
}

function getState() {
  return sessionStorage.getItem(STORAGE_STATE);
}

function clearState() {
  sessionStorage.removeItem(STORAGE_STATE);
}

function saveToken(token) {
  sessionStorage.setItem(STORAGE_TOKEN, token);
}

export function getToken() {
  return sessionStorage.getItem(STORAGE_TOKEN);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function logout() {
  sessionStorage.removeItem(STORAGE_TOKEN);
  clearVerifier();
  clearState();
}

function clearAuthTemp() {
  clearVerifier();
  clearState();
}

function resolveConfig(config) {
  return { ...DEFAULT_CONFIG, ...config };
}

export async function createLoginUrl(config = DEFAULT_CONFIG) {
  const resolved = resolveConfig(config);
  if (!resolved.clientId || !resolved.redirectUri) {
    throw new Error("Missing Lichess OAuth config");
  }
  const verifier = randomString(96);
  const challenge = await sha256(verifier);
  const state = randomString(32);
  saveVerifier(verifier);
  saveState(state);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: resolved.clientId,
    redirect_uri: resolved.redirectUri,
    scope: resolved.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });
  return `${resolved.oauthUrl}?${params.toString()}`;
}

export async function handleRedirectCallback(config = DEFAULT_CONFIG) {
  const resolved = resolveConfig(config);
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const returnedState = url.searchParams.get("state");
  const storedState = getState();

  if (error) {
    clearAuthTemp();
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
    return { status: "error", error, errorDescription };
  }

  if (!code) {
    return { status: "no_code" };
  }

  if (!returnedState || !storedState || returnedState !== storedState) {
    clearAuthTemp();
    return { status: "invalid_state" };
  }

  const verifier = getVerifier();
  if (!verifier) {
    clearAuthTemp();
    return { status: "missing_verifier" };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: resolved.redirectUri,
    client_id: resolved.clientId
  });

  const response = await fetch(resolved.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    return { status: "error", error: await response.text() };
  }

  const data = await response.json();
  if (data.access_token) {
    saveToken(data.access_token);
    clearVerifier();
    clearState();
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
    return { status: "ok" };
  }

  return { status: "invalid_response" };
}
