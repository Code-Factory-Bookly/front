export type UserRole = 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface RegisterResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface ApiError {
  errorCode?: string;
  message: string;
  status: number;
  details?: Record<string, string>;
}
export interface MfaChallenge {
  mfaRequired: true;
  mfaSetupRequired: boolean;
  mfaToken: string;
}

export interface MfaEnrollment {
  secret: string;
  otpauthUri: string;
}

export interface MfaConfirmation {
  session: { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: User; deviceToken?: string | null };
  recoveryCodes: string[];
}

export interface MfaRecoveryStatus {
  remaining: number;
}
