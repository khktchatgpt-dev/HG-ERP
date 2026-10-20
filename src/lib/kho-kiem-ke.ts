/**
 * KIỂM KÊ — luật thuần cho danh sách đếm (Kho B7, bản vẽ duyệt 19/10/2026:
 * https://claude.ai/artifact/ACMarfdaHqyud9RrdYMyzX). Có test.
 *
 * Q1 — DANH SÁCH ĐẾM CỦA MỘT NHÓM = mã đang có tồn trên sổ + mã có phiếu trong
 * `NGAY_PHAT_SINH` ngày gần nhất. KHÔNG lấy cả nhóm danh mục: nhóm có 700–3.000
 * mã mà chỉ 25–57 mã còn hàng (đo 19/10), và KK-2026-0005 dừng ở 2/254 dòng là
 * đúng triệu chứng đó. Mã có phiếu gần đây mà sổ ghi 0 vẫn vào danh sách để
 * bắt loại lệch "sổ hết, kệ còn".
 *
 * Hộp mở đợt và hàm sinh dòng đếm dùng CHUNG hàm này — số trên hộp là đúng số
 * dòng phiếu đếm sẽ có (con số là một lời hứa).
 */

export const NGAY_PHAT_SINH = 180

/** Ngày bắt đầu cửa sổ phát sinh (ISO, giờ server) tính từ `now`. */
export function mocPhatSinh(now: Date = new Date()): string {
  return new Date(now.getTime() - NGAY_PHAT_SINH * 86_400_000).toISOString()
}

export type NhomDem = {
  group_name: string
  /** Mã còn tồn ≠ 0 trên sổ. */
  co_ton: number
  /** Mã sẽ vào phiếu đếm (có tồn ∪ có phiếu gần đây). */
  ids: string[]
}

/**
 * Gộp ba nguồn thành danh sách đếm theo nhóm. Chỉ mã ĐANG DÙNG (có trong
 * `nhomCua`) mới vào — mã đã ngừng dùng không ai đi đếm.
 *
 * @param nhomCua   id mã đang dùng → tên nhóm
 * @param coTon     id mã có tồn ≠ 0
 * @param phatSinh  id mã có phiếu trong cửa sổ
 * @param chiNhom   giới hạn vào các nhóm này (không truyền = mọi nhóm)
 */
export function danhSachDem(
  nhomCua: ReadonlyMap<string, string>,
  coTon: ReadonlySet<string>,
  phatSinh: ReadonlySet<string>,
  chiNhom?: readonly string[],
): NhomDem[] {
  const loc = chiNhom ? new Set(chiNhom) : null
  const theoNhom = new Map<string, { co_ton: number; ids: Set<string> }>()
  const them = (id: string, ton: boolean) => {
    const g = nhomCua.get(id)
    if (!g || (loc && !loc.has(g))) return
    const x = theoNhom.get(g) ?? { co_ton: 0, ids: new Set<string>() }
    if (ton) x.co_ton++
    x.ids.add(id)
    theoNhom.set(g, x)
  }
  // Có tồn trước để `co_ton` không bị đếm hai lần.
  for (const id of coTon) them(id, true)
  for (const id of phatSinh) if (!coTon.has(id)) them(id, false)
  return [...theoNhom]
    .map(([group_name, x]) => ({ group_name, co_ton: x.co_ton, ids: [...x.ids] }))
    .sort((a, b) => b.co_ton - a.co_ton || b.ids.length - a.ids.length || a.group_name.localeCompare(b.group_name, 'vi')) // prettier-ignore
}

/**
 * Lần kiểm gần nhất (đã duyệt) của từng nhóm — cột "Kiểm lần cuối" trong hộp
 * mở đợt. Đợt theo nhóm mới tính; đợt theo khu / danh sách không quy về nhóm.
 */
export function kiemCuoiTheoNhom(
  dot: readonly { scope_kind: string; scope_ref: Record<string, unknown>; approved_at: string | null }[], // prettier-ignore
): Map<string, string> {
  const out = new Map<string, string>()
  for (const d of dot) {
    if (d.scope_kind !== 'group' || !d.approved_at) continue
    const gs = (d.scope_ref.groups as string[] | undefined) ?? []
    for (const g of gs) {
      const cu = out.get(g)
      if (!cu || d.approved_at > cu) out.set(g, d.approved_at)
    }
  }
  return out
}

/**
 * Q2 — NGƯỜI ĐẾM KHÔNG TỰ DUYỆT. Trả lý do chặn (câu người dùng đọc), hoặc null
 * khi được duyệt. Dùng CHUNG cho server (chặn thật) và màn (nút khoá + nói lý do
 * tại chỗ), để hai nơi không nói hai luật.
 *
 * "Người đếm" = người được phân đếm HOẶC bất kỳ ai đã ghi một số đếm của đợt.
 * Quản trị viên cũng theo luật này: duyệt thay thì không được là người đếm.
 */
export function lyDoKhongTuDuyet(
  userId: string,
  dot: { assigned_to: string | null },
  demBoi: readonly (string | null)[],
): string | null {
  if (dot.assigned_to === userId) {
    return 'Bạn được phân đếm đợt này nên không tự duyệt. Nhờ Thủ kho hoặc quản trị viên duyệt.'
  }
  if (demBoi.includes(userId)) {
    return 'Bạn đã ghi số đếm trong đợt này nên không tự duyệt. Nhờ Thủ kho hoặc quản trị viên duyệt.'
  }
  return null
}
