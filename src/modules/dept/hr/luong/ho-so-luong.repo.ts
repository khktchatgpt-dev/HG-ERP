import { db } from '@/server/db'
import type { CachTra } from '@/lib/luong/ho-so-luong'

/** Hồ sơ lương — bảng 0245. Chỉ service `ho-so-luong.service` gọi (đã gác quyền). */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const TRANG = 1000

export type BanLuong = {
  id: string
  employeeId: string
  tuKy: string
  cachTra: CachTra
  donGia: number | null
  luongThang: number | null
  luongBh: number | null
  coBh: boolean
  npt: number
  ghiChu: string | null
  nguon: string | null
  /** typeId → số tiền. */
  phuCap: Record<string, number>
  taoLuc: string
  nguoiTao: string | null
}

export type LoaiPhuCap = {
  id: string
  ten: string
  tinhBh: boolean
  chiuThue: boolean
  dangDung: boolean
}

export type Rieng = {
  employeeId: string
  cccd: string | null
  mst: string | null
  nganHang: string | null
  stk: string | null
  ngayVao: string | null
}

const n = (v: unknown) => (v == null ? null : Number(v))

export const hoSoLuongRepo = {
  async banTatCa(): Promise<BanLuong[]> {
    const out: BanLuong[] = []
    for (let a = 0; ; a += TRANG) {
      const rows = must(
        await db()
          .from('hr_pay_profiles')
          .select(
            `id, employee_id, from_period, pay_type, daily_rate, monthly_salary, insurance_salary,
             insured, dependents, note, source, created_at,
             tao:users!hr_pay_profiles_created_by_fkey(name),
             pc:hr_pay_profile_allowances(allowance_type_id, amount)`,
          )
          .order('from_period')
          .range(a, a + TRANG - 1),
      )
      for (const r of rows)
        out.push({
          id: r.id,
          employeeId: r.employee_id,
          tuKy: r.from_period,
          cachTra: r.pay_type as CachTra,
          donGia: n(r.daily_rate),
          luongThang: n(r.monthly_salary),
          luongBh: n(r.insurance_salary),
          coBh: r.insured,
          npt: r.dependents,
          ghiChu: r.note,
          nguon: r.source,
          phuCap: Object.fromEntries(
            (r.pc ?? []).map((p) => [p.allowance_type_id, Number(p.amount)]),
          ),
          taoLuc: r.created_at,
          nguoiTao: r.tao?.name ?? null,
        })
      if (rows.length < TRANG) return out
    }
  },

  async loaiPhuCap(): Promise<LoaiPhuCap[]> {
    const rows = must(
      await db()
        .from('hr_allowance_types')
        .select('id, name, insurable, taxable, active')
        .order('sort_order')
        .order('name'),
    )
    return rows.map((r) => ({
      id: r.id,
      ten: r.name,
      tinhBh: r.insurable,
      chiuThue: r.taxable,
      dangDung: r.active,
    }))
  },

  async luuLoaiPhuCap(v: {
    id?: string
    ten: string
    tinhBh: boolean
    chiuThue: boolean
    dangDung: boolean
  }) {
    const row = {
      name: v.ten,
      insurable: v.tinhBh,
      taxable: v.chiuThue,
      active: v.dangDung,
    }
    if (v.id) must(await db().from('hr_allowance_types').update(row).eq('id', v.id))
    else
      must(
        await db()
          .from('hr_allowance_types')
          .insert({ ...row, sort_order: 100 }),
      )
  },

  async riengTatCa(): Promise<Rieng[]> {
    const rows = must(
      await db()
        .from('hr_employee_private')
        .select('employee_id, national_id, tax_code, bank_name, bank_account, join_date'),
    )
    return rows.map((r) => ({
      employeeId: r.employee_id,
      cccd: r.national_id,
      mst: r.tax_code,
      nganHang: r.bank_name,
      stk: r.bank_account,
      ngayVao: r.join_date,
    }))
  },

  /** Ghi đè các ô có trong `v` (undefined = giữ nguyên). */
  async luuRieng(
    employeeId: string,
    v: Partial<Omit<Rieng, 'employeeId'>>,
    userId: string,
  ): Promise<void> {
    const row: Record<string, unknown> = { employee_id: employeeId, updated_by: userId }
    if (v.cccd !== undefined) row.national_id = v.cccd
    if (v.mst !== undefined) row.tax_code = v.mst
    if (v.nganHang !== undefined) row.bank_name = v.nganHang
    if (v.stk !== undefined) row.bank_account = v.stk
    if (v.ngayVao !== undefined) row.join_date = v.ngayVao
    must(
      await db()
        .from('hr_employee_private')
        .upsert(row as never, { onConflict: 'employee_id' }),
    )
  },

  async ghiXem(
    employeeId: string,
    truong: 'bank_account' | 'national_id' | 'tax_code',
    userId: string,
  ) {
    must(
      await db()
        .from('hr_private_access_log')
        .insert({ employee_id: employeeId, field: truong, viewer_id: userId }),
    )
  },

  async lanXem(
    employeeId: string,
  ): Promise<{ truong: string; boi: string | null; luc: string }[]> {
    const rows = must(
      await db()
        .from('hr_private_access_log')
        .select('field, viewed_at, boi:users!hr_private_access_log_viewer_id_fkey(name)')
        .eq('employee_id', employeeId)
        .order('viewed_at', { ascending: false })
        .limit(10),
    )
    return rows.map((r) => ({
      truong: r.field,
      boi: r.boi?.name ?? null,
      luc: r.viewed_at,
    }))
  },

  /** Thêm hoặc ghi đè bản (người × từ-kỳ), kèm phụ cấp. Trả id bản. */
  async luuBan(
    v: Omit<BanLuong, 'id' | 'taoLuc' | 'nguoiTao'>,
    userId: string,
  ): Promise<string> {
    const row = must(
      await db()
        .from('hr_pay_profiles')
        .upsert(
          {
            employee_id: v.employeeId,
            from_period: v.tuKy,
            pay_type: v.cachTra,
            daily_rate: v.cachTra === 'daily' ? v.donGia : null,
            monthly_salary: v.cachTra === 'monthly' ? v.luongThang : null,
            insurance_salary: v.luongBh,
            insured: v.coBh,
            dependents: v.npt,
            note: v.ghiChu,
            source: v.nguon,
            created_by: userId,
            updated_by: userId,
          },
          { onConflict: 'employee_id,from_period' },
        )
        .select('id')
        .single<{ id: string }>(),
    )
    if (!row) throw new Error('Không ghi được hồ sơ lương')
    must(await db().from('hr_pay_profile_allowances').delete().eq('profile_id', row.id))
    const pc = Object.entries(v.phuCap).filter(([, so]) => so > 0)
    if (pc.length)
      must(
        await db()
          .from('hr_pay_profile_allowances')
          .insert(
            pc.map(([t, so]) => ({
              profile_id: row.id,
              allowance_type_id: t,
              amount: so,
            })),
          ),
      )
    return row.id
  },

  /** Kỳ đã chốt gần nhất (B3) — bản có từ-kỳ ≤ kỳ này đã dùng để tính, chỉ xem. */
  async kyChotCuoi(): Promise<string | null> {
    const rows = must(
      await db()
        .from('hr_time_periods')
        .select('period')
        .neq('status', 'open')
        .order('period', { ascending: false })
        .limit(1),
    )
    return rows[0]?.period ?? null
  },
}
