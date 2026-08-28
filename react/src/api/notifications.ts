import { apiFetch } from './client';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'success' | 'info' | 'reminder';
}

interface ApiNotification {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'info' | 'reminder';
  read: boolean;
  timestamp: string;
  created_at: string;
}

function mapNotification(n: ApiNotification): AppNotification {
  return {
    id: String(n.id),
    title: n.title,
    message: n.message,
    timestamp: new Date(n.timestamp || n.created_at),
    read: n.read,
    type: n.type,
  };
}

export async function listNotifications(): Promise<AppNotification[]> {
  const data = await apiFetch<ApiNotification[]>('/notifications/');
  return data.map(mapNotification);
}

export async function markNotificationRead(id: string, read = true): Promise<AppNotification> {
  const data = await apiFetch<ApiNotification>(`/notifications/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ read }),
  });
  return mapNotification(data);
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch<void>(`/notifications/${id}/`, { method: 'DELETE' });
}
