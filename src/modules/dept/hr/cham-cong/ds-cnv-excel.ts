import ExcelJS from 'exceljs'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { todayVn } from '@/lib/date-vn'
import { ngayVn, TEN_LY_DO_NGHI, type LyDoNghi } from '@/lib/nhan-su/bien-dong'
import { TEN_GIOI_TINH, type GioiTinh } from '@/lib/nhan-su/ca-nhan'
import { soSanhMa } from '@/lib/nhan-su/ho-so'
import { chamCongRepo, type EmployeeRow } from './cham-cong.repo'
import { caNhanRepo, type DongCaNhan } from './ca-nhan.repo'
import { boDuoiCa } from './cham-cong.service'

/**
 * XUẤT "DS CNV" ĐÚNG MẪU FILE NHÂN SỰ (B5, bản vẽ 02/11/2026 Q6) — để Nhân sự thôi tự gộp ~10
 * file. Bố cục chép file "DANH SÁCH CNV HOÀNG GIA": tên công ty + địa chỉ, tiêu đề năm, dòng tiêu
 * đề nền xanh sẫm, nhóm bộ phận đánh số "01. …" nền xanh nhạt kèm "Số người: N", dòng tổng nền
 * vàng; sheet thứ hai là người đã nghỉ việc.
 *
 * Cố ý KHÁC file gốc: không có Số tài khoản (thông tin lương, chỉ người quản lý lương — 0255,
 * Q7) và Email (ERP không giữ — Q5); cột "Chức vụ" không lặp hai lần. Không có quyền thông tin
 * riêng → bỏ cột cá nhân. Có CCCD trong file thì ghi một dòng nhật ký truy cập.
 */

type Nv = EmployeeRow
type Rieng = DongCaNhan & { tax_code: string | null }
type Cot = { ten: string; rong: number; chu?: boolean; gia: (e: Nv, r?: Rieng) => string }

const XANH_SAM = 'FF1F4E78'
const XANH_NHAT = 'FFDDEBF7'
const VANG = 'FFFFF2CC'
const d = (iso: string | null | undefined) => (iso ? ngayVn(iso) : '')
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const

const MSNV: Cot = { ten: 'MSNV', rong: 10, chu: true, gia: (e) => e.code }
const TEN: Cot = { ten: 'Họ và tên', rong: 30, gia: (e) => e.full_name }
const CV: Cot = { ten: 'Chức vụ', rong: 26, gia: (e) => e.job_title ?? '' }
const BP: Cot = { ten: 'Tổ / Bộ phận', rong: 26, gia: (e) => e.team ?? '' }
const GT: Cot = {
  ten: 'Giới tính',
  rong: 10,
  gia: (_, r) => (r?.gender ? TEN_GIOI_TINH[r.gender as GioiTinh] : ''),
}
const NS: Cot = {
  ten: 'Ngày tháng năm sinh',
  rong: 18,
  chu: true,
  gia: (_, r) => d(r?.birth_date),
}
const NO: Cot = {
  ten: 'Nơi ở hiện tại',
  rong: 44,
  gia: (_, r) => r?.current_address ?? '',
}
const NV: Cot = { ten: 'Ngày vào làm', rong: 14, chu: true, gia: (e) => d(e.hire_date) }
const NN: Cot = {
  ten: 'Ngày nghỉ việc',
  rong: 15,
  chu: true,
  gia: (e) => d(e.leave_date),
}
const LD: Cot = {
  ten: 'Lý do nghỉ',
  rong: 20,
  gia: (e) =>
    e.leave_reason ? (TEN_LY_DO_NGHI[e.leave_reason as LyDoNghi] ?? e.leave_reason) : '',
}
const CC: Cot = {
  ten: 'Số CCCD',
  rong: 17,
  chu: true,
  gia: (_, r) => r?.national_id ?? '',
}
const DT: Cot = {
  ten: 'Số điện thoại',
  rong: 15,
  chu: true,
  gia: (_, r) => r?.phone ?? '',
}
const GC: Cot = { ten: 'Ghi chú', rong: 40, gia: (e) => boDuoiCa(e.note) ?? '' }

export type DuLieuDsCnv = {
  congTy: { ten: string; diaChi: string }
  homNay: string
  nv: Nv[]
  /** null = người xuất không có quyền thông tin riêng. */
  rieng: Map<string, Rieng> | null
}

/** Đang làm theo bộ phận: bộ phận theo tên, "(Chưa có bộ phận)" cuối; trong nhóm theo mã. */
export function nhomDangLam(nv: Nv[]): { ten: string; ds: Nv[] }[] {
  const m = new Map<string, Nv[]>()
  for (const e of nv.filter((x) => x.active)) {
    const k = e.team?.trim() || ''
    m.set(k, [...(m.get(k) ?? []), e])
  }
  return [...m.entries()]
    .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, 'vi')))
    .map(([k, ds]) => ({
      ten: k || '(Chưa có bộ phận)',
      ds: ds.sort((a, b) => soSanhMa(a.code, b.code)),
    }))
}

/** Dựng sổ (thuần, có test): sheet "DS CNV <năm>" + "Đã nghỉ việc". */
export async function veDsCnv(x: DuLieuDsCnv): Promise<{ buf: Buffer; soCccd: number }> {
  const coRieng = !!x.rieng
  const r = (e: Nv) => x.rieng?.get(e.id)
  const nam = x.homNay.slice(0, 4)
  const wb = new ExcelJS.Workbook()
  let soCccd = 0

  function dauSheet(ws: ExcelJS.Worksheet, tieuDe: string, cot: Cot[], ghi: string) {
    const n = cot.length + 1
    ws.addRow([x.congTy.ten.toUpperCase()]).font = { bold: true }
    ws.addRow([x.congTy.diaChi ? `Đ/C: ${x.congTy.diaChi}` : '']).font = { bold: true }
    const t = ws.addRow([tieuDe])
    t.font = { bold: true, size: 14 }
    ws.mergeCells(t.number, 1, t.number, n)
    t.getCell(1).alignment = { horizontal: 'center' }
    const g = ws.addRow([ghi])
    g.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    ws.mergeCells(g.number, 1, g.number, n)
    const h = ws.addRow(['STT', ...cot.map((c) => c.ten)])
    h.eachCell((c) => {
      c.fill = nen(XANH_SAM)
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    })
    h.height = 30
    ws.views = [{ state: 'frozen', ySplit: h.number }]
    ws.getColumn(1).width = 7
    cot.forEach((c, i) => {
      const col = ws.getColumn(i + 2)
      col.width = c.rong
      if (c.chu) col.numFmt = '@'
    })
  }

  function dong(ws: ExcelJS.Worksheet, stt: number, e: Nv, cot: Cot[]) {
    const v = cot.map((c) => c.gia(e, r(e)))
    if (cot.includes(CC) && r(e)?.national_id) soCccd++
    ws.addRow([stt, ...v])
  }

  function dongDai(
    ws: ExcelJS.Worksheet,
    n: number,
    trai: string,
    phai: string,
    argb: string,
  ) {
    const row = ws.addRow([trai])
    ws.mergeCells(row.number, 1, row.number, n - 1)
    row.getCell(n).value = phai
    row.eachCell({ includeEmpty: true }, (c) => {
      c.fill = nen(argb)
      c.font = { bold: true }
    })
  }

  // ── Sheet 1: đang làm, nhóm theo bộ phận ──
  const cot1 = coRieng
    ? [MSNV, TEN, CV, GT, NS, NO, NV, CC, DT, GC]
    : [MSNV, TEN, CV, NV, GC]
  const ws1 = wb.addWorksheet(`DS CNV ${nam}`)
  const nhom = nhomDangLam(x.nv)
  const dangLam = nhom.reduce((s, g) => s + g.ds.length, 0)
  dauSheet(
    ws1,
    `DANH SÁCH CÔNG NHÂN VIÊN NĂM ${nam}`,
    cot1,
    `Xuất từ ERP ngày ${ngayVn(x.homNay)} · ${dangLam} người đang làm · ${
      coRieng
        ? 'có CCCD, địa chỉ — tài liệu nội bộ Phòng Nhân sự. Số tài khoản xem ở Hồ sơ lương.'
        : 'bản không có thông tin cá nhân (người xuất không có quyền xem).'
    }`,
  )
  let stt = 0
  nhom.forEach((g, i) => {
    dongDai(
      ws1,
      cot1.length + 1,
      `${String(i + 1).padStart(2, '0')}. ${g.ten.toUpperCase()}`,
      `Số người: ${g.ds.length}`,
      XANH_NHAT,
    )
    for (const e of g.ds) dong(ws1, ++stt, e, cot1)
  })
  dongDai(ws1, cot1.length + 1, 'TỔNG SỐ CÔNG NHÂN VIÊN', String(dangLam), VANG)

  // ── Sheet 2: đã nghỉ việc, ngày nghỉ mới nhất trước ──
  const cot2 = coRieng
    ? [MSNV, TEN, BP, CV, GT, { ...NS, ten: 'Ngày sinh' }, NO, NV, NN, LD, CC, DT, GC]
    : [MSNV, TEN, BP, CV, NV, NN, LD, GC]
  const ws2 = wb.addWorksheet('Đã nghỉ việc')
  const nghi = x.nv
    .filter((e) => !e.active)
    .sort(
      (a, b) =>
        (b.leave_date ?? '').localeCompare(a.leave_date ?? '') ||
        soSanhMa(a.code, b.code),
    )
  dauSheet(
    ws2,
    'DANH SÁCH CÔNG NHÂN VIÊN NGHỈ VIỆC',
    cot2,
    `Xuất từ ERP ngày ${ngayVn(x.homNay)} · ${nghi.length} người đã nghỉ`,
  )
  nghi.forEach((e, i) => dong(ws2, i + 1, e, cot2))
  dongDai(ws2, cot2.length + 1, 'TỔNG SỐ NGƯỜI NGHỈ VIỆC', String(nghi.length), VANG)

  return { buf: Buffer.from(await wb.xlsx.writeBuffer()), soCccd }
}

/** Tải dữ liệu + quyền rồi dựng sổ; có CCCD trong file thì ghi nhật ký truy cập. */
export async function buildDsCnv(user: User): Promise<Buffer> {
  await assertAction(user, 'hr.attendance.view')
  const rieng = await canAction(user, 'hr.employee.private')
  const [nv, ds, st] = await Promise.all([
    chamCongRepo.employees(),
    rieng ? caNhanRepo.tatCa() : Promise.resolve(null),
    settingsService.getAll(),
  ])
  const { buf, soCccd } = await veDsCnv({
    congTy: { ten: st.company_name, diaChi: st.company_address },
    homNay: todayVn(),
    nv,
    rieng: ds,
  })
  if (soCccd) await caNhanRepo.ghiXuat(user.id, `Xuất DS CNV: ${soCccd} người có CCCD`)
  return buf
}
