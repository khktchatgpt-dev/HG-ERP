/**
 * NẠP HỒ SƠ NHÂN VIÊN TỪ EXCEL (B4, bản vẽ lượt 2 duyệt 19/10/2026) — dán vùng Excel, xem
 * trước từng dòng (người khớp, ô đổi, ô giữ nguyên, ô lỗi), rồi mới ghi. Chỉ CẬP NHẬT người đã
 * có — không tạo người mới (tuyển vào đi đường Tuyển vào để có ngày vào + biến động).
 *
 * Ghi KHÔNG nhận kết quả xem trước từ client: server đọc lại vùng dán và so lại, client chỉ
 * gửi người đã chọn cho các dòng trùng tên. Cột cá nhân (CCCD, địa chỉ…) cần hr.employee.private;
 * không có quyền thì cột đó bị bỏ qua và màn nói rõ.
 */
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { boSo0 } from '@/lib/cham-cong/ghep-ten'
import { khopTen, type NguoiKhop } from '@/lib/luong/ho-so-luong'
import { cheCccd } from '@/lib/nhan-su/ca-nhan'
import {
  COT_RIENG,
  docDanNv,
  soKhac,
  TEN_COT_NAP,
  type CotNapNv,
  type DoiO,
} from '@/lib/nhan-su/nap-ho-so'
import { chamCongRepo, type EmployeeRow } from './cham-cong.repo'
import { caNhanRepo, type DongCaNhan } from './ca-nhan.repo'
import { bienDongRepo } from './bien-dong.repo'
import { bienDongService } from './bien-dong.service'

/** Cột riêng tư → cột DB của hr_employee_private. */
const COT_DB: Partial<Record<CotNapNv, keyof DongCaNhan | 'tax_code'>> = {
  ngaySinh: 'birth_date',
  gioiTinh: 'gender',
  quocTich: 'nationality',
  queQuan: 'hometown',
  trinhDo: 'education',
  cccd: 'national_id',
  ngayCap: 'id_issue_date',
  noiCap: 'id_issue_place',
  mst: 'tax_code',
  thuongTru: 'permanent_address',
  choO: 'current_address',
  dienThoai: 'phone',
  khanCapTen: 'emergency_name',
  khanCapQuanHe: 'emergency_relation',
  khanCapSdt: 'emergency_phone',
}
const CHE: CotNapNv[] = ['cccd', 'mst']

export type KhopNap =
  | { kieu: 'khop'; theo: 'ma' | 'ten'; nguoi: NguoiKhop }
  | { kieu: 'nhieu'; ungVien: NguoiKhop[] }
  | { kieu: 'khong' }

export type DongXemNapNv = {
  dong: number
  ma: string | null
  ten: string | null
  khop: KhopNap
  /** Tên trong file khác hồ sơ (khớp theo mã) — nên soát. */
  tenLech: boolean
  doi: DoiO[]
  giu: DoiO[]
  loi: string[]
}

export type XemNapNv = {
  cot: CotNapNv[]
  /** Cột cá nhân có trong file nhưng người dán không có quyền ghi → bỏ qua. */
  boQua: CotNapNv[]
  dong: DongXemNapNv[]
}

function hienTai(
  e: EmployeeRow,
  r: (DongCaNhan & { tax_code: string | null }) | undefined,
): Partial<Record<CotNapNv, string | null>> {
  const o: Partial<Record<CotNapNv, string | null>> = {
    to: e.team,
    chucDanh: e.job_title,
    ngayVao: e.hire_date,
  }
  for (const [cot, db] of Object.entries(COT_DB) as [CotNapNv, string][])
    o[cot] = (r as Record<string, string | null> | undefined)?.[db] ?? null
  return o
}

const che = (o: DoiO): DoiO =>
  CHE.includes(o.cot) ? { ...o, cu: cheCccd(o.cu), moi: cheCccd(o.moi)! } : o

async function nap(
  user: User,
  text: string,
  ghiDe: boolean,
  chon: Record<number, string> = {},
) {
  await assertAction(user, 'hr.attendance.employee_edit')
  if (text.length > 2_000_000) throw BadRequest('Vùng dán quá lớn — chia thành nhiều lần')
  const rieng = await canAction(user, 'hr.employee.private')
  const [emps, ds] = await Promise.all([chamCongRepo.employees(), caNhanRepo.tatCa()])
  const doc = docDanNv(text)
  if (!doc.dong.length)
    throw BadRequest(
      'Không thấy dòng tiêu đề có cột "Mã NV" hoặc "Họ tên" trong 15 dòng đầu',
    )
  const boQua = rieng ? [] : doc.cot.filter((c) => COT_RIENG.includes(c))
  const cot = doc.cot.filter((c) => !boQua.includes(c))
  const theoMa = new Map(emps.map((e) => [boSo0(e.code), e]))
  const byId = new Map(emps.map((e) => [e.id, e]))
  const dsTen: NguoiKhop[] = emps
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, ma: e.code, ten: e.full_name, to: e.team }))

  const dong = doc.dong.map((r) => {
    let khop: KhopNap = { kieu: 'khong' }
    const e0 = r.ma ? theoMa.get(boSo0(r.ma.trim())) : undefined
    if (e0)
      khop = {
        kieu: 'khop',
        theo: 'ma',
        nguoi: { id: e0.id, ma: e0.code, ten: e0.full_name, to: e0.team },
      }
    else if (!r.ma && r.ten) {
      const k = khopTen(r.ten, r.to ?? null, dsTen)
      khop = k.kieu === 'khop' ? { kieu: 'khop', theo: 'ten', nguoi: k.nguoi } : k
    }
    const id = chon[r.dong] ?? (khop.kieu === 'khop' ? khop.nguoi.id : undefined)
    const e = id ? byId.get(id) : undefined
    const so = e
      ? soKhac(r, hienTai(e, ds.get(e.id)), cot, ghiDe)
      : { doi: [], giu: [], loi: [] }
    return {
      raw: r,
      employee: e,
      xem: {
        dong: r.dong,
        ma: r.ma ?? null,
        ten: r.ten ?? null,
        khop,
        tenLech:
          khop.kieu === 'khop' &&
          khop.theo === 'ma' &&
          !!r.ten &&
          khongTrung(r.ten, khop.nguoi.ten),
        doi: so.doi,
        giu: so.giu,
        loi: so.loi,
      } satisfies DongXemNapNv,
    }
  })
  return { cot, boQua, dong }
}

const thuong = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const khongTrung = (a: string, b: string) => thuong(a) !== thuong(b)

export const napHoSoService = {
  async xem(
    user: User,
    text: string,
    ghiDe: boolean,
    chon: Record<number, string> = {},
  ): Promise<XemNapNv> {
    const r = await nap(user, text, ghiDe, chon)
    return {
      cot: r.cot,
      boQua: r.boQua,
      dong: r.dong.map((d) => ({
        ...d.xem,
        doi: d.xem.doi.map(che),
        giu: d.xem.giu.map(che),
      })),
    }
  },

  /** Ghi các dòng đã có người (khớp, hoặc người dùng chọn cho dòng trùng tên). */
  async ghi(
    user: User,
    text: string,
    ghiDe: boolean,
    chon: Record<number, string>,
  ): Promise<{ nguoi: number; o: number; loi: { dong: number; loi: string }[] }> {
    const r = await nap(user, text, ghiDe, chon)
    let nguoi = 0
    let o = 0
    const loi: { dong: number; loi: string }[] = []
    const daGhi = new Set<string>()
    for (const d of r.dong) {
      const e = d.employee
      if (!e || !d.xem.doi.length) continue
      if (daGhi.has(e.id)) {
        loi.push({ dong: d.raw.dong, loi: `${e.code} đã có ở dòng trên — bỏ dòng này` })
        continue
      }
      daGhi.add(e.id)
      const doi = d.xem.doi
      const ten: string[] = []
      try {
        const coBan: { team?: string | null; job_title?: string | null } = {}
        const rieng: Record<string, string | null> = {}
        for (const x of doi) {
          if (x.cot === 'to') coBan.team = x.moi
          else if (x.cot === 'chucDanh') coBan.job_title = x.moi
          else if (x.cot !== 'ngayVao' && COT_DB[x.cot]) rieng[COT_DB[x.cot]!] = x.moi
        }
        if (Object.keys(coBan).length) await chamCongRepo.updateEmployee(e.id, coBan)
        if (Object.keys(rieng).length) await caNhanRepo.luu(e.id, rieng, user.id)
        const nv = doi.find((x) => x.cot === 'ngayVao')
        // Ngày vào đi đúng đường biến động (kiểm kỳ đã chốt, dời / tạo mốc Tuyển vào).
        if (nv) await bienDongService.datNgayVao(user, e.id, nv.moi)
        ten.push(...doi.map((x) => TEN_COT_NAP[x.cot]))
        await bienDongRepo.ghi({
          employeeId: e.id,
          loai: 'edit',
          ngay: todayVn(),
          ghiChu: `Nhập Excel: ${ten.join(', ')}`,
          userId: user.id,
        })
        nguoi++
        o += doi.length
      } catch (err) {
        loi.push({
          dong: d.raw.dong,
          loi: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return { nguoi, o, loi }
  },
}
