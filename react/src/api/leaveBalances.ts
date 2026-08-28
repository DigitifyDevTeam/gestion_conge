import { HolidayBalance, HolidayType } from '@/types/holiday';
import { apiFetch } from './client';

export interface ApiBalance {
  id: number;
  employee_id: number;
  employee_name: string;
  email: string;
  avatar?: string;
  type: HolidayType;
  total: number | string;
  used: number | string;
  pending: number | string;
  remaining: number | string;
}

export interface BalanceWithId extends HolidayBalance {
  id: number;
}

export interface EmployeeBalanceRow {
  userId: string;
  employeeName: string;
  email: string;
  avatar?: string;
  balances: BalanceWithId[];
}

export function mapBalance(b: ApiBalance): BalanceWithId {
  return {
    id: b.id,
    type: b.type,
    total: Number(b.total),
    used: Number(b.used),
    pending: Number(b.pending),
    remaining: Number(b.remaining),
  };
}

export async function listMyBalances(): Promise<HolidayBalance[]> {
  const data = await apiFetch<ApiBalance[]>('/leave-balances/');
  return data.map(mapBalance);
}

export async function listAllBalances(): Promise<EmployeeBalanceRow[]> {
  const data = await apiFetch<ApiBalance[]>('/leave-balances/');
  const byUser = new Map<string, EmployeeBalanceRow>();
  for (const row of data) {
    const key = String(row.employee_id);
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: key,
        employeeName: row.employee_name,
        email: row.email,
        avatar: row.avatar || undefined,
        balances: [],
      });
    }
    byUser.get(key)!.balances.push(mapBalance(row));
  }
  return Array.from(byUser.values());
}

export async function updateBalance(
  id: number,
  payload: Partial<{ total: number; used: number; pending: number }>,
): Promise<BalanceWithId> {
  const data = await apiFetch<ApiBalance>(`/leave-balances/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapBalance(data);
}

export async function setAnnualAllocationForAll(total: number): Promise<{
  updated: number;
  total: number;
}> {
  const data = await apiFetch<{ updated: number; total: number | string }>(
    '/leave-balances/set-annual-allocation/',
    {
      method: 'PATCH',
      body: JSON.stringify({ total }),
    },
  );
  return { updated: data.updated, total: Number(data.total) };
}

export async function listBalancesRaw(): Promise<ApiBalance[]> {
  return apiFetch<ApiBalance[]>('/leave-balances/');
}
