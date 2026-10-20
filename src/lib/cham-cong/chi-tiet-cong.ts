/**
 * CHI TIẾT CÔNG TỪNG NGÀY — bày giờ đã tính của Bảng công theo cách tờ "Chi tiết" của
 * phần mềm chấm công cũ (bản vẽ duyệt 20/10/2026, Q1–Q7 theo đề xuất). Hàm thuần.
 *
 * KHÔNG tính lại giờ: nhận `NgayGio` do `tinhKyGioCong` (hoặc bản chốt kỳ) đưa ra — đúng
 * số Bảng công dùng — rồi chỉ CHIA ra cho người đọc:
 *   - Công = giờ khung hành chính (cộng làm trưa) ÷ giờ một công.
 *   - Tăng ca theo thứ tự khung sau khung hành chính: khung đầu = TC1 (16–19h), khung
 *     thứ hai = TC2 (19–22h), mọi khung còn lại = TC3 (22–24h, 0–5h, 5–7h). (Q2)
 *   - Trễ / sớm = phút theo GIỜ MÁY, chỉ để xem và đếm, không trừ thêm (Q1): trễ khi lượt
 *     vào sau giờ vào ca + ân hạn, đếm từ giờ vào ca; sớm khi lượt ra trước giờ tan ca.
 *     Bộ phận tính "có quẹt = 1 công" (văn phòng) không có trễ/sớm.
 *   - Loại ngày thường / chủ nhật / lễ để tách công CN và công lễ (Q4).
 */

import type { LoaiNgay } from './cach-tinh'
import { TEN_NGHI, type LoaiNghi } from './dieu-chinh'
import { gioCua, type ThamSoKhung } from './gio-khung'
import type { CachTinh, NgayGio } from './ky-gio-cong'

export type NhomTc = 'tc1' | 'tc2' | 'tc3'

/** Mã khung → nhóm: khung hành chính là 'hc', các khung sau xếp theo giờ bắt đầu. */
export function nhomKhung(t: ThamSoKhung): Record<string, 'hc' | NhomTc> {
  const sau = t.khung.filter((k) => k.ma !== t.khungHanhChinh).sort((a, b) => a.tu - b.tu)
  const out: Record<string, 'hc' | NhomTc> = { [t.khungHanhChinh]: 'hc' }
  sau.forEach((k, i) => (out[k.ma] = i === 0 ? 'tc1' : i === 1 ? 'tc2' : 'tc3'))
  return out
}

const gioTron = (phut: number) => {
  const g = (((phut / 60) % 24) + 24) % 24
  return Number.isInteger(g) ? `${g}h` : gioCua(phut % 1440)
}

/** Nhãn khoảng giờ của từng nhóm TC theo bản cách tính: { tc1: '16–19h', … }. */
export function nhanTc(t: ThamSoKhung): Record<NhomTc, string> {
  const nhom = nhomKhung(t)
  const out = { tc1: '', tc2: '', tc3: '' }
  for (const g of ['tc1', 'tc2', 'tc3'] as const) {
    const ks = t.khung.filter((k) => nhom[k.ma] === g).sort((a, b) => a.tu - b.tu)
    if (!ks.length) continue
    out[g] =
      g === 'tc3'
        ? `sau ${gioTron(ks[0].tu)}`
        : `${gioTron(ks[0].tu).replace('h', '')}–${gioTron(ks[ks.length - 1].den)}`
  }
  return out
}

export type CongNgay = {
  ngay: string
  loai: LoaiNgay
  /** Tên ngày lễ (bảng hr_holidays), null nếu không phải lễ. */
  tenLe: string | null
  /** Có lượt máy trong ngày (đã áp điều chỉnh đã duyệt). */
  coLuot: boolean
  /**
   * Từng ĐOẠN LÀM trong ngày — cột Vào 1 / Ra 1 / Vào 2 / Ra 2… như tờ "Chi tiết" phần
   * mềm cũ (user 20/10/2026: "phải hiển thị giờ vào và giờ ra, không gộp; làm nhiều ca
   * thì sao"). `vao`/`ra` là GIỜ MÁY ('HH:mm', qua 0h có '(+1)'); `vaoTinh`/`raTinh` là
   * giờ sau ân hạn + làm tròn — null khi không tính theo khung. Một lượt: chỉ có `vao`.
   */
  cap: { vao: string; ra: string | null; vaoTinh: string | null; raTinh: string | null }[]
  /** Lượt máy không thuộc đoạn nào (lượt giữa khi chỉ có 3 lượt) — không được tính. */
  luotLe: string[]
  /** Tính được giờ (đủ lượt, hoặc cách tính theo ngày). */
  tinhDuoc: boolean
  /** Phút: khung hành chính (gồm làm trưa đã quy đổi) và ba nhóm tăng ca. */
  hc: number
  tc1: number
  tc2: number
  tc3: number
  /** Phút đi trễ / về sớm theo giờ máy, 0 nếu không. */
  tre: number
  som: number
  /** Có lượt mà không tính được — cần bổ sung. */
  thieu: boolean
  doDang: boolean
  nghi: LoaiNghi | null
  choDuyet: number
}

export function loaiNgay(iso: string, le: Record<string, string>): LoaiNgay {
  if (le[iso]) return 'le'
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0 ? 'cn' : 'thuong'
}

/**
 * Một ngày. `x` = ngày của Bảng công (undefined = không quẹt, không điều chỉnh).
 * `le` = ngày lễ 'YYYY-MM-DD' → tên.
 */
export function chiTietNgay(
  iso: string,
  x: NgayGio | undefined,
  t: ThamSoKhung,
  cachTinh: CachTinh,
  le: Record<string, string>,
): CongNgay {
  const nhom = nhomKhung(t)
  const phut = { hc: 0, tc1: 0, tc2: 0, tc3: 0 }
  if (x?.k) for (const [ma, p] of Object.entries(x.k)) phut[nhom[ma] ?? 'tc3'] += p
  if (x?.k) phut.hc += x.truaCong
  const doan = cachTinh === 'khung' ? (x?.doan ?? null) : null
  const hc = t.khung.find((k) => k.ma === t.khungHanhChinh)
  let tre = 0
  let som = 0
  if (doan?.length && hc && x?.k) {
    const vao = doan[0].vao
    const ra = doan[doan.length - 1].ra
    if (vao > hc.tu + t.anHanPhut && vao < hc.den) tre = vao - hc.tu
    if (ra < hc.den && ra > hc.tu) som = hc.den - ra
  }
  const luot = x?.luot ?? []
  let cap: CongNgay['cap'] = []
  let luotLe: string[] = []
  if (doan?.length) {
    // Theo khung: đúng các đoạn Bảng công đã cắt (2–3 lượt = đầu → cuối; 4+ = từng cặp).
    cap = doan.map((d) => ({
      vao: gioCua(d.vao),
      ra: gioCua(d.ra),
      vaoTinh: gioCua(d.vaoTinh),
      raTinh: gioCua(d.raTinh),
    }))
    const dung = new Set(doan.flatMap((d) => [d.vao, d.ra]))
    luotLe = luot.filter((m) => !dung.has(m)).map(gioCua)
  } else {
    // Một lượt, hoặc bộ phận tính theo ngày: ghép lượt theo cặp liền nhau để bày.
    for (let i = 0; i < luot.length; i += 2)
      cap.push({
        vao: gioCua(luot[i]),
        ra: i + 1 < luot.length ? gioCua(luot[i + 1]) : null,
        vaoTinh: null,
        raTinh: null,
      })
  }
  return {
    ngay: iso,
    loai: loaiNgay(iso, le),
    tenLe: le[iso] ?? null,
    coLuot: luot.length > 0,
    cap,
    luotLe,
    tinhDuoc: !!x?.k,
    ...phut,
    tre,
    som,
    thieu: x?.thieu ?? false,
    doDang: x?.doDang ?? false,
    nghi: x?.nghi ?? null,
    choDuyet: x?.choDuyet ?? 0,
  }
}

export type TongCong = {
  /** Phút khung hành chính theo loại ngày. */
  hcThuong: number
  hcCn: number
  hcLe: number
  tc1: number
  tc2: number
  tc3: number
  lanTre: number
  phutTre: number
  lanSom: number
  phutSom: number
  thieu: number
  /** Ngày thường đã lấy dữ liệu, không quẹt, không nghỉ có lý do. */
  vang: number
  nghi: Partial<Record<LoaiNghi, number>>
  /** Mẫu số: ngày thường trong khoảng đã lấy dữ liệu; chủ nhật; ngày lễ. */
  ngayThuong: number
  chuNhat: number
  cnCoLam: number
  ngayLe: number
}

/** Cộng các ngày. `daLay(iso)` = công ty đã có dữ liệu ngày đó (chưa lấy thì không tính vắng). */
export function tongCong(ds: CongNgay[], daLay: (iso: string) => boolean): TongCong {
  const a: TongCong = {
    hcThuong: 0,
    hcCn: 0,
    hcLe: 0,
    tc1: 0,
    tc2: 0,
    tc3: 0,
    lanTre: 0,
    phutTre: 0,
    lanSom: 0,
    phutSom: 0,
    thieu: 0,
    vang: 0,
    nghi: {},
    ngayThuong: 0,
    chuNhat: 0,
    cnCoLam: 0,
    ngayLe: 0,
  }
  for (const d of ds) {
    const lay = daLay(d.ngay)
    if (d.loai === 'thuong' && lay) a.ngayThuong++
    if (d.loai === 'cn') a.chuNhat++
    if (d.loai === 'le') a.ngayLe++
    if (d.loai === 'thuong') a.hcThuong += d.hc
    else if (d.loai === 'cn') a.hcCn += d.hc
    else a.hcLe += d.hc
    if (d.loai === 'cn' && d.tinhDuoc) a.cnCoLam++
    a.tc1 += d.tc1
    a.tc2 += d.tc2
    a.tc3 += d.tc3
    if (d.tre) {
      a.lanTre++
      a.phutTre += d.tre
    }
    if (d.som) {
      a.lanSom++
      a.phutSom += d.som
    }
    if (d.thieu) a.thieu++
    if (d.nghi) a.nghi[d.nghi] = (a.nghi[d.nghi] ?? 0) + 1
    else if (d.loai === 'thuong' && lay && !d.coLuot && !d.doDang) a.vang++
  }
  return a
}

/** Số cặp Vào/Ra bày thành cột (như phần mềm cũ); đoạn thứ 4 trở đi ghi ở Ghi chú. */
export const SO_CAP = 3

export type GhiChu = { text: string; tone?: 'stop' | 'warn' | 'mute' }

/** Ngày lượt quẹt (đủ cho cột Ghi chú) — khớp `NgayMotNguoi` của trang một người. */
type NgayLuotGon = {
  ngay: string
  luot: { may: string }[]
  soLuotTho: number
  daLay: boolean
}

/** Chữ cột Ghi chú của một ngày — chung cho màn và file Excel. */
export function ghiChuNgay(n: NgayLuotGon, c: CongNgay | undefined): GhiChu[] {
  const out: GhiChu[] = []
  const nl = n.luot.length
  if (c?.tenLe) out.push({ text: `Lễ · ${c.tenLe}`, tone: 'warn' })
  if (c?.nghi) out.push({ text: TEN_NGHI[c.nghi], tone: 'warn' })
  if (!n.daLay) return [...out, { text: 'chưa lấy dữ liệu', tone: 'mute' }]
  if (c?.thieu) out.push({ text: '1 lượt — cần bổ sung', tone: 'stop' })
  else if (nl === 1 && c?.doDang) out.push({ text: 'đang trong ngày', tone: 'mute' })
  if (!nl && !c?.nghi && !c?.tenLe)
    out.push(
      new Date(`${n.ngay}T00:00:00Z`).getUTCDay() === 0
        ? { text: 'nghỉ chủ nhật', tone: 'mute' }
        : { text: 'không quẹt', tone: 'stop' },
    )
  for (const [i, p] of (c?.cap ?? []).entries())
    if (i >= SO_CAP) out.push({ text: `đoạn ${i + 1}: ${p.vao} → ${p.ra ?? '?'}`, tone: 'warn' })
  if (c?.luotLe.length)
    out.push({ text: `lượt giữa ${c.luotLe.join(', ')} không tính`, tone: 'mute' })
  if (n.soLuotTho > nl) out.push({ text: `bấm lặp ${n.soLuotTho - nl}`, tone: 'mute' })
  if (new Set(n.luot.map((l) => l.may)).size > 1)
    out.push({ text: '2 máy', tone: 'warn' })
  return out
}
