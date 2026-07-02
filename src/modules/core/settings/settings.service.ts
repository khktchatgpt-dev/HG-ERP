import { db } from '@/server/db'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

export type Settings = {
  company_name: string
  company_tax_code: string
  company_address: string
  company_phone: string
}

const DEFAULTS: Settings = {
  company_name: 'Công ty SXTM Hoàng Gia',
  company_tax_code: '',
  company_address: '',
  company_phone: '',
}

export const settingsService = {
  async getAll(): Promise<Settings> {
    const { data } = await db().from('settings').select('key, value')
    const out = { ...DEFAULTS }
    for (const row of (data ?? []) as { key: keyof Settings; value: unknown }[]) {
      ;(out as Record<string, unknown>)[row.key] = row.value
    }
    return out
  },

  async update(user: User, patch: Partial<Settings>) {
    if (user.role !== 'admin') throw Forbidden('Chỉ quản trị viên')
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return this.getAll()
    const rows = entries.map(([key, value]) => ({ key, value }))
    const { error } = await db().from('settings').upsert(rows)
    if (error) throw new Error(error.message)
    return this.getAll()
  },
}
