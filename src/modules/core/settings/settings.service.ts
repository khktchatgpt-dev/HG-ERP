import { db } from '@/server/db'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

export type Settings = {
  company_name: string
  company_tax_code: string
  company_address: string
  /**
   * ĐỊA DANH mở đầu dòng ngày tháng trên phiếu in: "Gia Lai, ngày 06 tháng 07…".
   *
   * Là ô riêng chứ không suy từ `company_address`: bản trước cắt đoạn cuối địa
   * chỉ ra làm địa danh, mà địa chỉ đang lưu bằng tiếng Anh nên phiếu in ra
   * "Vietnam, ngày…" rồi "Binh Dinh Province, ngày…". Địa danh trên văn bản là
   * thứ pháp lý, không phải thứ để đoán.
   */
  company_locality: string
  company_phone: string
  // Bên bán trên hợp đồng (Sales Contract).
  company_email: string
  company_fax: string
  company_bank_account: string
  company_swift: string
  company_representative: string
  company_representative_title: string
  company_fsc_cert: string
  // Điều khoản gỗ/FSC (Article 4) — gần như cố định theo DN.
  fsc_scientific_name: string
  fsc_country_origin: string
  fsc_area_origin: string
  fsc_forest_owner: string
  fsc_exporter: string
  fsc_importer: string
  fsc_seller: string
  fsc_coordinates: string
}

const DEFAULTS: Settings = {
  company_name: 'Công ty SXTM Hoàng Gia',
  company_tax_code: '',
  company_address: '',
  // Trụ sở ở Cụm công nghiệp Cát Nhơn, Xã Xuân An — địa danh trên mọi đơn đặt
  // hàng thật của phòng Cung ứng năm 2026 là "Gia Lai".
  company_locality: 'Gia Lai',
  company_phone: '',
  company_email: '',
  company_fax: '',
  company_bank_account: '',
  company_swift: '',
  company_representative: '',
  company_representative_title: '',
  company_fsc_cert: '',
  fsc_scientific_name: '',
  fsc_country_origin: '',
  fsc_area_origin: '',
  fsc_forest_owner: '',
  fsc_exporter: '',
  fsc_importer: '',
  fsc_seller: '',
  fsc_coordinates: '',
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
