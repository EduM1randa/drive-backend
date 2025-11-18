/**
 * Tipos comunes para respuestas HTTP de la API.
 * Úsalos en controllers y services para mantener consistencia en la forma
 * de respuesta.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errorCode?: string;
  errors?: string[] | Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* Auth / Session specific responses */
export interface AuthLoginResponse {
  tfaRequired: boolean;
  token: string | null; // customToken when tfaRequired === false
  authenticated: boolean;
}

export interface LoginTfaResponse {
  customToken: string | null;
  authenticated: boolean;
}

export interface VerifyTokenResponse {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  name: string | null;
  userName: string | null;
  tfaEnabled: boolean;
}

export interface PasswordRequestResponse {
  success: true;
  message: string;
}

export interface PasswordResetResponse {
  success: true;
  message: string;
}

export interface TfaGenerateResponse {
  uri: string; // provisioning URI for QR
  // secret may be returned for debugging/dev only — avoid returning in prod
  secret?: string;
}

export interface TfaConfirmResponse {
  success: boolean;
  message: string;
}

export type Nullable<T> = T | null;
