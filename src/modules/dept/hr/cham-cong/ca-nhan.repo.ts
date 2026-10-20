import { db } from '@/server/db'
import type { CoRieng } from '@/lib/nhan-su/ca-nhan'

/** Cột cá nhân của hr_employee_private (0249) — tên cột DB → tên ô dùng trong service. */
export const COT_CA_NHAN = {
  birth_date: 'Ngày sinh',
  gender: 'Giới tính',
  nationality: 'Quốc tịch',
  hometown: 'Quê quán',
  education: 'Trình độ',
  national_id: 'Số CCCD',
  id_issue_date: 'Ngày cấp',
  id_issue_place: 'Nơi cấp',
  permanent_address: 'Thường trú',
  current_address: 'Chỗ ở hiện tại',
  phone: 'Điện thoại',
  emergency_name: 'Người liên hệ khẩn cấp',
  emergency_relation: 'Quan hệ',
  emergency_phone: 'SĐT khẩn cấp',
} as const
export type CotCaNhan = keyof typeof COT_CA_NHAN
export type DongCaNhan = { [K in CotCaNhan]: string | null }

const CHON = Object.keys(COT_CA_NHAN).join(', ')

/** Thông tin cá nhân trong bảng riêng tư (0245 / 0249). Chỉ service có quyền gọi tới. */
export const caNhanRepo = {
  async cua(employeeId: string): Promise<DongCaNhan | null> {
    const { data, error } = await db()
      .from('hr_employee_private')
      .select(CHON)
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as unknown as DongCaNhan | null) ?? null
  },

  /** Cờ có / chưa có cho mọi người — không trả giá trị nào ra khỏi hàm. */
  async coTatCa(): Promise<Map<string, CoRieng>> {
    const { data, error } = await db()
      .from('hr_employee_private')
      .select(`employee_id, ${CHON}`)
    if (error) throw new Error(error.message)
    const out = new Map<string, CoRieng>()
    for (const raw of (data ?? []) as unknown as (DongCaNhan & {
      employee_id: string
    })[]) {
      out.set(raw.employee_id, {
        ngaySinh: !!raw.birth_date && !!raw.gender,
        cccd: !!raw.national_id && !!raw.id_issue_date && !!raw.id_issue_place,
        diaChi: !!raw.permanent_address,
        dienThoai: !!raw.phone,
        trinhDo: !!raw.education,
        khanCap: !!raw.emergency_name && !!raw.emergency_phone,
      })
    }
    return out
  },

  /** Mọi dòng riêng tư (giá trị đầy đủ + MST) — chỉ cho nạp Excel so khác, không trả ra màn. */
  async tatCa(): Promise<Map<string, DongCaNhan & { tax_code: string | null }>> {
    const { data, error } = await db()
      .from('hr_employee_private')
      .select(`employee_id, tax_code, ${CHON}`)
    if (error) throw new Error(error.message)
    const out = new Map<string, DongCaNhan & { tax_code: string | null }>()
    for (const r of (data ?? []) as unknown as (DongCaNhan & {
      employee_id: string
      tax_code: string | null
    })[])
      out.set(r.employee_id, r)
    return out
  },

  async luu(
    employeeId: string,
    patch: Partial<DongCaNhan & { tax_code: string | null }>,
    userId: string,
  ): Promise<void> {
    const { error } = await db()
      .from('hr_employee_private')
      .upsert(
        {
          employee_id: employeeId,
          ...patch,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id' },
      )
    if (error) throw new Error(error.message)
  },
}
