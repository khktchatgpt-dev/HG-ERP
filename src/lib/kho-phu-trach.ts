/**
 * NGƯỜI PHỤ TRÁCH NHÓM VẬT TƯ của Kho — logic thuần (bản vẽ
 * https://claude.ai/artifact/27qPqf6oxKKaU1XuAwy1in, duyệt 24/11/2026).
 *
 * Mỗi nhân viên Kho giữ một số nhóm vật tư; thủ kho gán MỘT LẦN theo nhóm. Đơn,
 * phiếu, mã tự biết thuộc ai qua nhóm của dòng. Nhóm chưa gán thuộc THỦ KHO.
 * "Của tôi" chỉ là bộ lọc — không chặn ai làm thay (Q4).
 */

export type NguoiKho = {
  id: string
  name: string
  /** Thủ kho (vai manager trong phòng Kho) — giữ mọi nhóm chưa gán. */
  thu_kho: boolean
}

/** group_name → user_id. Nhóm vắng mặt = chưa gán. */
export type PhanCong = Readonly<Record<string, string>>

/** Thủ kho mặc định: người thủ kho đầu tiên; không có thì null (nhóm chưa gán không ai giữ). */
export function thuKhoCua(nguoi: readonly NguoiKho[]): string | null {
  return nguoi.find((n) => n.thu_kho)?.id ?? null
}

/** Người giữ một nhóm: người được gán, không có thì thủ kho. */
export function nguoiGiu(
  group: string | null | undefined,
  pc: PhanCong,
  thuKho: string | null,
): string | null {
  return (group && pc[group]) || thuKho
}

/** Người giữ một đơn / phiếu = hợp người giữ các nhóm trên dòng của nó (theo thứ tự gặp). */
export function nguoiCuaDon(
  groups: readonly (string | null)[],
  pc: PhanCong,
  thuKho: string | null,
): string[] {
  const out: string[] = []
  for (const g of groups) {
    const u = nguoiGiu(g, pc, thuKho)
    if (u && !out.includes(u)) out.push(u)
  }
  // Đơn không có dòng vật tư nào (chỉ dòng tự do) — vẫn thuộc thủ kho.
  if (out.length === 0 && thuKho) out.push(thuKho)
  return out
}

/** Chế độ lọc: 'toi' · 'tat_ca' · id một người cụ thể. */
export type CheDoGiu = string

/**
 * Mặc định khi mở màn (Q3): nhân viên Kho có ít nhất một đơn của mình → "Của tôi";
 * thủ kho, người ngoài Kho, hay người không có đơn nào → "Tất cả".
 */
export function cheDoMacDinh(
  me: string,
  nguoi: readonly NguoiKho[],
  giuCuaDon: readonly (readonly string[])[],
): CheDoGiu {
  const toi = nguoi.find((n) => n.id === me)
  if (!toi || toi.thu_kho) return 'tat_ca'
  return giuCuaDon.some((g) => g.includes(me)) ? 'toi' : 'tat_ca'
}

export function khopGiu(giu: readonly string[], cheDo: CheDoGiu, me: string): boolean {
  if (cheDo === 'tat_ca') return true
  return giu.includes(cheDo === 'toi' ? me : cheDo)
}

/** Thay đổi để lưu: nhóm đổi người (user_id) hoặc bỏ gán (null). */
export function thayDoi(
  cu: PhanCong,
  moi: PhanCong,
): { group_name: string; user_id: string | null }[] {
  const keys = [...new Set([...Object.keys(cu), ...Object.keys(moi)])].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )
  return keys
    .filter((k) => (cu[k] ?? null) !== (moi[k] ?? null))
    .map((k) => ({ group_name: k, user_id: moi[k] ?? null }))
}

/**
 * Nhóm vật tư "của tôi" dưới dạng bộ lọc (Tồn kho, đếm ô Hôm nay):
 *   · nhân viên Kho → `in` các nhóm được gán (rỗng = không mã nào);
 *   · thủ kho → mọi nhóm KHÔNG gán cho người khác (`notIn`), gồm cả mã chưa có nhóm;
 *   · người ngoài Kho → null (không có "của tôi").
 */
export function nhomCuaToi(
  me: string,
  nguoi: readonly NguoiKho[],
  pc: PhanCong,
): { in?: string[]; notIn?: string[] } | null {
  const toi = nguoi.find((n) => n.id === me)
  if (!toi) return null
  const g = Object.entries(pc)
  if (toi.thu_kho) return { notIn: g.filter(([, u]) => u !== me).map(([k]) => k) }
  return { in: g.filter(([, u]) => u === me).map(([k]) => k) }
}

/**
 * Mặc định "của tôi" cho màn theo MÃ / theo SỐ ĐẾM (Tồn kho, Hôm nay) — cùng tinh
 * thần Q3: nhân viên Kho (không phải thủ kho) đã được gán ít nhất một nhóm.
 */
export function macDinhCuaToi(me: string, nguoi: readonly NguoiKho[], pc: PhanCong): boolean {
  const toi = nguoi.find((n) => n.id === me)
  return !!toi && !toi.thu_kho && Object.values(pc).includes(me)
}

/**
 * GỢI Ý NGƯỜI ĐẾM khi mở đợt kiểm kê theo nhóm (bước 3): các nhóm đã chọn cùng MỘT
 * người giữ → gợi ý người đó; nhiều người → không gợi ý, chỉ nói ai giữ nhóm nào.
 * `giu` = người giữ HIỆU LỰC của từng nhóm (đã tính thủ kho cho nhóm chưa gán).
 */
export function goiYNguoiDem(
  chon: readonly string[],
  giu: Readonly<Record<string, string | null>>,
): { id: string | null; nguoi: string[] } {
  const nguoi: string[] = []
  for (const g of chon) {
    const u = giu[g]
    if (u && !nguoi.includes(u)) nguoi.push(u)
  }
  return { id: nguoi.length === 1 ? nguoi[0] : null, nguoi }
}

/**
 * Nhãn GỌN của nhóm vật tư cho ô lưới: phần trước " - " đầu tiên ("Vải - da - chỉ -
 * phụ liệu may" → "Vải"). Đủ để nhận ra loại hàng; tên đủ đặt ở tooltip.
 */
export function nhomGon(g: string): string {
  return g.split(' - ')[0].trim() || g
}
