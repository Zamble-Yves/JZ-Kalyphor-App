import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || "";
const TOKEN_KEY = "jzk_token";
const USER_KEY = "jzk_user";

export type Role = "student" | "admin";
export type User = {
  id: string; email: string; name: string; role: Role;
  phone?: string; certificate?: string; cohort?: string;
  start_date?: string; deadline?: string;
  progress: number; status: "in_progress" | "late" | "completed";
  first_login: boolean; welcome_seen: boolean;
  note?: string;
};

export type MessageAttachment = {
  id: string;
  filename: string;
  content_type: string;
  storage_path: string;
  size_bytes?: number;
};

let _token: string | null = null;
let _user: User | null = null;

export async function loadSession() {
  _token = await AsyncStorage.getItem(TOKEN_KEY);
  const u = await AsyncStorage.getItem(USER_KEY);
  _user = u ? JSON.parse(u) : null;
  return { token: _token, user: _user };
}

export async function setSession(token: string, user: User) {
  _token = token; _user = user;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  _token = null; _user = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export function getToken() { return _token; }
export function getUser() { return _user; }
export function setCachedUser(u: User) {
  _user = u;
  AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (_token) headers.Authorization = `Bearer ${_token}`;
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { const j = await res.json(); msg = j.detail || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

export async function uploadProof(uri: string, filename: string, mime: string, comment: string) {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, filename);
  } else {
    form.append("file", { uri, name: filename, type: mime } as any);
  }
  form.append("comment", comment);
  const res = await fetch(`${BACKEND_URL}/api/proofs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${_token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload échoué (${res.status})`);
  return res.json();
}

export async function uploadMessageAttachment(uri: string, filename: string, mime: string) {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, filename);
  } else {
    form.append("file", { uri, name: filename, type: mime } as any);
  }
  const res = await fetch(`${BACKEND_URL}/api/messages/upload-attachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${_token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Téléversement impossible (${res.status})${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<MessageAttachment>;
}

export async function openMessageAttachment(attachmentId: string) {
  const data = await api<{ url: string; filename: string; content_type: string }>(`/messages/attachment-url/${attachmentId}`);
  const url = data.url.startsWith("http") ? data.url : `${BACKEND_URL}${data.url}`;
  return { ...data, url };
}

export function fileUrl(path: string, token?: string) {
  return `${BACKEND_URL}/api/files/${path}${token ? `?token=${token}` : ""}`;
}

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: User }>('/auth/login', {
    method: "POST", body: JSON.stringify({ email, password }),
  });
  await setSession(data.token, data.user);
  return data;
}
