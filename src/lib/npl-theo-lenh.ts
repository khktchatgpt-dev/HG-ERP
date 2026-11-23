/**
 * NPL THEO LỆNH (20/11/2026, bản vẽ https://claude.ai/artifact/8J3ZmaBWGeFGiutrVCcrgY,
 * Q1–Q7 duyệt theo đề xuất). Logic thuần — màn `/mua-hang/npl` và (B2) file Excel
 * dùng chung, nên số trên tab, chân bảng và file không thể lệch nhau.
 *
 * Câu màn trả lời: lệnh nào còn NPL chưa đặt, chưa về đủ — xem mọi lệnh trên một
 * bảng. Nguồn là DÒNG ĐƠN MUA, KHÔNG phải định mức: mã định mức chỉ khớp mã thực
 * mua 12/119 (đo 20/11), tính "chưa đặt" từ đó là báo sai ~107 mã.
 *
 *  · Q1 mỗi dòng = một mã của một lệnh trên một đơn (cùng mã nhiều dòng trong một
 *    đơn thì cộng). Gộp theo mã thì 19 cặp có tình trạng khác nhau giữa các đơn.
 *  · Q3 dòng đơn CHIA nhiều lệnh: hàng về giao cho lệnh xuất trước (ngày xuất,
 *    rồi số lệnh) — số nguyên, phần thiếu dồn về lệnh xuất sau.
 *  · Q4 đơn GỘP nhiều lệnh mà dòng chưa chia: tính vào lệnh chính của đơn, dòng
 *    mang danh sách lệnh đi kèm để màn ghi nhãn "đơn gộp".
 */

/** Bốn rổ của màn — mỗi rổ một tab. */
export type NplTab = 'chua_dat' | 'cho_ncc' | 'thieu' | 'du'

export const NPL_TABS: readonly NplTab[] = ['chua_dat', 'cho_ncc', 'thieu', 'du']

export const NPL_TAB_LABEL: Record<NplTab, string> = {
  chua_dat: 'Chưa đặt',
  cho_ncc: 'Chờ NCC xác nhận',
  thieu: 'Đang về còn thiếu',
  du: 'Về đủ',
}

/** Lệnh — `ship_date` để xếp nhóm và chia hàng về cho dòng chia nhiều lệnh. */
export type NplLenh = { id: string; code: string; ship_date: string | null }

export type NplDon = {
  id: string
  code: string
  status: string
  /** Hẹn về của đơn (yyyy-mm-dd). */
  expected_at: string | null
  /** Lệnh chính của đơn; null = đơn ngoài lệnh (chỉ phần chia mới vào lệnh). */
  production_order_id: string | null
  supplier: string
  assignee: string | null
  /** Id người cầm đơn (`assigned_to ?? created_by`, như `poOwner`) — cho "Của tôi". */
  assignee_id: string | null
  /** Lệnh đi kèm của đơn gộp (`supply_po_extra_lsx`), không gồm lệnh chính. */
  extra_lsx_ids: string[]
}

export type NplDong = {
  id: string
  po_id: string
  material_id: string | null
  ma: string
  ten: string
  dvt: string
  nhom: string | null
  qty: number
  received: number
  /** Dòng đã đóng thiếu — không còn gì để chờ. */
  closed: boolean
}

/** Phần chia của một dòng cho một lệnh (`supply_po_line_lsx`). */
export type NplPhan = { line_id: string; production_order_id: string; qty: number }

/** Một phần của dòng chia — để màn bày bảng "dòng này chia cho ai, nhận bao nhiêu". */
export type NplPhanChia = {
  lsx_code: string
  ship_date: string | null
  qty: number
  nhan: number
  thieu: number
}

export type NplRow = {
  key: string
  lsx_id: string
  lsx_code: string
  po_id: string
  po_code: string
  status: string
  tab: NplTab
  material_id: string | null
  ma: string
  ten: string
  dvt: string
  nhom: string | null
  supplier: string
  assignee: string | null
  assignee_id: string | null
  /** Hẹn về (yyyy-mm-dd) — của đơn. */
  hen: string | null
  /**
   * Số ngày trễ (> 0) — CHỈ dòng đang về còn thiếu (bản vẽ 2 · Q2, 21/11/2026).
   * Hẹn trên đơn nháp / chờ NCC là dự tính, không báo trễ: bản 1 tô đỏ 112/124
   * dòng tab Chưa đặt chỉ vì nháp ghi hẹn 20/11.
   */
  tre: number | null
  dat: number
  ve: number
  thieu: number
  /** Dòng đơn chia nhiều lệnh: tổng dòng, đã về, và từng phần. */
  chia: { po_line_qty: number; received: number; parts: NplPhanChia[] } | null
  /** Đơn gộp mà dòng chưa chia: mã các lệnh đi kèm (đã tính hết vào lệnh chính). */
  gop: string[] | null
}

/** Rổ của một dòng theo tình trạng đơn + còn thiếu. */
export function nplTab(status: string, thieu: number): NplTab {
  if (status === 'draft' || status === 'pending_approval') return 'chua_dat'
  if (status === 'approved' || status === 'ordered') return 'cho_ncc'
  if (
    (status === 'confirmed' || status === 'in_transit' || status === 'partial') &&
    thieu > 0
  ) {
    return 'thieu'
  }
  return 'du'
}

/** Số ngày từ `iso` tới `today` (cả hai yyyy-mm-dd); dương = đã qua. */
export function ngayQua(iso: string, today: string): number {
  const a = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/** So hai lệnh theo thứ tự "xuất trước": ngày xuất (trống xếp cuối), rồi số lệnh. */
export function xuatTruoc(a: NplLenh, b: NplLenh): number {
  if (a.ship_date !== b.ship_date) {
    if (!a.ship_date) return 1
    if (!b.ship_date) return -1
    return a.ship_date < b.ship_date ? -1 : 1
  }
  return a.code.localeCompare(b.code)
}

/**
 * Chia số đã về của MỘT dòng cho các phần theo thứ tự lệnh xuất trước (Q3). Phần
 * chia cộng chưa đủ số dòng thì phần dư thuộc lệnh chính của đơn (`mainId`).
 * Trả map lệnh → { qty, nhan } theo đúng thứ tự đã chia.
 */
export function chiaHangVe(
  lineQty: number,
  received: number,
  parts: { lsx: NplLenh; qty: number }[],
  main: NplLenh | null,
): { lsx: NplLenh; qty: number; nhan: number }[] {
  const all = parts.map((p) => ({ lsx: p.lsx, qty: p.qty }))
  const du = lineQty - all.reduce((s, p) => s + p.qty, 0)
  if (du > 1e-9 && main) {
    const same = all.find((p) => p.lsx.id === main.id)
    if (same) same.qty += du
    else all.push({ lsx: main, qty: du })
  }
  all.sort((a, b) => xuatTruoc(a.lsx, b.lsx))
  let con = Math.max(received, 0)
  return all.map((p) => {
    const nhan = Math.min(p.qty, con)
    con -= nhan
    return { ...p, nhan }
  })
}

/**
 * Dựng các dòng NPL của các lệnh ĐANG XEM (`active`). Lệnh ngoài tập đó vẫn cần
 * trong `lenhById` khi một dòng chia sang chúng — để chia hàng về cho đúng thứ tự.
 */
export function buildNpl(input: {
  active: NplLenh[]
  lenhById: Map<string, NplLenh>
  dons: NplDon[]
  dongs: NplDong[]
  phans: NplPhan[]
  today: string
}): NplRow[] {
  const activeIds = new Set(input.active.map((l) => l.id))
  const donById = new Map(input.dons.map((d) => [d.id, d]))
  const phanByLine = new Map<string, NplPhan[]>()
  for (const p of input.phans) {
    const list = phanByLine.get(p.line_id) ?? []
    list.push(p)
    phanByLine.set(p.line_id, list)
  }

  const acc = new Map<string, NplRow>()
  const add = (
    don: NplDon,
    dong: NplDong,
    lsx: NplLenh,
    dat: number,
    ve: number,
    chia: NplRow['chia'],
    gop: string[] | null,
  ) => {
    const matKey = dong.material_id ?? `ten:${dong.ten}`
    const key = `${lsx.id}|${don.id}|${matKey}`
    const thieu = dong.closed ? 0 : Math.max(dat - ve, 0)
    const cu = acc.get(key)
    if (cu) {
      cu.dat += dat
      cu.ve += ve
      cu.thieu += thieu
      cu.chia = cu.chia ?? chia
      return
    }
    acc.set(key, {
      key,
      lsx_id: lsx.id,
      lsx_code: lsx.code,
      po_id: don.id,
      po_code: don.code,
      status: don.status,
      tab: 'du',
      material_id: dong.material_id,
      ma: dong.ma,
      ten: dong.ten,
      dvt: dong.dvt,
      nhom: dong.nhom,
      supplier: don.supplier,
      assignee: don.assignee,
      assignee_id: don.assignee_id,
      hen: don.expected_at,
      tre: null,
      dat,
      ve,
      thieu,
      chia,
      gop,
    })
  }

  for (const dong of input.dongs) {
    const don = donById.get(dong.po_id)
    if (!don || don.status === 'cancelled') continue
    const main = don.production_order_id
      ? (input.lenhById.get(don.production_order_id) ?? null)
      : null
    const phans = phanByLine.get(dong.id)
    if (phans && phans.length > 0) {
      const parts = phans
        .map((p) => ({ lsx: input.lenhById.get(p.production_order_id), qty: p.qty }))
        .filter((p): p is { lsx: NplLenh; qty: number } => !!p.lsx)
      const chia = chiaHangVe(dong.qty, dong.received, parts, main)
      const detail: NplRow['chia'] = {
        po_line_qty: dong.qty,
        received: dong.received,
        parts: chia.map((c) => ({
          lsx_code: c.lsx.code,
          ship_date: c.lsx.ship_date,
          qty: c.qty,
          nhan: c.nhan,
          thieu: dong.closed ? 0 : Math.max(c.qty - c.nhan, 0),
        })),
      }
      for (const c of chia) {
        if (activeIds.has(c.lsx.id)) add(don, dong, c.lsx, c.qty, c.nhan, detail, null)
      }
      continue
    }
    if (!main || !activeIds.has(main.id)) continue
    const gop =
      don.extra_lsx_ids.length > 0
        ? don.extra_lsx_ids.map((id) => input.lenhById.get(id)?.code ?? '?')
        : null
    add(don, dong, main, dong.qty, dong.received, null, gop)
  }

  const rows = [...acc.values()]
  for (const r of rows) {
    r.tab = nplTab(r.status, r.thieu)
    const qua = r.hen ? ngayQua(r.hen, input.today) : 0
    r.tre = r.tab === 'thieu' && qua > 0 ? qua : null
  }
  return rows
}

/**
 * Phạm vi Của tôi / Cả phòng (bản vẽ 2 · Q1). "Của tôi" = đơn tôi phụ trách —
 * đúng nghĩa `isMyPo` của `lib/supply-scope` mà Bàn làm việc dùng. Không biết
 * người xem là ai thì "của tôi" rỗng, không lặng lẽ hiện cả phòng.
 */
export function phamViNpl(
  rows: NplRow[],
  scope: 'toi' | 'phong',
  meId: string | null,
): NplRow[] {
  if (scope === 'phong') return rows
  return meId ? rows.filter((r) => r.assignee_id === meId) : []
}

/** Bộ lọc của thanh lọc — chuỗi rỗng = không lọc. */
export type NplLoc = {
  q: string
  lsx: string
  ncc: string
  nhom: string
  nguoi: string
  quaHen: boolean
}

export const NPL_LOC_TRONG: NplLoc = {
  q: '',
  lsx: '',
  ncc: '',
  nhom: '',
  nguoi: '',
  quaHen: false,
}

export function coLoc(f: NplLoc): boolean {
  return !!(f.q.trim() || f.lsx || f.ncc || f.nhom || f.nguoi || f.quaHen)
}

/** Bỏ dấu + chữ thường để tìm "bulon" ra "Bulon", "long den" ra "Long đền". */
function khongDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/**
 * Lọc theo thanh lọc (KHÔNG theo tab). Tab đếm trên đúng tập này nên số trên tab
 * luôn bằng số dòng bấm vào thấy.
 */
export function locNpl(rows: NplRow[], f: NplLoc): NplRow[] {
  const q = khongDau(f.q.trim())
  return rows.filter((r) => {
    if (f.lsx && r.lsx_id !== f.lsx) return false
    if (f.ncc && r.supplier !== f.ncc) return false
    if (f.nhom && (r.nhom ?? '') !== f.nhom) return false
    if (f.nguoi && (r.assignee ?? '') !== f.nguoi) return false
    if (f.quaHen && !r.tre) return false
    if (q) {
      const hay = khongDau(`${r.ma} ${r.ten} ${r.po_code}`)
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export type NplDem = Record<NplTab | 'tat_ca', number> & { tre: number }

/** Đếm mỗi tab + số dòng đang về còn thiếu đã trễ hẹn. */
export function demNpl(rows: NplRow[]): NplDem {
  const d: NplDem = {
    chua_dat: 0,
    cho_ncc: 0,
    thieu: 0,
    du: 0,
    tat_ca: rows.length,
    tre: 0,
  }
  for (const r of rows) {
    d[r.tab] += 1
    if (r.tab === 'thieu' && r.tre) d.tre += 1
  }
  return d
}

export type NplNhom = { lenh: NplLenh; rows: NplRow[]; tre: number }

/**
 * Gom theo lệnh — lệnh xuất sớm nhất lên trước (Q5). Trong nhóm: hẹn về sớm
 * trước (chưa hẹn cuối), rồi mã đơn, rồi mã NPL — dòng cùng đơn đứng liền nhau.
 */
export function nhomTheoLenh(rows: NplRow[], lenhById: Map<string, NplLenh>): NplNhom[] {
  const by = new Map<string, NplRow[]>()
  for (const r of rows) {
    const list = by.get(r.lsx_id) ?? []
    list.push(r)
    by.set(r.lsx_id, list)
  }
  const out: NplNhom[] = []
  for (const [id, list] of by) {
    const lenh = lenhById.get(id) ?? { id, code: list[0].lsx_code, ship_date: null }
    list.sort(
      (a, b) =>
        (a.hen ?? '9999').localeCompare(b.hen ?? '9999') ||
        a.po_code.localeCompare(b.po_code) ||
        a.ma.localeCompare(b.ma),
    )
    out.push({
      lenh,
      rows: list,
      tre: list.filter((r) => r.tab === 'thieu' && r.tre).length,
    })
  }
  return out.sort((a, b) => xuatTruoc(a.lenh, b.lenh))
}

/** Tên gọi trong cột hẹp: từ cuối của họ tên ("Đặng Thị Thanh Nga" → "Nga"). */
export function tenGoi(name: string | null): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? name
}
