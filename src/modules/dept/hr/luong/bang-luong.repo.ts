import { db } from '@/server/db'
import type { DongTien, LoaiKhoan } from '@/lib/luong/tinh-luong'
import type { KhoiLuong } from '@/lib/luong/tong-duyet'

/** Bảng lương — bảng 0246. Chỉ `bang-luong.service` gọi (đã gác quyền). */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const LO = 300
const TRANG = 1000

export type TrangThaiLuong = 'draft' | 'submitted' | 'approved' | 'paid'

export type BangDong = {
  id: string
  thang: string
  trangThai: TrangThaiLuong
  lanTinh: number
  lanChotCong: number | null
  banCachTinhId: string | null
  tinhLuc: string | null
  tinhBoi: string | null
  guiLuc: string | null
  guiBoi: string | null
  guiBoiId: string | null
  duyetLuc: string | null
  duyetBoi: string | null
  chiLuc: string | null
  chiBoi: string | null
  lyDoTraLai: string | null
}

export type PhieuDong = {
  employeeId: string
  ma: string
  ten: string
  to: string | null
  cachTra: string
  cong: number
  luongCong: number
  tangCa: number
  nghiCoLuong: number
  phuCap: number
  khoanCong: number
  tong: number
  bhNld: number
  bhDn: number
  kpcd: number
  /** Đoàn phí NLĐ 0,5 % lương BH (0254). */
  doanPhi: number
  thue: number
  /** Thuế có trừ vào thực lĩnh không — Q5: chưa trừ, chỉ bày. */
  truThue: boolean
  khoanTru: number
  thucLinh: number
  nganHang: string | null
  stk: string | null
  dong: DongTien[]
  why: string[]
  van: string[]
}

export type KhoanDong = {
  id: string
  employeeId: string
  ma: string
  ten: string
  loai: LoaiKhoan
  tien: number
  ghiChu: string | null
  luc: string
}

export type SuKienLuong = {
  viec: string
  boi: string | null
  luc: string
  ghiChu: string | null
  data: Record<string, unknown>
}

const COT = `id, period, status, calc_count, time_close_no, calc_version_id, calculated_at, submitted_at,
  submitted_by, approved_at, paid_at, return_reason,
  tinh:users!hr_payrolls_calculated_by_fkey(name),
  gui:users!hr_payrolls_submitted_by_fkey(name),
  duyet:users!hr_payrolls_approved_by_fkey(name),
  chi:users!hr_payrolls_paid_by_fkey(name)`

type Row = {
  id: string
  period: string
  status: string
  calc_count: number
  time_close_no: number | null
  calc_version_id: string | null
  calculated_at: string | null
  submitted_at: string | null
  submitted_by: string | null
  approved_at: string | null
  paid_at: string | null
  return_reason: string | null
  tinh: { name: string } | null
  gui: { name: string } | null
  duyet: { name: string } | null
  chi: { name: string } | null
}

const doi = (r: Row): BangDong => ({
  id: r.id,
  thang: r.period,
  trangThai: r.status as TrangThaiLuong,
  lanTinh: r.calc_count,
  lanChotCong: r.time_close_no,
  banCachTinhId: r.calc_version_id,
  tinhLuc: r.calculated_at,
  tinhBoi: r.tinh?.name ?? null,
  guiLuc: r.submitted_at,
  guiBoi: r.gui?.name ?? null,
  guiBoiId: r.submitted_by,
  duyetLuc: r.approved_at,
  duyetBoi: r.duyet?.name ?? null,
  chiLuc: r.paid_at,
  chiBoi: r.chi?.name ?? null,
  lyDoTraLai: r.return_reason,
})

const so = (v: unknown) => Number(v ?? 0)

export const bangLuongRepo = {
  /** Tên tổ → khối bảng lương (0257) — màn duyệt của sếp gom khối → tổ. */
  async khoiCuaTo(): Promise<Map<string, KhoiLuong | null>> {
    const rows = must(await db().from('hr_teams').select('name, pay_block'))
    return new Map(rows.map((r) => [r.name, (r.pay_block as KhoiLuong | null) ?? null]))
  },

  /** Mọi bảng đang CHỜ DUYỆT (thường một) — Hộp ký của sếp + số đếm menu. */
  async choDuyet(): Promise<BangDong[]> {
    const rows = must(
      await db()
        .from('hr_payrolls')
        .select(COT)
        .eq('status', 'submitted')
        .order('period'),
    ) as unknown as Row[]
    return rows.map(doi)
  },

  async bang(thang: string): Promise<BangDong | null> {
    const r = must(
      await db().from('hr_payrolls').select(COT).eq('period', thang).maybeSingle(),
    ) as unknown as Row | null
    return r ? doi(r) : null
  },

  async damBao(thang: string): Promise<BangDong> {
    must(
      await db()
        .from('hr_payrolls')
        .upsert({ period: thang }, { onConflict: 'period', ignoreDuplicates: true }),
    )
    return (await this.bang(thang))!
  },

  /** Đổi có điều kiện trạng thái cũ — hai người bấm cùng lúc thì một người thắng. */
  async doi(
    id: string,
    tu: TrangThaiLuong,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    const rows = must(
      await db()
        .from('hr_payrolls')
        .update(patch as never)
        .eq('id', id)
        .eq('status', tu)
        .select('id'),
    )
    return rows.length === 1
  },

  async ghiPhieu(bangId: string, lan: number, ds: PhieuDong[]): Promise<void> {
    for (let i = 0; i < ds.length; i += LO)
      must(
        await db()
          .from('hr_payslips')
          .insert(
            ds.slice(i, i + LO).map((p) => ({
              payroll_id: bangId,
              calc_no: lan,
              employee_id: p.employeeId,
              code: p.ma,
              full_name: p.ten,
              team: p.to,
              pay_type: p.cachTra,
              work_units: p.cong,
              base_pay: p.luongCong,
              overtime_pay: p.tangCa,
              leave_pay: p.nghiCoLuong,
              allowance_pay: p.phuCap,
              item_plus: p.khoanCong,
              gross: p.tong,
              insurance_employee: p.bhNld,
              insurance_company: p.bhDn,
              union_fee: p.kpcd,
              union_fee_employee: p.doanPhi,
              tax: p.thue,
              tax_withheld: p.truThue,
              item_minus: p.khoanTru,
              net: p.thucLinh,
              bank_name: p.nganHang,
              bank_account: p.stk,
              lines: p.dong as never,
              why: p.why as never,
              problems: p.van as never,
            })),
          ),
      )
  },

  async phieu(bangId: string, lan: number): Promise<PhieuDong[]> {
    const out: PhieuDong[] = []
    for (let a = 0; ; a += TRANG) {
      const rows = must(
        await db()
          .from('hr_payslips')
          .select('*')
          .eq('payroll_id', bangId)
          .eq('calc_no', lan)
          .order('id')
          .range(a, a + TRANG - 1),
      )
      for (const r of rows)
        out.push({
          employeeId: r.employee_id,
          ma: r.code,
          ten: r.full_name,
          to: r.team,
          cachTra: r.pay_type,
          cong: so(r.work_units),
          luongCong: so(r.base_pay),
          tangCa: so(r.overtime_pay),
          nghiCoLuong: so(r.leave_pay),
          phuCap: so(r.allowance_pay),
          khoanCong: so(r.item_plus),
          tong: so(r.gross),
          bhNld: so(r.insurance_employee),
          bhDn: so(r.insurance_company),
          kpcd: so(r.union_fee),
          doanPhi: so(r.union_fee_employee),
          thue: so(r.tax),
          truThue: r.tax_withheld,
          khoanTru: so(r.item_minus),
          thucLinh: so(r.net),
          nganHang: r.bank_name,
          stk: r.bank_account,
          dong: (r.lines ?? []) as DongTien[],
          why: (r.why ?? []) as string[],
          van: (r.problems ?? []) as string[],
        })
      if (rows.length < TRANG) return out
    }
  },

  async khoan(thang: string): Promise<KhoanDong[]> {
    const rows = must(
      await db()
        .from('hr_payroll_items')
        .select(
          'id, employee_id, kind, amount, note, created_at, nv:hr_employees!hr_payroll_items_employee_id_fkey(code, full_name)',
        )
        .eq('period', thang)
        .order('created_at'),
    )
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      ma: r.nv?.code ?? '',
      ten: r.nv?.full_name ?? '',
      loai: r.kind as LoaiKhoan,
      tien: Number(r.amount),
      ghiChu: r.note,
      luc: r.created_at,
    }))
  },

  async themKhoan(
    thang: string,
    ds: { employeeId: string; loai: LoaiKhoan; tien: number; ghiChu: string | null }[],
    userId: string,
  ): Promise<void> {
    if (!ds.length) return
    must(
      await db()
        .from('hr_payroll_items')
        .insert(
          ds.map((k) => ({
            period: thang,
            employee_id: k.employeeId,
            kind: k.loai,
            amount: k.tien,
            note: k.ghiChu,
            created_by: userId,
          })),
        ),
    )
  },

  async xoaKhoan(thang: string, id: string): Promise<void> {
    must(await db().from('hr_payroll_items').delete().eq('id', id).eq('period', thang))
  },

  async suKien(bangId: string): Promise<SuKienLuong[]> {
    const rows = must(
      await db()
        .from('hr_payroll_events')
        .select(
          'kind, note, data, created_at, boi:users!hr_payroll_events_actor_id_fkey(name)',
        )
        .eq('payroll_id', bangId)
        .order('created_at', { ascending: false })
        .limit(100),
    )
    return rows.map((r) => ({
      viec: r.kind,
      boi: r.boi?.name ?? null,
      luc: r.created_at,
      ghiChu: r.note,
      data: (r.data ?? {}) as Record<string, unknown>,
    }))
  },

  async ghiSuKien(
    bangId: string,
    viec: string,
    /** null = hệ thống tự làm (tự tính khi chốt công). */
    userId: string | null,
    ghiChu?: string | null,
    data?: Record<string, unknown>,
  ) {
    must(
      await db()
        .from('hr_payroll_events')
        .insert({
          payroll_id: bangId,
          kind: viec,
          actor_id: userId,
          note: ghiChu ?? null,
          data: (data ?? {}) as never,
        }),
    )
  },
}
