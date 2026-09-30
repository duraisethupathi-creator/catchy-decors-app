import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '../utils/sha256';

export type Role = 'admin' | 'staff';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  created_at?: string;
}

interface StoredUser extends AppUser {
  passwordHash: string;
}

const USERS_KEY = 'cd_users';
const SESSION_KEY = 'cd_session';

function hash(pw: string): string {
  return sha256('catchy-decors::' + pw);
}

function defaultUsers(): StoredUser[] {
  return [
    { id: 'u-admin', name: 'Admin', email: 'admin', role: 'admin', passwordHash: hash('admin123') },
    { id: 'u-staff', name: 'Staff', email: 'staff', role: 'staff', passwordHash: hash('staff123') },
  ];
}

export async function ensureSeedUsers(): Promise<void> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  if (!raw) {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers()));
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ user: AppUser; error?: string }> {
  await ensureSeedUsers();
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const users: StoredUser[] = raw ? JSON.parse(raw) : [];
  const found = users.find((u) => u.email.toLowerCase() === username.trim().toLowerCase());
  if (!found) return { user: null as unknown as AppUser, error: 'User not found' };
  if (found.passwordHash !== hash(password)) return { user: null as unknown as AppUser, error: 'Incorrect password' };
  const session: AppUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    phone: found.phone,
    role: found.role,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { user: session };
}

export async function getSession(): Promise<AppUser | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function changePassword(
  userId: string,
  currentPw: string,
  newPw: string
): Promise<{ ok: boolean; error?: string }> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const users: StoredUser[] = raw ? JSON.parse(raw) : [];
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return { ok: false, error: 'User not found' };
  if (users[idx].passwordHash !== hash(currentPw)) return { ok: false, error: 'Current password is incorrect' };
  if (newPw.length < 4) return { ok: false, error: 'New password must be at least 4 characters' };
  users[idx].passwordHash = hash(newPw);
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  return { ok: true };
}

/** Forgot password: admin can reset any password; verification via admin PIN. */
export async function resetPassword(
  username: string,
  adminPin: string,
  newPw: string
): Promise<{ ok: boolean; error?: string }> {
  if (adminPin !== '9159194440') return { ok: false, error: 'Invalid admin verification' };
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const users: StoredUser[] = raw ? JSON.parse(raw) : [];
  const idx = users.findIndex((u) => u.email.toLowerCase() === username.trim().toLowerCase());
  if (idx < 0) return { ok: false, error: 'User not found' };
  if (newPw.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
  users[idx].passwordHash = hash(newPw);
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  return { ok: true };
}
