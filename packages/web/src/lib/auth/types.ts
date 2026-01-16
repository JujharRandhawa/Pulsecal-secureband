export interface Session {
  token: string;
  expiresAt: Date;
  jailName: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  jailName: string;
}
