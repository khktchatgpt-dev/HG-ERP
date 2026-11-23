import {
  chiaHangVe,
  ngayQua,
  xuatTruoc,
  type NplLenh,
  type NplPhan,
} from './npl-theo-lenh'

/**
 * KHO · ĐƠN MUA THEO LỆNH (23/11/2026, bản vẽ
 * https://claude.ai/artifact/69uVsoeKimjmBMCiXD9Tsp, Q1–Q6 duyệt theo đề xuất).
 * Logic thuần — trang server và màn client dùng chung nên số trên rổ, dòng lệnh,
 * ngăn chi tiết và chân bảng không thể lệch nhau.
 *
 * Câu màn trả lời cho Kho: "lệnh này mua những đơn nào, Kho đã nhận tới đâu?".
 * Một dòng = một (lệnh, đơn). Luật chia lấy của màn NPL theo lệnh bên Cung ứng
 * (`npl-theo-lenh`, Q4) để hai phòng ra cùng một số:
 *  · dòng đơn CHIA cho nhiều lệnh: mỗi lệnh nhận phần của mình, hàng về giao cho
 *    lệnh xuất trước (`chiaHangVe`);
 *  · đơn GỘP (lệnh đi kèm, dòng chưa chia): hiện ở MỌI lệnh nó phục vụ, mang nhãn
 *    "gộp" — Kho cần biết đơn đó có hàng cho lệnh mình (bản vẽ đếm nó ở cả hai).
 *
 * Tình trạng của đơn với một lệnh (Q2, Q5):
 *  · `chua_dat`  nháp / chờ duyệt — chỉ để biết, không tính là chờ hàng;
 *  · `chua_ve`   đã duyệt trở đi, chưa nhận gì;
 *  · `mot_phan`  đã nhận một phần, còn thiếu;
 *  · `du`        mọi dòng nhận đủ HOẶC Cung ứng đã chốt thiếu, hoặc đơn đã đóng;
 *  · `huy`       đơn huỷ mà vẫn có phiếu nhập (Q6) — sai lệch, không vào số nào.
 */

export type KdTinh = 'chua_dat' | 'chua_ve' | 'mot_phan' | 'du' | 'huy'

export type KdLenh = NplLenh & { khach: string | null }

export type KdDon = {
  id: string
  code: string
  status: string
  expected_at: string | null
  production_order_id: string | null
  supplier: string
  /** Lệnh đi kèm của đơn gộp (`supply_po_extra_lsx`), không gồm lệnh chính. */
  extra_lsx_ids: string[]
}

export type KdDongVao = {
  id: string
  po_id: string
  ma: string
  ten: string
  dvt: string
  qty: number
  received: number
  /** Cung ứng đã chốt thiếu dòng này — không còn gì để chờ. */
  closed: boolean
}

export type KdPhieu = { doc_id: string; code: string; date: string }

export type KdDong = {
  /** Id dòng đơn mua (`supply_po_lines`). */
  id: string
  ma: string
  ten: string
  dvt: string
  dat: number
  ve: number
  thieu: number
  closed: boolean
  /** Dòng chia nhiều lệnh — `dat` / `ve` là phần của lệnh này. */
  chia: boolean
}

export type KdDonLenh = {
  key: string
  lsx_id: string
  po_id: string
  po_code: string
  status: string
  supplier: string
  hen: string | null
  tinh: KdTinh
  /** Số ngày quá hẹn (> 0) — chỉ đơn NCC đã xác nhận mà còn chờ hàng. */
  tre: number | null
  dong_du: number
  dong_tong: number
  chot_thieu: boolean
  /** Mã các lệnh khác cùng dùng đơn này (đơn gộp / dòng chia). */
  gop: string[]
  /** Lệnh chính của đơn khi lệnh đang xem chỉ là lệnh đi kèm. */
  lenh_chinh: string | null
  phieu: KdPhieu[]
  dong: KdDong[]
}

export type KdRo = 'cho' | 'tre' | 'du' | 'all'
export const KD_RO: readonly KdRo[] = ['cho', 'tre', 'du', 'all']

export type KdLenhTong = KdLenh & {
  don: number
  du: number
  mot_phan: number
  chua_ve: number
  chua_dat: number
  tre: number
  sai: number
  phieu_cuoi: KdPhieu | null
  ro: Record<KdRo, boolean>
}

const EPS = 1e-9
const DAT_ROI = new Set(['approved', 'ordered', 'confirmed', 'in_transit', 'partial'])
const NCC_XAC_NHAN = new Set(['confirmed', 'in_transit', 'partial'])
const XONG = new Set(['received', 'closed'])

/** Tình trạng một đơn với một lệnh, từ trạng thái đơn + các dòng của lệnh đó. */
export function tinhDon(status: string, dong: KdDong[]): KdTinh {
  if (status === 'cancelled') return 'huy'
  if (status === 'draft' || status === 'pending_approval') return 'chua_dat'
  if (XONG.has(status)) return 'du'
  const thieu = dong.reduce((s, d) => s + d.thieu, 0)
  if (thieu <= EPS) return 'du'
  if (!DAT_ROI.has(status)) return 'du'
  return dong.some((d) => d.ve > EPS) ? 'mot_phan' : 'chua_ve'
}

/** Tab đơn trên trang một lệnh (`/warehouse/nhap/theo-lenh/[id]`). */
export type KdNgan = 'cho' | 'chua_dat' | 'du'

export type KdPhieuLenh = KdPhieu & { dons: string[] }

/**
 * Mọi phiếu nhập của các đơn thuộc một lệnh, MỚI NHẤT TRƯỚC — tab "Phiếu nhập"
 * của trang lệnh. Một phiếu ghi cho nhiều đơn thì một dòng, liệt kê các đơn.
 * Phiếu đã đảo không có ở đây (repo đã loại).
 */
export function phieuCuaLenh(rows: KdDonLenh[]): KdPhieuLenh[] {
  const m = new Map<string, KdPhieuLenh>()
  for (const r of rows)
    for (const p of r.phieu) {
      const c = m.get(p.doc_id) ?? { ...p, dons: [] }
      if (!c.dons.includes(r.po_code)) c.dons.push(r.po_code)
      m.set(p.doc_id, c)
    }
  return [...m.values()].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.code < b.code ? 1 : -1,
  )
}

export function nganCua(t: KdTinh): KdNgan {
  if (t === 'mot_phan' || t === 'chua_ve') return 'cho'
  if (t === 'chua_dat') return 'chua_dat'
  return 'du'
}

/**
 * Dựng mọi (lệnh, đơn) của các lệnh `active`. `lenhById` phải chứa cả lệnh ngoài
 * tập đang xem mà dòng chia trỏ tới — để chia hàng về đúng thứ tự xuất trước.
 * Đơn huỷ chỉ lên màn khi có phiếu nhập (`phieuByPo`).
 */
export function buildDonTheoLenh(input: {
  active: KdLenh[]
  lenhById: Map<string, NplLenh>
  dons: KdDon[]
  dongs: KdDongVao[]
  phans: NplPhan[]
  phieuByPo: Map<string, KdPhieu[]>
  today: string
}): KdDonLenh[] {
  const activeIds = new Set(input.active.map((l) => l.id))
  const phanByLine = new Map<string, NplPhan[]>()
  for (const p of input.phans) {
    phanByLine.set(p.line_id, [...(phanByLine.get(p.line_id) ?? []), p])
  }
  const dongByPo = new Map<string, KdDongVao[]>()
  for (const d of input.dongs)
    dongByPo.set(d.po_id, [...(dongByPo.get(d.po_id) ?? []), d])

  const out: KdDonLenh[] = []
  for (const don of input.dons) {
    const phieu = input.phieuByPo.get(don.id) ?? []
    if (don.status === 'cancelled' && phieu.length === 0) continue
    const main = don.production_order_id
      ? (input.lenhById.get(don.production_order_id) ?? null)
      : null
    const theoLenh = new Map<string, KdDong[]>()
    const them = (lsxId: string, d: KdDong) => {
      if (!activeIds.has(lsxId)) return
      theoLenh.set(lsxId, [...(theoLenh.get(lsxId) ?? []), d])
    }
    const nguyen = [don.production_order_id, ...don.extra_lsx_ids].filter(
      (x): x is string => !!x,
    )

    for (const dong of dongByPo.get(don.id) ?? []) {
      const phans = phanByLine.get(dong.id)
      const mk = (dat: number, ve: number, chia: boolean): KdDong => ({
        id: dong.id,
        ma: dong.ma,
        ten: dong.ten,
        dvt: dong.dvt,
        dat,
        ve,
        thieu: dong.closed ? 0 : Math.max(dat - ve, 0),
        closed: dong.closed,
        chia,
      })
      if (phans && phans.length > 0) {
        const parts = phans
          .map((p) => ({ lsx: input.lenhById.get(p.production_order_id), qty: p.qty }))
          .filter((p): p is { lsx: NplLenh; qty: number } => !!p.lsx)
        for (const c of chiaHangVe(dong.qty, dong.received, parts, main)) {
          them(c.lsx.id, mk(c.qty, c.nhan, true))
        }
        continue
      }
      for (const id of new Set(nguyen)) them(id, mk(dong.qty, dong.received, false))
    }

    const lenhCuaDon = [...new Set([...nguyen, ...theoLenh.keys()])]
    for (const [lsxId, dong] of theoLenh) {
      const tinh = tinhDon(don.status, dong)
      const qua = don.expected_at ? ngayQua(don.expected_at, input.today) : 0
      const tre =
        (tinh === 'mot_phan' || tinh === 'chua_ve') &&
        NCC_XAC_NHAN.has(don.status) &&
        qua > 0
          ? qua
          : null
      out.push({
        key: `${lsxId}|${don.id}`,
        lsx_id: lsxId,
        po_id: don.id,
        po_code: don.code,
        status: don.status,
        supplier: don.supplier,
        hen: don.expected_at,
        tinh,
        tre,
        dong_du: dong.filter((d) => d.thieu <= EPS).length,
        dong_tong: dong.length,
        chot_thieu: dong.some((d) => d.closed && d.ve < d.dat - EPS),
        gop: lenhCuaDon
          .filter((id) => id !== lsxId)
          .map((id) => input.lenhById.get(id)?.code ?? '?'),
        lenh_chinh: main && main.id !== lsxId ? main.code : null,
        phieu,
        dong,
      })
    }
  }
  return out
}

/** Tổng của từng lệnh — đếm trên CHÍNH các dòng `buildDonTheoLenh` trả về. */
export function tongTheoLenh(active: KdLenh[], rows: KdDonLenh[]): KdLenhTong[] {
  const by = new Map<string, KdDonLenh[]>()
  for (const r of rows) by.set(r.lsx_id, [...(by.get(r.lsx_id) ?? []), r])
  return [...active].sort(xuatTruoc).map((l) => {
    const ds = by.get(l.id) ?? []
    const dem = (t: KdTinh) => ds.filter((r) => r.tinh === t).length
    const don = ds.filter((r) => r.tinh !== 'huy').length
    const du = dem('du')
    const mot_phan = dem('mot_phan')
    const chua_ve = dem('chua_ve')
    const chua_dat = dem('chua_dat')
    const tre = ds.filter((r) => r.tre).length
    let phieu_cuoi: KdPhieu | null = null
    for (const r of ds) {
      if (r.tinh === 'huy') continue
      for (const p of r.phieu) {
        if (!phieu_cuoi || p.date > phieu_cuoi.date) phieu_cuoi = p
      }
    }
    return {
      ...l,
      don,
      du,
      mot_phan,
      chua_ve,
      chua_dat,
      tre,
      sai: dem('huy'),
      phieu_cuoi,
      ro: {
        cho: mot_phan + chua_ve > 0,
        tre: tre > 0,
        du: don > 0 && du === don,
        all: true,
      },
    }
  })
}

/**
 * Thứ tự đơn trong một ngăn: đơn trễ lâu nhất trước, rồi hẹn về sớm (chưa hẹn
 * cuối), rồi mã đơn. Đơn huỷ-có-phiếu luôn ở cuối (Q6).
 */
export function xepDon(a: KdDonLenh, b: KdDonLenh): number {
  const huy = Number(a.tinh === 'huy') - Number(b.tinh === 'huy')
  if (huy) return huy
  const tre = (b.tre ?? 0) - (a.tre ?? 0)
  if (tre) return tre
  return (
    (a.hen ?? '9999').localeCompare(b.hen ?? '9999') || a.po_code.localeCompare(b.po_code)
  )
}
