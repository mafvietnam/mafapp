export interface WpUserInfo {
  id: number;
  name: string;
  email: string;
  avatar_urls?: Record<string, string>;
}

export interface TokenPayload {
  sub: string; // user UUID
  email: string;
}

export interface OAuthState {
  codeVerifier: string;
  state: string;
}
