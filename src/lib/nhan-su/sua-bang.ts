/**
 * SỬA TRÊN BẢNG (B2, bản vẽ 02/11/2026 mục B) — logic THUẦN: xét một ô vừa gõ, dán vùng
 * chép từ Excel, gom các ô đã đổi thành gói gửi lên. Kiểm ô dùng CHUNG `chuanO` / `LOI_O` của
 * đường nạp Excel — server đọc lại bằng đúng hàm đó, nên ô nào bảng báo đúng thì server nhận.
 */
import { ngayVn } from './bien-dong'
import { hienSdt, TEN_GIOI_TINH } from './ca-nhan'
import type { NvDsTom } from './danh-sach'
import { chuanO, LOI_O, TEN_COT_NAP, type CotNapNv } from './nap-ho-so'

/** Ô sửa được trên bảng. Bộ phận KHÔNG (chuyển tổ là biến động có ngày); ghi chú chưa. */
export const COT_SUA = [
  'chucDanh',
  'ngayVao',
  'gioiTinh',
  'ngaySinh',
  'cccd',
  'ngayCap',
  'noiCap',
  'mst',
  'trinhDo',
  'thuongTru',
  'choO',
  'dienThoai',
  'khanCapTen',
  'khanCapQuanHe',
  'khanCapSdt',
  'maBhxh',
] as const satisfies readonly CotNapNv[]
export type CotSua = (typeof COT_SUA)[number]

/** Hai ô chỉ đi 4 số cuối xuống trình duyệt: ô sửa bắt đầu trống, gõ số mới là thay. */
export const COT_CHE: readonly CotSua[] = ['cccd', 'mst']
/** Ô công việc — chỉ cần quyền sửa hồ sơ; các ô còn lại cần quyền thông tin riêng. */
export const COT_CONG_VIEC: readonly CotSua[] = ['chucDanh', 'ngayVao']

/** Chữ đang gõ: mã người (id) → ô → chữ. Chỉ giữ ô người dùng đã chạm. */
export type SuaBang = Record<string, Partial<Record<CotSua, string>>>

const ngay = (d: string | null) => (d ? ngayVn(d) : '')

/** Giá trị đang có của một ô, viết như người gõ (ngày dd/mm/yyyy, SĐT có cách, Nam/Nữ). */
export function gocO(n: NvDsTom, cot: CotSua): string {
  const r = n.rieng
  switch (cot) {
    case 'chucDanh':
      return n.chucDanh ?? ''
    case 'ngayVao':
      return ngay(n.ngayVao)
    case 'cccd':
    case 'mst':
      return ''
  }
  if (!r) return ''
  switch (cot) {
    case 'gioiTinh':
      return r.gioiTinh ? TEN_GIOI_TINH[r.gioiTinh] : ''
    case 'ngaySinh':
      return ngay(r.ngaySinh)
    case 'ngayCap':
      return ngay(r.ngayCap)
    case 'dienThoai':
      return hienSdt(r.dienThoai)
    case 'khanCapSdt':
      return hienSdt(r.khanCapSdt)
    case 'noiCap':
      return r.noiCap ?? ''
    case 'trinhDo':
      return r.trinhDo ?? ''
    case 'thuongTru':
      return r.thuongTru ?? ''
    case 'choO':
      return r.choO ?? ''
    case 'khanCapTen':
      return r.khanCapTen ?? ''
    case 'khanCapQuanHe':
      return r.khanCapQuanHe ?? ''
    case 'maBhxh':
      return r.maBhxh ?? ''
  }
}

export type XetO =
  { kieu: 'giu' } | { kieu: 'doi'; moi: string } | { kieu: 'loi'; loi: string }

/**
 * Một ô sau khi gõ: giữ nguyên / đổi (giá trị đã chuẩn hoá để gửi) / sai (câu nói sai gì).
 * Bảng không XOÁ ô: đường nạp coi ô trống là "không đổi", xoá phải làm ở hồ sơ một người.
 */
export function xetO(cot: CotSua, goc: string, go: string): XetO {
  const t = go.trim()
  if (!t)
    return goc.trim()
      ? { kieu: 'loi', loi: 'Bảng không xoá ô — muốn xoá thì sửa ở hồ sơ người đó' }
      : { kieu: 'giu' }
  const v = chuanO(cot, t)
  if (v === undefined)
    return {
      kieu: 'loi',
      loi: `${TEN_COT_NAP[cot]} cần ${LOI_O[cot] ?? 'đúng định dạng'}`,
    }
  if (goc.trim() && chuanO(cot, goc.trim()) === v) return { kieu: 'giu' }
  return { kieu: 'doi', moi: v }
}

export type LoiO = { id: string; cot: CotSua; loi: string }
export type GoiSua = { ma: string; o: Partial<Record<CotSua, string>> }

/**
 * Gom mọi ô đã chạm: đếm ô đổi / người, liệt kê ô sai (theo thứ tự `thuTu` — dòng trên trước,
 * ô trái trước), và gói gửi lên (chỉ ô đổi, theo MÃ người).
 */
export function tongHop(
  sua: SuaBang,
  nguoi: Map<string, NvDsTom>,
  thuTu: { ids: string[]; cots: readonly CotSua[] },
): { o: number; nguoi: number; loi: LoiO[]; goi: GoiSua[] } {
  let o = 0
  const loi: LoiO[] = []
  const goi: GoiSua[] = []
  for (const [id, cs] of Object.entries(sua)) {
    const n = nguoi.get(id)
    if (!n) continue
    const doi: Partial<Record<CotSua, string>> = {}
    for (const [cot, go] of Object.entries(cs) as [CotSua, string][]) {
      const x = xetO(cot, gocO(n, cot), go)
      if (x.kieu === 'loi') loi.push({ id, cot, loi: x.loi })
      else if (x.kieu === 'doi') doi[cot] = x.moi
    }
    const k = Object.keys(doi).length
    if (k) {
      o += k
      goi.push({ ma: n.code, o: doi })
    }
  }
  const hang = new Map(thuTu.ids.map((id, i) => [id, i]))
  const cot = new Map(thuTu.cots.map((c, i) => [c, i]))
  const vt = (l: LoiO) => [hang.get(l.id) ?? 1e9, cot.get(l.cot) ?? 1e9]
  loi.sort((a, b) => {
    const [ha, ca] = vt(a)
    const [hb, cb] = vt(b)
    return ha - hb || ca - cb
  })
  return { o, nguoi: goi.length, loi, goi }
}

/**
 * Dán vùng chép từ Excel (tab giữa cột, xuống dòng giữa hàng) bắt đầu từ ô (r0, c0): chạy sang
 * phải theo các cột SỬA ĐƯỢC đang hiện, xuống dưới theo các dòng đang hiện. Ô trống trong vùng
 * dán bị bỏ qua (không xoá ô có sẵn); phần thừa ra ngoài bảng bị cắt.
 */
export function danVung(
  text: string,
  ids: string[],
  cots: readonly CotSua[],
  r0: number,
  c0: number,
): { id: string; cot: CotSua; v: string }[] {
  const hang = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n')
  const out: { id: string; cot: CotSua; v: string }[] = []
  hang.forEach((h, i) =>
    h.split('\t').forEach((o, j) => {
      const id = ids[r0 + i]
      const cot = cots[c0 + j]
      const v = o.trim()
      if (id && cot && v) out.push({ id, cot, v })
    }),
  )
  return out
}

/** Vùng dán có nhiều ô (có tab hoặc xuống dòng) — một ô thì để ô nhập tự dán như thường. */
export const laVung = (text: string) => /[\t\n]/.test(text.replace(/\r?\n$/, ''))
