/**
 * ĐỀ NGHỊ MUA · KHO NHẬP HÀNG ĐÃ MUA (0238 · Đ3/Đ4) — luật thuần dùng chung
 * server + màn. Bản vẽ DN-3 / DN-5
 * (https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, Q10–Q14 duyệt 13/10/2026).
 *
 * Một chỗ cho: số phải nhập của dòng (số duyệt), còn phải nhập, ngưỡng nhập
 * vượt (Q12), trạng thái phiếu suy từ sổ kho, và câu chặn trước khi ghi phiếu
 * nhập — màn và service đọc cùng một hàm, nên câu chặn trên màn chính là lỗi
 * server sẽ trả.
 */

/** Vượt số duyệt tới mức này thì chỉ cảnh báo (mua theo cuộn / thùng hay lố) — Q12. */
export const VUOT_TU_DO = 0.1

const EPS = 1e-9

/** Số PHẢI NHẬP của dòng = số lãnh đạo duyệt (null = duyệt đúng số đề nghị). */
export function soDuyet(l: { qty: number; approved_qty: number | null }): number {
  return l.approved_qty ?? l.qty
}

/** Còn phải nhập (không âm). */
export function conPhaiNhap(can: number, daNhap: number): number {
  return Math.max(0, can - daNhap)
}

/**
 * Trạng thái phiếu SUY TỪ SỔ KHO — chỉ cho phiếu đã duyệt trở đi.
 * Dòng duyệt 0 (không mua) không tính. Đủ mọi dòng → Xong; có nhập → Đang nhập;
 * chưa nhập gì → Đã duyệt. Phiếu đã "Chốt xong" (có lý do) thì giữ Xong.
 */
export function trangThaiTheoSo(
  lines: readonly { can: number; daNhap: number }[],
  daChot: boolean,
): 'approved' | 'ordering' | 'done' {
  if (daChot) return 'done'
  const mua = lines.filter((l) => l.can > EPS)
  if (mua.length > 0 && mua.every((l) => l.daNhap >= l.can - EPS)) return 'done'
  if (lines.some((l) => l.daNhap > EPS)) return 'ordering'
  return 'approved'
}

/** Mức vượt số duyệt sau lần nhập này: 0 = không vượt, 0.15 = vượt 15%. */
export function mucVuot(can: number, daNhap: number, lanNay: number): number {
  if (can <= EPS) return lanNay > EPS ? Infinity : 0
  return Math.max(0, (daNhap + lanNay - can) / can)
}

export type DongNhapDeNghi = {
  /** Dòng đề nghị. */
  line_id: string
  /** Tên trên phiếu đề nghị — để câu chặn nói đúng dòng người ta nhận ra. */
  name: string
  /** Mã đã gắn (có sẵn trên phiếu, hoặc Kho gắn / tạo lúc nhập). */
  material_id: string | null
  can: number
  daNhap: number
  /** Nhận lần này. 0 = để chuyến sau. */
  qty: number
  /** Đơn giá thật (VND, chưa VAT). null = chưa ghi. */
  unit_price: number | null
  note: string
}

export type DauPhieuNhap = {
  /** Nơi mua — tên tiệm / NCC gõ tự do (Q10). */
  noi_mua: string
}

export type KiemNhap =
  | { ok: true; canhBao: { dong: number; cau: string }[] }
  | {
      ok: false
      /** Chỉ số dòng (0-based) để nhảy tới, hoặc 'noi_mua'. */
      focus: number | 'noi_mua'
      /** Ô cần nhảy tới trong dòng. */
      o: 'ma' | 'qty' | 'gia' | 'note' | null
      message: string
      canhBao: { dong: number; cau: string }[]
    }

const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Kiểm trước khi ghi phiếu nhập — câu đầu tiên vướng (bấm được, nhảy tới ô) +
 * các cảnh báo không chặn (vượt trong ngưỡng 10%).
 */
export function kiemNhapDeNghi(
  head: DauPhieuNhap,
  rows: readonly DongNhapDeNghi[],
): KiemNhap {
  const canhBao: { dong: number; cau: string }[] = []
  const vuong: Extract<KiemNhap, { ok: false }>[] = []
  const chan = (
    focus: number | 'noi_mua',
    o: 'ma' | 'qty' | 'gia' | 'note' | null,
    message: string,
  ) => vuong.push({ ok: false, focus, o, message, canhBao })

  if (!head.noi_mua.trim()) chan('noi_mua', null, 'Chưa ghi nơi mua (tên tiệm / NCC)')
  if (!rows.some((r) => r.qty > EPS))
    chan(rows.length > 0 ? 0 : 'noi_mua', 'qty', 'Chưa dòng nào có số nhận lần này')
  rows.forEach((r, i) => {
    if (r.qty < 0) chan(i, 'qty', `Dòng ${i + 1} (${r.name}): số nhận không được âm`)
    if (!(r.qty > EPS)) return
    const ten = `Dòng ${i + 1} (${r.name})`
    if (!r.material_id)
      chan(i, 'ma', `${ten} chưa gắn mã → bấm "gắn mã" chọn mã có sẵn hoặc tạo mã mới`)
    if (r.unit_price == null) chan(i, 'gia', `${ten} chưa có đơn giá thật`)
    else if (r.unit_price < 0) chan(i, 'gia', `${ten}: đơn giá không được âm`)
    else if (r.unit_price === 0 && !r.note.trim())
      chan(i, 'note', `${ten} giá 0 → ghi chú vì sao (hàng được cho, hàng tặng…)`)
    const v = mucVuot(r.can, r.daNhap, r.qty)
    if (v > VUOT_TU_DO + EPS) {
      if (!r.note.trim())
        chan(
          i,
          'note',
          r.can <= EPS
            ? `${ten}: lãnh đạo duyệt 0 (không mua) → ghi lý do vẫn nhập`
            : `${ten} vượt số duyệt ${pct(v)} (quá ${pct(VUOT_TU_DO)}) → ghi lý do ở ô Ghi chú`,
        )
    } else if (v > EPS) canhBao.push({ dong: i, cau: `${ten} vượt số duyệt ${pct(v)}` })
  })
  return vuong[0] ?? { ok: true, canhBao }
}

/** Vết dán vào ghi chú dòng sổ khi nhập vượt số duyệt — để hậu kiểm thấy. */
export function vetVuot(can: number, daNhap: number, lanNay: number): string | null {
  const v = mucVuot(can, daNhap, lanNay)
  if (!(v > EPS)) return null
  return can <= EPS ? '[Duyệt 0 vẫn nhập]' : `[Vượt ${pct(v)} số duyệt]`
}

/** Tổng tiền phiếu nhập (VND, chưa VAT) — dòng chưa có giá không cộng. */
export function tienNhap(
  rows: readonly Pick<DongNhapDeNghi, 'qty' | 'unit_price'>[],
): number {
  let t = 0
  for (const r of rows) if (r.qty > 0 && r.unit_price != null) t += r.qty * r.unit_price
  return Math.round(t)
}
