import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { tokenStore } from '$lib/services/api';
import { apiFetch } from '$lib/services/api';
import type {
  MfaChallenge,
  MfaConfirmation,
  MfaEnrollment,
  MfaRecoveryStatus,
  RegisterResponse,
  User,
  UserRole
} from '$lib/types/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
}

const initial: AuthState = {
  user: null,
  loading: false,
  ready: false,
  error: null
};

const USER_KEY = 'bookly.user';
const DEVICE_KEY_PREFIX = 'bookly.device.';

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: UserRole;
  exp?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function readCachedUser(): User | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  if (!browser) return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

// "Confiar en este dispositivo": el token vive solo en este navegador, por correo, para no
// pedir MFA de nuevo en los proximos 30 dias en el mismo equipo.
const deviceStore = {
  get(email: string): string | null {
    if (!browser) return null;
    return localStorage.getItem(DEVICE_KEY_PREFIX + email.trim().toLowerCase());
  },
  set(email: string, token: string): void {
    if (!browser) return;
    localStorage.setItem(DEVICE_KEY_PREFIX + email.trim().toLowerCase(), token);
  }
};

function createAuthStore() {
  const store = writable<AuthState>(initial);

  async function bootstrap() {
    if (!browser) {
      store.update((s) => ({ ...s, ready: true }));
      return;
    }
    const token = tokenStore.get();
    if (!token) {
      writeCachedUser(null);
      store.update((s) => ({ ...s, ready: true }));
      return;
    }

    const payload = decodeJwt(token);
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      tokenStore.clear();
      writeCachedUser(null);
      store.update((s) => ({ ...s, ready: true }));
      return;
    }

    store.update((s) => ({ ...s, loading: true }));
    try {
      // Prefer cached user (preserves fullName across refreshes); fall back to JWT-only.
      const cached = readCachedUser();
      if (cached && cached.id === payload?.sub) {
        store.set({ user: cached, loading: false, ready: true, error: null });
        return;
      }
      if (payload?.sub && payload.email && payload.role) {
        const fallback: User = {
          id: payload.sub,
          email: payload.email,
          fullName: payload.email.split('@')[0],
          role: payload.role
        };
        store.set({ user: fallback, loading: false, ready: true, error: null });
        return;
      }
      tokenStore.clear();
      writeCachedUser(null);
      store.set({ user: null, loading: false, ready: true, error: null });
    } catch {
      tokenStore.clear();
      writeCachedUser(null);
      store.set({ user: null, loading: false, ready: true, error: null });
    }
  }

  function startSession(session: { accessToken: string; user: User; deviceToken?: string | null }) {
    tokenStore.set(session.accessToken);
    writeCachedUser(session.user);
    if (session.deviceToken) deviceStore.set(session.user.email, session.deviceToken);
    store.set({ user: session.user, loading: false, ready: true, error: null });
    return session.user;
  }

  async function login(email: string, password: string): Promise<{ user: User } | { challenge: MfaChallenge }> {
    store.update((s) => ({ ...s, loading: true, error: null }));
    const trimmed = email.trim().toLowerCase();
    try {
      const data = await apiFetch<{ accessToken?: string; user?: User } & Partial<MfaChallenge>>('/auth/login', {
        method: 'POST',
        json: { email: trimmed, password, deviceToken: deviceStore.get(trimmed) }
      });
      if (data.mfaRequired) {
        store.update((s) => ({ ...s, loading: false }));
        return { challenge: data as MfaChallenge };
      }
      return { user: startSession(data as { accessToken: string; user: User }) };
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'No pudimos iniciar sesión.';
      store.update((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  }

  function mfaEnroll(mfaToken: string) {
    return apiFetch<MfaEnrollment>('/auth/mfa/enroll', { method: 'POST', json: { mfaToken } });
  }

  async function mfaConfirmEnrollment(mfaToken: string, code: string, trustDevice: boolean) {
    const data = await apiFetch<MfaConfirmation>('/auth/mfa/enroll/confirm', {
      method: 'POST',
      json: { mfaToken, code, trustDevice }
    });
    const user = startSession(data.session);
    return { user, recoveryCodes: data.recoveryCodes };
  }

  async function mfaVerify(mfaToken: string, code: string, trustDevice: boolean) {
    const data = await apiFetch<{ accessToken: string; user: User; deviceToken?: string | null }>(
      '/auth/mfa/verify',
      { method: 'POST', json: { mfaToken, code, trustDevice } }
    );
    return startSession(data);
  }

  // Omite la configuracion del segundo factor por esta vez; el backend no marca mfaEnabled, asi
  // que el siguiente login vuelve a ofrecer este mismo paso.
  async function mfaSkip(mfaToken: string) {
    const data = await apiFetch<{ accessToken: string; user: User }>('/auth/mfa/skip', {
      method: 'POST',
      json: { mfaToken }
    });
    return startSession(data);
  }

  function mfaRecoveryStatus() {
    return apiFetch<MfaRecoveryStatus>('/mfa/recovery-codes/estado');
  }

  function mfaRegenerateRecoveryCodes(code: string) {
    return apiFetch<{ recoveryCodes: string[] }>('/mfa/recovery-codes/regenerar', {
      method: 'POST',
      json: { code }
    });
  }

  function mfaDisable(password: string, code: string) {
    return apiFetch<void>('/mfa/desactivar', { method: 'POST', json: { password, code } });
  }

  function changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<void>('/auth/password', { method: 'PUT', json: { currentPassword, newPassword } });
  }

  async function register(email: string, password: string, fullName: string) {
    store.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        json: { email: email.trim().toLowerCase(), password, fullName: fullName.trim() }
      });
      store.update((s) => ({ ...s, loading: false }));
      return response;
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'No pudimos crear la cuenta.';
      store.update((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  }

  function logout() {
    tokenStore.clear();
    writeCachedUser(null);
    store.set({ ...initial, ready: true });
  }

  return {
    subscribe: store.subscribe,
    bootstrap,
    login,
    register,
    mfaEnroll,
    mfaConfirmEnrollment,
    mfaVerify,
    mfaSkip,
    mfaRecoveryStatus,
    mfaRegenerateRecoveryCodes,
    mfaDisable,
    changePassword,
    logout
  };
}

export const auth = createAuthStore();
