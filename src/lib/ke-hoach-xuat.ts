/**
 * KẾ HOẠCH XUẤT HÀNG (06/10/2026) — "tháng này và các tháng tới xuất cho khách
 * nào, bao nhiêu, đợt nào có nguy cơ trễ?"
 *
 * ĐƠN VỊ LÀ ĐỢT XUẤT = một NHÓM của lệnh SX (`production_order_groups`, thường
 * một PO của khách). Đo 06/10: 57/60 nhóm có ngày xuất riêng; ngày xuất của
 * LỆNH chỉ là ngày CUỐI (LAURA 01 có 11 ngày xuất từ 30/12/2026 tới 24/03/2027).
 * Kế hoạch theo ngày của lệnh là nói dối về 10 chuyến còn lại.
 *
 * TRỊ GIÁ ĐỢT: nhóm gắn đơn bán → tổng đơn đó; lệnh một nhóm → tổng đơn của
 * lệnh; còn lại → SL dòng lệnh × đơn giá CÙNG SP trong đơn của lệnh. Đo 06/10:
 * 39 + 21 = 60/60 đợt có trị giá, Σ theo lệnh KHỚP Σ đơn bán từng lệnh.
 *
 * KHÔNG CÓ (đo 06/10, nói thẳng trên màn): tiến độ sản xuất (0 phiếu ghi sổ),
 * số cont (chữ tay ở 3/19 lệnh, CBM ở 39/291 dòng), xuất thật (0 lần ghi).
 * Tín hiệu rủi ro duy nhất đo được là VẬT TƯ: đơn mua của lệnh chưa về đủ.
 */

export type DotXuat = {
  id: string
  lsx_id: string
  lsx_code: string
  lsx_status: string
  customer: string
  /** Số PO khách hoặc tên đợt ("Đợt 3"). */
  label: string
  ship_label: string | null
  /** yyyy-mm-dd */
  ship_date: string | null
  /** 'nhom' = ngày của chính đợt · 'lenh' = nhóm trống ngày, mượn ngày cuối của lệnh. */
  date_src: 'nhom' | 'lenh'
  order_code: string | null
  qty: number
  /** USD. null = không tính được (không đơn giá nào). */
  value: number | null
  value_src: 'don' | 'gia-dong' | 'thieu-gia' | null
  /** Chữ cont của LỆNH (cả lệnh, không phải đợt). */
  cont: string | null
  vt: {
    po_total: number
    po_open: number
    po_chua_gui: number
    due: string | null
    da_nhan: boolean
  }
  /** SL theo khoá SP (`khoaSp`) của riêng đợt này. */
  sl?: Record<string, number>
  /** 'sale' = đợt Sale chia ở Kế hoạch xuất (0222) · 'lenh' = nhóm của dòng lệnh. */
  nguon?: 'sale' | 'lenh'
}

/** Ngưỡng "sắp xuất" — đợt trong 45 ngày tới mà vật tư chưa đủ là cần để ý. */
export const SAP_XUAT_NGAY = 45

export const thangCua = (iso: string) => iso.slice(0, 7)
export const tenThang = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`

const ngayGiua = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  )

export type TinhTrang = {
  tone: 'stop' | 'warn' | 'done' | 'neutral'
  text: string
  /** Vào rổ "Cần để ý" — CÙNG hàm với ô đếm đầu trang (số là lời hứa). */
  canDeY: boolean
  /** Số ngày tới ngày xuất (âm = đã qua). null khi không có ngày. */
  conNgay: number | null
}

export function tinhTrang(d: DotXuat, today: string): TinhTrang {
  if (d.lsx_status === 'completed')
    return { tone: 'done', text: 'Lệnh đã hoàn thành', canDeY: false, conNgay: null }
  if (!d.ship_date)
    return { tone: 'warn', text: 'Chưa có ngày xuất', canDeY: true, conNgay: null }
  const n = ngayGiua(d.ship_date, today)
  if (n < 0)
    return { tone: 'stop', text: `Quá ngày xuất ${-n} ngày`, canDeY: true, conNgay: n }
  if (n <= SAP_XUAT_NGAY && d.vt.po_open > 0)
    return {
      tone: 'warn',
      text: `Còn ${n} ngày · ${d.vt.po_open} đơn mua chưa về đủ`,
      canDeY: true,
      conNgay: n,
    }
  return { tone: 'neutral', text: `Còn ${n} ngày`, canDeY: false, conNgay: n }
}

/** Các tháng liên tục từ tháng sớm nhất tới muộn nhất (để ma trận không hở tháng trống). */
export function dayThang(dots: readonly DotXuat[]): string[] {
  const ms = dots.flatMap((d) => (d.ship_date ? [thangCua(d.ship_date)] : [])).sort()
  if (!ms.length) return []
  const out: string[] = []
  let [y, m] = ms[0].split('-').map(Number)
  const [y2, m2] = ms.at(-1)!.split('-').map(Number)
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Trị giá · số đợt · số đợt MƯỢN ngày của lệnh (chưa có ngày riêng). */
export type O = { value: number; n: number; muon: number }
export type DongMaTran = { customer: string; tong: O; theoThang: Record<string, O> }

/** Ma trận khách × tháng: cộng trị giá + đếm đợt. */
export function maTran(dots: readonly DotXuat[]): DongMaTran[] {
  const by = new Map<string, DongMaTran>()
  for (const d of dots) {
    if (!d.ship_date) continue
    const r = by.get(d.customer) ?? {
      customer: d.customer,
      tong: { value: 0, n: 0, muon: 0 },
      theoThang: {},
    }
    const ym = thangCua(d.ship_date)
    const o = (r.theoThang[ym] ??= { value: 0, n: 0, muon: 0 })
    o.value += d.value ?? 0
    o.n += 1
    if (d.date_src === 'lenh') o.muon += 1
    r.tong.value += d.value ?? 0
    r.tong.n += 1
    if (d.date_src === 'lenh') r.tong.muon += 1
    by.set(d.customer, r)
  }
  return [...by.values()].sort((a, b) => b.tong.value - a.tong.value)
}

export function cong(dots: readonly DotXuat[]): O {
  return {
    value: dots.reduce((s, d) => s + (d.value ?? 0), 0),
    n: dots.length,
    muon: dots.filter((d) => d.date_src === 'lenh').length,
  }
}

/* ── DỰNG ĐỢT TỪ DỮ LIỆU THÔ (server gọi; thuần để test) ───────────────── */

export type RawLsx = {
  id: string
  code: string
  status: string
  customer: string
  ship_date: string | null
  container_summary: string | null
  materials_due_at: string | null
  materials_received_at: string | null
}
export type RawNhom = {
  id: string
  production_order_id: string
  sales_order_id: string | null
  po_no: string | null
  title: string | null
  ship_date: string | null
  ship_label: string | null
  sort_order: number | null
}
export type RawDongLenh = {
  production_order_id: string
  group_id: string | null
  qty: number
  product_id: string | null
  sales_order_line_id: string | null
  /** Mã SP + tên trên dòng lệnh — để dựng cột SP của kế hoạch theo lệnh. */
  product_code?: string | null
  name_vi?: string | null
  customer_item_code?: string | null
}
export type RawDon = { id: string; code: string; production_order_id: string | null }
export type RawDongDon = {
  id: string
  order_id: string
  product_id: string | null
  qty: number
  unit_price: number | null
}
export type RawDonMua = { production_order_id: string | null; status: string }
/** Đợt xuất Sale chia (bảng `sales_ship_lots` + `sales_ship_lot_lines`, 0222). */
export type RawLot = {
  id: string
  production_order_id: string
  seq: number
  po_no: string | null
  po_ref: string | null
  order_no: string | null
  ship_date: string | null
  note: string | null
  lines: { product_key: string; qty: number }[]
}

/** Khoá cột SP: mã SP trên dòng lệnh (gọn khoảng trắng) — cùng khoá với `sales_ship_lot_lines.product_key`. */
export const khoaSp = (l: Pick<RawDongLenh, 'product_code' | 'product_id'>) =>
  (l.product_code ?? '').replace(/\s+/g, ' ').trim() || l.product_id || '—'

/** Tên hiển thị của đợt Sale: PO tham chiếu · PO khách, thiếu cả hai thì "Đợt n". */
export const tenDotSale = (l: Pick<RawLot, 'po_no' | 'po_ref' | 'seq'>) =>
  [l.po_ref, l.po_no]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(' · ') || `Đợt ${l.seq}`

const tien = (l: Pick<RawDongDon, 'qty' | 'unit_price'>) =>
  Number(l.qty) * Number(l.unit_price ?? 0)

/**
 * Mỗi NHÓM của lệnh → một đợt. Lệnh huỷ / nháp bỏ qua ở tầng gọi.
 * Trị giá: nhóm gắn đơn → tổng đơn đó · lệnh MỘT nhóm → tổng đơn của lệnh ·
 * còn lại → SL dòng lệnh × giá (dòng đơn nối thẳng, hoặc đơn giá CÙNG SP trong
 * đơn của lệnh). Không dòng nào có giá → `value` null (không giả 0).
 */
export function dungDotXuat(i: {
  lsx: RawLsx[]
  nhom: RawNhom[]
  dongLenh: RawDongLenh[]
  don: RawDon[]
  dongDon: RawDongDon[]
  donMua: RawDonMua[]
  /** Đợt Sale chia (0222). Lệnh CÓ đợt Sale thì đợt lấy từ đây, KHÔNG lấy nhóm lệnh. */
  lots?: RawLot[]
}): DotXuat[] {
  const dongDonById = new Map(i.dongDon.map((l) => [l.id, l]))
  const out: DotXuat[] = []
  for (const x of i.lsx) {
    const dons = i.don.filter((o) => o.production_order_id === x.id)
    const dongCuaLenh = i.dongDon.filter((l) => dons.some((o) => o.id === l.order_id))
    const giaSp = new Map<string, number>()
    for (const l of dongCuaLenh)
      if (l.product_id && Number(l.unit_price) > 0 && !giaSp.has(l.product_id))
        giaSp.set(l.product_id, Number(l.unit_price))
    const nhoms = i.nhom
      .filter((g) => g.production_order_id === x.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const mua = i.donMua.filter(
      (p) => p.production_order_id === x.id && p.status !== 'cancelled',
    )
    const vt = {
      po_total: mua.length,
      po_open: mua.filter((p) => p.status !== 'received').length,
      po_chua_gui: mua.filter((p) => ['draft', 'pending_approval', 'approved'].includes(p.status)).length, // prettier-ignore
      due: x.materials_due_at,
      da_nhan: !!x.materials_received_at,
    }
    const lotsOf = (i.lots ?? [])
      .filter((l) => l.production_order_id === x.id)
      .sort((a, b) => a.seq - b.seq)
    if (lotsOf.length) {
      // Giá theo KHOÁ SP: dòng lệnh nối dòng đơn thì lấy giá dòng đó, không thì giá cùng SP trong đơn của lệnh.
      const giaKhoa = new Map<string, number>()
      for (const l of i.dongLenh.filter((d) => d.production_order_id === x.id)) {
        const k = khoaSp(l)
        if (giaKhoa.has(k)) continue
        const gia = l.sales_order_line_id
          ? Number(dongDonById.get(l.sales_order_line_id)?.unit_price ?? 0)
          : ((l.product_id ? giaSp.get(l.product_id) : 0) ?? 0)
        if (gia > 0) giaKhoa.set(k, gia)
      }
      for (const lot of lotsOf) {
        const sl: Record<string, number> = {}
        for (const ln of lot.lines)
          sl[ln.product_key] = (sl[ln.product_key] ?? 0) + Number(ln.qty)
        const co = lot.lines.filter((ln) => Number(ln.qty) > 0)
        const coGia = co.filter((ln) => giaKhoa.has(ln.product_key))
        const value = coGia.length ? coGia.reduce((s2, ln) => s2 + Number(ln.qty) * giaKhoa.get(ln.product_key)!, 0) : null // prettier-ignore
        out.push({
          id: lot.id,
          lsx_id: x.id,
          lsx_code: x.code,
          lsx_status: x.status,
          customer: x.customer,
          label: tenDotSale(lot),
          ship_label: lot.note,
          ship_date: (lot.ship_date ?? x.ship_date)?.slice(0, 10) ?? null,
          date_src: lot.ship_date ? 'nhom' : 'lenh',
          order_code: lot.order_no ? `#${lot.order_no}` : null,
          qty: co.reduce((s2, ln) => s2 + Number(ln.qty), 0),
          value: value == null ? null : Math.round(value * 100) / 100,
          value_src: !coGia.length
            ? null
            : coGia.length === co.length
              ? 'gia-dong'
              : 'thieu-gia',
          cont: x.container_summary,
          vt,
          sl,
          nguon: 'sale',
        })
      }
      continue
    }
    for (const g of nhoms) {
      const dong = i.dongLenh.filter((l) => l.group_id === g.id)
      let value: number | null
      let src: DotXuat['value_src']
      if (g.sales_order_id) {
        value = i.dongDon.filter((l) => l.order_id === g.sales_order_id).reduce((s, l) => s + tien(l), 0) // prettier-ignore
        src = 'don'
      } else if (nhoms.length === 1 && dons.length) {
        value = dongCuaLenh.reduce((s, l) => s + tien(l), 0)
        src = 'don'
      } else {
        let coGia = 0
        const v = dong.reduce((s, l) => {
          const gia = l.sales_order_line_id
            ? Number(dongDonById.get(l.sales_order_line_id)?.unit_price ?? 0)
            : ((l.product_id ? giaSp.get(l.product_id) : 0) ?? 0)
          if (gia > 0) coGia++
          return s + Number(l.qty) * gia
        }, 0)
        value = coGia ? v : null
        src = !coGia ? null : coGia === dong.length ? 'gia-dong' : 'thieu-gia'
      }
      const don = g.sales_order_id ? dons.find((o) => o.id === g.sales_order_id) : null
      out.push({
        id: g.id,
        lsx_id: x.id,
        lsx_code: x.code,
        lsx_status: x.status,
        customer: x.customer,
        label: g.po_no || g.title || '—',
        ship_label: g.ship_label,
        ship_date: (g.ship_date ?? x.ship_date)?.slice(0, 10) ?? null,
        date_src: g.ship_date ? 'nhom' : 'lenh',
        order_code: don?.code ?? null,
        qty: dong.reduce((s, l) => s + Number(l.qty), 0),
        value: value == null ? null : Math.round(value * 100) / 100,
        value_src: src,
        cont: x.container_summary,
        vt,
        sl: dong.reduce<Record<string, number>>((m, l) => ((m[khoaSp(l)] = (m[khoaSp(l)] ?? 0) + Number(l.qty)), m), {}), // prettier-ignore
        nguon: 'lenh',
      })
    }
  }
  return out
}

/* ── KẾ HOẠCH XUẤT THEO LỆNH (06/10/2026) ───────────────────────────────────
   Chủ dự án: "thực tế sale lên kế hoạch xuất hàng cho các lệnh sản xuất".
   Sổ của Sale (ảnh IBIZA 06/10): mỗi LỆNH chia thành các PO khách — hàng = PO
   (Order # · PO khách · ngày Factory Ship Date), cột = từng SP của lệnh, dòng
   đầu "TỔNG SỐ CÁI" mỗi SP. Trên hệ thống chính là NHÓM của lệnh (PO + ngày
   xuất) × DÒNG lệnh trong nhóm — nên màn đọc thẳng cấu trúc đó, không thêm bảng.
   ────────────────────────────────────────────────────────────────────────── */

export type SpLenh = {
  /** Khoá cột: mã SP (đã gọn khoảng trắng) — cùng mã ở hai nhóm là cùng cột. */
  key: string
  code: string
  name: string | null
  customer_item_code: string | null
  /** Tổng SL của SP trong CẢ lệnh. */
  qty: number
}

export type DotCuaLenh = DotXuat & {
  /** SL theo cột SP (khoá `SpLenh.key`) của riêng đợt này. */
  sl: Record<string, number>
}

export type LenhXuat = {
  lsx_id: string
  lsx_code: string
  lsx_status: string
  customer: string
  ship_date: string | null
  cont: string | null
  vt: DotXuat['vt']
  sps: SpLenh[]
  dots: DotCuaLenh[]
  value: number | null
  /** Lệnh còn MỘT nhóm, chưa ngày riêng — Sale chưa chia theo PO khách (vd IBIZA 06/10). */
  chua_chia: boolean
  /** Số đợt đang mượn ngày xuất cuối của lệnh. */
  muon: number
  /** Kế hoạch Sale đã chia (0222) — null = lệnh chưa có, đợt đang đọc từ nhóm lệnh. */
  ke_hoach: RawLot[] | null
}

/** Gom đợt theo lệnh + dựng cột SP — đầu vào giống `dungDotXuat`. */
export function gomTheoLenh(i: Parameters<typeof dungDotXuat>[0]): LenhXuat[] {
  const dots = dungDotXuat(i)
  return i.lsx.map((x) => {
    const dong = i.dongLenh.filter((l) => l.production_order_id === x.id)
    const sps = new Map<string, SpLenh>()
    for (const l of dong) {
      const k = khoaSp(l)
      const sp =
        sps.get(k) ??
        { key: k, code: k, name: l.name_vi ?? null, customer_item_code: l.customer_item_code ?? null, qty: 0 } // prettier-ignore
      sp.qty += Number(l.qty)
      sps.set(k, sp)
    }
    const cuaLenh = dots
      .filter((d) => d.lsx_id === x.id)
      .map((d) => ({ ...d, sl: d.sl ?? {} }))
      .sort((a, b) => ((a.ship_date ?? '9') < (b.ship_date ?? '9') ? -1 : a.ship_date === b.ship_date ? (a.label < b.label ? -1 : 1) : 1)) // prettier-ignore
    const coGia = cuaLenh.filter((d) => d.value != null)
    const keHoach = (i.lots ?? [])
      .filter((l) => l.production_order_id === x.id)
      .sort((a, b) => a.seq - b.seq)
    return {
      lsx_id: x.id,
      lsx_code: x.code,
      lsx_status: x.status,
      customer: x.customer,
      ship_date: x.ship_date,
      cont: x.container_summary,
      vt: cuaLenh[0]?.vt ?? { po_total: 0, po_open: 0, po_chua_gui: 0, due: x.materials_due_at, da_nhan: !!x.materials_received_at }, // prettier-ignore
      sps: [...sps.values()],
      dots: cuaLenh,
      value: coGia.length ? coGia.reduce((s, d) => s + (d.value ?? 0), 0) : null,
      chua_chia:
        !keHoach.length && cuaLenh.length === 1 && cuaLenh[0].date_src === 'lenh',
      muon: cuaLenh.filter((d) => d.date_src === 'lenh').length,
      ke_hoach: keHoach.length ? keHoach : null,
    }
  })
}

/* ── KIỂM KẾ HOẠCH SALE TRƯỚC KHI LƯU (dùng chung client + server) ───────── */

export type LotInput = {
  po_no: string | null
  po_ref: string | null
  order_no: string | null
  ship_date: string | null
  note: string | null
  lines: { product_key: string; qty: number }[]
}

/**
 * Kế hoạch có lưu được không — và mỗi SP còn bao nhiêu chưa xếp đợt.
 *
 * CHẶN: SP không thuộc lệnh · xếp VƯỢT SL lệnh (không xuất được nhiều hơn đơn) ·
 * đợt không có SL nào. KHÔNG chặn xếp THIẾU: chia dần từng PO là chuyện thường —
 * phần còn lại bày ở dòng "Chưa xếp đợt" để Sale thấy.
 */
export function kiemKeHoach(
  lots: readonly LotInput[],
  sps: readonly { key: string; code: string; qty: number }[],
): { loi: string[]; daXep: Record<string, number>; conLai: Record<string, number> } {
  const loi: string[] = []
  const biet = new Map(sps.map((s) => [s.key, s]))
  const daXep: Record<string, number> = {}
  lots.forEach((lot, i) => {
    const co = lot.lines.filter((l) => Number(l.qty) > 0)
    if (!co.length) loi.push(`Đợt ${i + 1}${lot.po_ref || lot.po_no ? ` (${lot.po_ref || lot.po_no})` : ''} chưa có SL nào`) // prettier-ignore
    for (const l of lot.lines) {
      if (Number(l.qty) < 0) loi.push(`Đợt ${i + 1}: SL âm ở ${l.product_key}`)
      if (!biet.has(l.product_key)) {
        if (Number(l.qty) > 0)
          loi.push(`Đợt ${i + 1}: SP ${l.product_key} không có trong lệnh`)
        continue
      }
      daXep[l.product_key] = (daXep[l.product_key] ?? 0) + Number(l.qty)
    }
  })
  const conLai: Record<string, number> = {}
  for (const s of sps) {
    const x = daXep[s.key] ?? 0
    conLai[s.key] = s.qty - x
    if (x > s.qty + 1e-9)
      loi.push(
        `${s.code}: xếp ${x.toLocaleString('vi-VN')} > SL lệnh ${s.qty.toLocaleString('vi-VN')}`,
      )
  }
  return { loi, daXep, conLai }
}
