/**
 * CHỌN VẬT TƯ ĐỂ XUẤT — luật thuần của ô "+ Thêm dòng" và hộp "Chọn nhiều từ
 * tồn kho" ở `/warehouse/xuat` (27/10/2026).
 *
 * Đo 27/10: 13.540 mã đang dùng, chỉ 240 mã còn tồn. Gợi ý cũ hỏi server trên
 * CẢ danh mục, xếp theo mã A→Z, lấy 20 dòng: gõ "thep hop" ra 225 mã mà 3 mã còn
 * hàng chìm phía sau (dòng 1 là mã cước vận chuyển). Server chặn xuất quá tồn
 * nên mã kho hết không xuất được — tập làm việc thật là mã CÒN TỒN. Màn nạp sẵn
 * tập đó một lần rồi lọc tại máy: gõ không gọi API, chọn không phải tra tồn.
 */

import { normalizeSearch, searchMatcher } from './search-text'
import type { VatTuChon } from './kho-phieu-xuat'

/** Mã còn tồn, nạp sẵn lúc mở màn — đủ để chọn mà không phải hỏi lại server. */
export type VatTuTon = VatTuChon & {
  /** Tồn dùng được — cùng số với cột "Tồn dùng được" của lưới phiếu. */
  qty_ok: number
  /** Kệ — thủ kho biết đi lấy ở đâu. */
  ke: string | null
  nhom: string | null
  /**
   * `search_text` của DB (mã + tên + quy cách + nhóm con, đã bỏ dấu) — lọc tại
   * máy trên cùng chữ server lọc. Thiếu nó, gõ "thep hop" trượt "Sắt hộp 15x35"
   * (nhóm con "Thép hộp vuông") mà server vẫn ra — hai nơi tìm hai kết quả.
   */
  tim?: string | null
}

/**
 * Thứ tự gợi ý: mã của LỆNH đang chọn → mã BẮT ĐẦU bằng chữ gõ (gõ "SAT03" là
 * muốn đúng dải mã đó) → theo mã. Không xếp theo số tồn: tồn to chưa chắc là
 * mã tổ đang xin.
 */
function hang(vt: VatTuTon, q0: string, cuaLenh: ReadonlySet<string>): number {
  const lenh = cuaLenh.has(vt.id) ? 0 : 2
  const dau = q0 && normalizeSearch(vt.code).startsWith(q0) ? 0 : 1
  return lenh + dau
}

function xep(ds: VatTuTon[], q: string, cuaLenh: ReadonlySet<string>): VatTuTon[] {
  const q0 = normalizeSearch(q).split(/\s+/)[0] ?? ''
  return ds
    .map((vt) => ({ vt, h: hang(vt, q0, cuaLenh) }))
    .sort((a, b) => a.h - b.h || a.vt.code.localeCompare(b.vt.code))
    .map((x) => x.vt)
}

/**
 * Gợi ý của ô "+ Thêm dòng": lọc KHÔNG DẤU, mọi từ phải có mặt (cùng luật ô tìm
 * server — `searchMatcher`), trên `search_text` + kệ. Chữ rỗng → rỗng (ô không bung
 * danh sách che lưới mỗi lần con trỏ quay về).
 */
export function goiYTon(
  ds: readonly VatTuTon[],
  q: string,
  cuaLenh: ReadonlySet<string> = new Set(),
  max = 50,
): VatTuTon[] {
  if (!q.trim()) return []
  const khop = searchMatcher(q)
  return xep(
    ds.filter((vt) => khop([vt.code, vt.name, vt.ke, vt.tim])),
    q,
    cuaLenh,
  ).slice(0, max)
}

/**
 * Tích / bỏ tích một mã ở ô gợi ý (Shift+Enter hoặc bấm ô vuông — 27/10/2026,
 * "vẫn gõ và thêm từng vật tư một"). Giữ THỨ TỰ TÍCH: đó là thứ tự dòng vào
 * phiếu. Tích qua nhiều lần gõ ("vit" tích 2, "bulong" tích 1) rồi một Enter.
 */
export function latTich(
  tich: ReadonlyMap<string, VatTuTon>,
  vt: VatTuTon,
): Map<string, VatTuTon> {
  const n = new Map(tich)
  if (n.has(vt.id)) n.delete(vt.id)
  else n.set(vt.id, vt)
  return n
}

/** Bộ lọc của hộp "Chọn nhiều từ tồn kho". */
export function locChonNhieu(
  ds: readonly VatTuTon[],
  f: { q: string; nhom: string; chiCuaLenh: boolean; cuaLenh: ReadonlySet<string> },
): VatTuTon[] {
  const khop = searchMatcher(f.q)
  return xep(
    ds.filter(
      (vt) =>
        (!f.nhom || vt.nhom === f.nhom) &&
        (!f.chiCuaLenh || f.cuaLenh.has(vt.id)) &&
        khop([vt.code, vt.name, vt.ke, vt.tim]),
    ),
    f.q,
    f.cuaLenh,
  )
}

/** Các nhóm có trong tập còn tồn, kèm số mã — ô "Nhóm" của hộp chọn nhiều. */
export function nhomCoTon(ds: readonly VatTuTon[]): { nhom: string; so: number }[] {
  const dem = new Map<string, number>()
  for (const vt of ds) {
    const k = vt.nhom ?? ''
    if (k) dem.set(k, (dem.get(k) ?? 0) + 1)
  }
  return [...dem]
    .map(([nhom, so]) => ({ nhom, so }))
    .sort((a, b) => a.nhom.localeCompare(b.nhom, 'vi'))
}

/**
 * Bộ nhớ đệm câu tìm server (đường lùi khi không mã còn tồn nào khớp): cùng chữ
 * gõ — sau khi bỏ dấu, gộp khoảng trắng — thì không hỏi lại. Giữ tối đa `tran`
 * câu gần nhất.
 */
export function taoDemTim<T>(tran = 50) {
  const dem = new Map<string, T>()
  const khoa = (q: string) => normalizeSearch(q).replace(/\s+/g, ' ')
  return {
    lay: (q: string) => dem.get(khoa(q)),
    dat: (q: string, v: T) => {
      const k = khoa(q)
      dem.delete(k)
      dem.set(k, v)
      if (dem.size > tran) dem.delete(dem.keys().next().value as string)
    },
  }
}
