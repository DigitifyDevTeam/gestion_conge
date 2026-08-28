import { User } from '@/types/auth';
import { apiFetch } from './client';
import { mapUser } from './auth';

interface ApiUser {
  id: number | string;
  email: string;
  name: string;
  role: 'employee' | 'admin';
  department?: string;
  position?: string;
  avatar?: string;
}

export async function listUsers(): Promise<User[]> {
  const data = await apiFetch<ApiUser[]>('/users/');
  return data.map(mapUser);
}

export async function createUser(payload: {
  email: string;
  name: string;
  role: 'employee' | 'admin';
  department?: string;
  position?: string;
  avatar?: string;
  password?: string;
}): Promise<User> {
  const data = await apiFetch<ApiUser>('/users/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapUser(data);
}

export async function updateUser(
  id: string,
  payload: Partial<{
    email: string;
    name: string;
    role: 'employee' | 'admin';
    department: string;
    position: string;
    avatar: string;
    password: string;
  }>,
): Promise<User> {
  const data = await apiFetch<ApiUser>(`/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch<void>(`/users/${id}/`, { method: 'DELETE' });
}
