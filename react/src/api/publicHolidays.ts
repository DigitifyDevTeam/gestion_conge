import { PublicHoliday } from '@/types/holiday';
import { apiFetch, parseDate, toDateString } from './client';

interface ApiPublicHoliday {
  id: number;
  date: string;
  name: string;
  is_religious?: boolean;
}

export type PublicHolidayWithId = PublicHoliday & { id: string };

export function mapPublicHoliday(h: ApiPublicHoliday): PublicHolidayWithId {
  return {
    id: String(h.id),
    date: parseDate(h.date)!,
    name: h.name,
    isReligious: h.is_religious,
  };
}

export async function listPublicHolidays(): Promise<PublicHolidayWithId[]> {
  const data = await apiFetch<ApiPublicHoliday[]>('/public-holidays/');
  return data.map(mapPublicHoliday);
}

export async function createPublicHoliday(payload: {
  date: Date;
  name: string;
  isReligious?: boolean;
}): Promise<PublicHolidayWithId> {
  const data = await apiFetch<ApiPublicHoliday>('/public-holidays/', {
    method: 'POST',
    body: JSON.stringify({
      date: toDateString(payload.date),
      name: payload.name,
      is_religious: payload.isReligious || false,
    }),
  });
  return mapPublicHoliday(data);
}

export async function updatePublicHoliday(
  id: string,
  payload: Partial<{ date: Date; name: string; isReligious: boolean }>,
): Promise<PublicHolidayWithId> {
  const body: Record<string, unknown> = {};
  if (payload.date) body.date = toDateString(payload.date);
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.isReligious !== undefined) body.is_religious = payload.isReligious;
  const data = await apiFetch<ApiPublicHoliday>(`/public-holidays/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapPublicHoliday(data);
}

export async function deletePublicHoliday(id: string): Promise<void> {
  await apiFetch<void>(`/public-holidays/${id}/`, { method: 'DELETE' });
}
