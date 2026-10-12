import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { User } from '$lib/types/auth';

export interface SavedAccount {
  token: string;
  user: User;
}

const ACCOUNTS_KEY = 'bookly.testAccounts';
const MODE_KEY = 'bookly.testMode';

function read(): SavedAccount[] {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as SavedAccount[];
  } catch {
    return [];
  }
}

function persist(list: SavedAccount[]): void {
  if (!browser) return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export const testAccounts = writable<SavedAccount[]>(read());

/**
 * El selector de cuentas de prueba solo existe para probar varios roles a la vez sin
 * cerrar sesión. Es para el equipo, no para usuarios reales: por eso queda apagado hasta
 * que alguien entra una vez con ?test=1 en la URL.
 */
export function isTestModeEnabled(): boolean {
  if (!browser) return false;
  return localStorage.getItem(MODE_KEY) === '1';
}

export function enableTestMode(): void {
  if (!browser) return;
  localStorage.setItem(MODE_KEY, '1');
}

export function disableTestMode(): void {
  if (!browser) return;
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(ACCOUNTS_KEY);
  testAccounts.set([]);
}

export function saveTestAccount(token: string, user: User): void {
  if (!isTestModeEnabled()) return;
  const list = [...read().filter((a) => a.user.id !== user.id), { token, user }];
  persist(list);
  testAccounts.set(list);
}

export function removeTestAccount(userId: string): void {
  const list = read().filter((a) => a.user.id !== userId);
  persist(list);
  testAccounts.set(list);
}
