/**
 * GUARD CHO CÁC Ô NHẬP TAY NGUY HIỂM của form khai vật tư (13/08/2026).
 *
 * User: "một số thông tin quan trọng phải nhập tay — rất nguy hiểm". Nguyên
 * tắc sửa: KHÔNG khoá gõ tự do (ĐVT lạ "Lố"/"Thẻ" là nhãn thật của xưởng —
 * triết lý dự án), mà theo mẫu ô kg/m đang có: máy tính song song, HIỆN điều
 * máy hiểu, lệch thì chặn mềm hai nhịp. Toàn logic thuần, test được.
 */

import { parseInnerDims } from './dims'
import { cartonAreaM2, foamM3PerSheet } from './po-template'

const nod = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Chuẩn hoá GIỮ DẤU — dùng cho phép so "đã có trong danh mục chưa" của ĐVT.
 * Bỏ dấu ở bước này là "Câi" trùng khít "Cái" và typo lọt vĩnh viễn; dấu chỉ
 * được nhoè ở bước đo khoảng cách gợi ý.
 */
const canon = (s: string): string =>
  s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()

/** Số diện tích/khối hiện đủ số lẻ — toLocaleString mặc định cắt còn 3. */
const fmtNum = (n: number): string =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 6 })

/** Khoảng cách sửa (Levenshtein) — ĐVT ngắn nên bảng nhỏ, đủ nhanh. */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return d[m][n]
}

export type UnitWarning =
  /** Gần giống một nhãn chuẩn — nhiều khả năng gõ nhầm. */
  | { kind: 'suggest'; suggest: string }
  /** Không có trong danh mục nhãn — nhãn lạ thật thì xác nhận rồi dùng. */
  | { kind: 'unknown' }

/**
 * ĐVT gõ tay so với danh mục nhãn chuẩn. "Câi" → gợi ý "Cái"; "Lố" (không có
 * trong danh mục) → bắt xác nhận nhãn lạ. ĐVT sai là MỌI đơn sau đặt sai đơn
 * vị, nên đây là ô đáng chặn mềm nhất.
 */
export function unitWarning(unit: string, catalog: string[]): UnitWarning | null {
  const u = canon(unit)
  if (!u) return null
  // Danh mục chưa nạp (lỗi mạng) — đừng chặn khai vật tư vì một cảnh báo phụ.
  if (catalog.length === 0) return null
  const cats = catalog.map((c) => ({ raw: c, key: canon(c) }))
  if (cats.some((c) => c.key === u)) return null
  // Gợi ý đo trên chuỗi GIỮ DẤU: "câi"↔"cái" lệch 1 ký tự, "lố"↔"bộ" lệch 2.
  const near = cats.find((c) => editDistance(c.key, u) === 1)
  if (near) return { kind: 'suggest', suggest: near.raw }
  return { kind: 'unknown' }
}

export type SpecPreview =
  /** Máy đọc được — hiện lại điều máy hiểu để người gõ đối chiếu. */
  | { ok: true; text: string }
  /** Nhóm cần dạng chuẩn mà chuỗi không đọc được — cảnh báo kèm dạng mẫu. */
  | { ok: false; warn: string }

/**
 * PREVIEW SỐNG cho ô Quy cách của các nhóm mà chuỗi này NUÔI TIỀN: bao bì
 * (lọt lòng → m²/thùng), kính (D×R → m²/tấm), xốp (D×R×dày → m³/tấm). Gõ sai
 * dạng thì form đơn bóc trượt trong im lặng — preview làm lỗi lộ ngay lúc gõ.
 * Nhóm khác trả null: quy cách tự do, không đoán.
 */
export function specPreview(
  groupName: string | null | undefined,
  spec: string,
  openStyle: string,
): SpecPreview | null {
  const g = nod(groupName ?? '')
  const s = spec.trim()
  if (!s) return null

  if (g.includes('bao bi')) {
    const dims = parseInnerDims(s)
    if (!dims) {
      return {
        ok: false,
        warn: 'Không đọc được lọt lòng dạng D×R×C (vd "900x605x115") — form đơn sẽ KHÔNG tự tách kích thước và không tính được m²/thùng.',
      }
    }
    const m2 = cartonAreaM2(openStyle, dims[0], dims[1], dims[2])
    const m2Text =
      m2 != null
        ? ` · m²/thùng ≈ ${fmtNum(m2)}`
        : openStyle === 'ĐK'
          ? ' · cách mở ĐK: m² nhập tay ở dòng đơn'
          : ' · chọn cách mở AD/MR để tính m²'
    return {
      ok: true,
      text: `Máy hiểu: lọt lòng ${dims[0]}×${dims[1]}×${dims[2]} mm${m2Text}`,
    }
  }

  if (g.includes('go - kinh') || g.includes('kinh') || g.includes('nhua tam')) {
    const dims = parseInnerDims(s)
    if (!dims) {
      return {
        ok: false,
        warn: 'Không đọc được dạng D×R×dày (vd "605x539x5mm") — mẫu đơn kính sẽ không tự tính m²/tấm.',
      }
    }
    const m2 = Math.round(((dims[0] * dims[1]) / 1e6) * 10000) / 10000
    return {
      ok: true,
      text: `Máy hiểu: tấm ${dims[0]}×${dims[1]}, dày ${dims[2]} — m²/tấm ≈ ${fmtNum(m2)}`,
    }
  }

  if (g.includes('mut') || g.includes('xop')) {
    const dims = parseInnerDims(s)
    // Mút CUỘN ("8mm x 1.05m x 150m") cố ý không đọc được — không phải lỗi,
    // chỉ nhắc để người khai xốp TẤM biết vì sao không thấy m³.
    if (!dims) {
      return {
        ok: false,
        warn: 'Không đọc được dạng D×R×dày (vd "1520x920x10") — xốp TẤM sẽ không tự tính m³; mút cuộn thì bỏ qua nhắc này.',
      }
    }
    const m3 = foamM3PerSheet(dims[0], dims[1], dims[2])
    return {
      ok: true,
      text: `Máy hiểu: tấm ${dims[0]}×${dims[1]}, dày ${dims[2]} — m³/tấm ≈ ${fmtNum(m3 ?? 0)}`,
    }
  }

  return null
}

/**
 * Quy đổi đóng gói hiện SỐNG kèm ví dụ — "1 bì = 50" gõ thiếu số 0 sẽ hiện
 * "đặt 1.000 Con ≈ 20 bì" thay vì 2, số vô lý lộ ngay lúc gõ.
 */
export function packPreview(
  packUnit: string,
  packSize: string,
  unit: string,
): { text?: string; warn?: string } | null {
  const pu = packUnit.trim()
  const size = Number(packSize)
  if (!pu || !packSize.trim()) return null
  if (!(size > 0)) return { warn: 'Số lượng mỗi bao gói phải > 0.' }
  if (size === 1) {
    return {
      warn: `1 ${pu} = 1 ${unit.trim() || 'ĐVT'} — mua lẻ thì bỏ trống cặp ô này, đừng khai đóng gói 1:1.`,
    }
  }
  const vd = Math.ceil(1000 / size)
  return {
    text: `Máy hiểu: 1 ${pu} = ${size.toLocaleString('vi-VN')} ${unit.trim() || 'ĐVT'} — VD đặt 1.000 ${unit.trim() || 'ĐVT'} ≈ ${vd.toLocaleString('vi-VN')} ${pu}.`,
  }
}

/**
 * kg/ĐƠN-VỊ gõ tay so với (kg/m × dài cây) khi cả hai barem cùng có mặt —
 * lệch quá 5% thì gần như chắc một trong hai số sai (cùng ngưỡng ô kg/m).
 * Trả tỉ lệ lệch, null khi không đủ dữ liệu để so.
 */
export function kgUnitVsBar(
  kgPerUnit: string,
  kgPerM: string,
  barLengthM: string,
): number | null {
  const kgu = Number(kgPerUnit)
  const kgm = Number(kgPerM)
  const len = Number(barLengthM)
  if (!(kgu > 0) || !(kgm > 0) || !(len > 0)) return null
  const expect = kgm * len
  return Math.abs(kgu - expect) / expect
}

/**
 * Mã gõ tay lệch quy ước `XX-0000` / `XXX0000` — server vẫn tôn trọng mã người
 * gõ nên chỗ duy nhất chặn được là lúc đang gõ. Bỏ trống là an toàn nhất
 * (server tự cấp nối tiếp theo nhóm).
 */
export function codeWarning(code: string): string | null {
  const c = code.trim()
  if (!c) return null
  if (/^[A-Za-z]{2,4}-?\d{1,6}$/.test(c)) return null
  return `Mã "${c}" lệch quy ước (XX-0000 hoặc XXX0000) — bỏ trống để server tự cấp mã nối tiếp của nhóm là an toàn nhất.`
}

/**
 * Bóc QUY CÁCH từ TÊN khi ô Quy cách còn trống — "Nhôm hộp 20x40x1li" chứa sẵn
 * tiết diện, gõ lại lần hai chỉ tổ sai lệch với tên. Trả chuỗi đề xuất để form
 * hiện nút "điền từ tên", KHÔNG tự ghi.
 */
export function specFromName(name: string): string | null {
  const n = name.trim()
  if (!n) return null
  // Dạng phi/Ø trước (một chiều + độ dày), rồi dạng N×N(×N) kèm đơn vị tuỳ chọn.
  const phi = n.match(
    /(?:phi|fi|Ø)\s*\d[\d.,]*(?:\s*[x×*]\s*\d[\d.,]*\s*(?:li|ly|dem|dm|mm)?)?/i,
  )
  if (phi) return phi[0].replace(/\s+/g, ' ').trim()
  const dims = n.match(
    /\d[\d.,]*\s*[x×*]\s*\d[\d.,]*(?:\s*[x×*]\s*\d[\d.,]*)?\s*(?:li|ly|dem|dm|mm)?(?=\s|$|[,)])/i,
  )
  if (!dims) return null
  const out = dims[0].replace(/\s+/g, ' ').trim()
  // Tên CHỈ là quy cách thì thôi — điền sang là lặp nguyên tên.
  return nod(out) === nod(n) ? null : out
}
