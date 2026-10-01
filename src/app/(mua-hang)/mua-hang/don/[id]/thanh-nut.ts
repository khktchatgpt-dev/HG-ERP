/**
 * THANH HÀNH ĐỘNG MỘT HÀNG của màn đơn mua (duyệt 26/09/2026, canvas "Đơn mua —
 * gọn thanh nút & Trao đổi").
 *
 * Bản trước là 3 tab (Đơn hàng 16 nút · Nhận hàng 11 nút · Tài chính khoá vĩnh
 * viễn), cao 150px: nút hiếm (Nhân bản, Bàn giao, Hạ về nháp) nằm ngang nút
 * hằng ngày, và việc kế tiếp của đơn nằm ở TAB KHÁC với trục trạng thái. Nay:
 *
 *   [nút chính = việc kế tiếp của BƯỚC]  [≤ 3 việc hay làm ở bước đó]  [⋯ Thêm]
 *
 * "⋯ Thêm" chứa MỌI việc còn lại, gom nhóm cố định, Huỷ/Xoá đứng riêng cuối.
 * Hàm thuần: chỉ quyết CHỖ ĐẶT (khoá nào lên thanh, khoá nào vào menu); màn
 * ánh xạ khoá → nhãn, icon, hành động và lý do khoá.
 */

/** `doc:<id>` = việc từ `actionsFor` (actions.ts); còn lại là việc của màn. */
export type BarKey =
  | `doc:${string}`
  | 'edit'
  | 'confirm'
  | 'addShipment'
  | 'transit'
  | 'receive'
  | 'closeShort'
  | 'acceptByHand'
  | 'cost'
  | 'print'
  | 'excel'
  | 'new'
  | 'dense'

export type BarGroup = 'Giao & nhận' | 'Đơn' | 'In & hiển thị' | 'Huỷ'

export type BarLayout = {
  primary: BarKey | null
  quick: BarKey[]
  more: { key: BarKey; group: BarGroup }[]
}

const SENT = ['ordered', 'confirmed', 'in_transit', 'partial']
// Bước còn việc giao nhận. Đơn về đủ thì KHÔNG: mọi việc nhận đều khoá, và câu
// lý do của `receiveActions` viết cho đơn chưa gửi ("chỉ ghi được sau khi đã gửi
// đơn") — bày ra trên đơn đã về đủ là nói sai.
const RECEIVING = ['approved', ...SENT]
const DANGER = ['cancel', 'delete']

/**
 * @param status  trạng thái đơn
 * @param docIds  id các việc `actionsFor` trả cho bước này (kể cả edit/adjust)
 */
export function barLayout(status: string, docIds: readonly string[]): BarLayout {
  const has = (id: string) => docIds.includes(id)
  const doc = (id: string): BarKey | null => (has(id) ? `doc:${id}` : null)
  // 'edit' = sửa nháp. 'adjust' (dòng hàng của đơn đã gửi) KHÔNG còn là nút riêng:
  // từ B3 (28/09/2026) nó nằm trong "Sửa" (doc:edit_terms).
  const canEdit = has('edit')

  const primary: BarKey | null =
    status === 'draft'
      ? doc('submit')
      : status === 'pending_approval'
        ? doc('approve')
        : status === 'approved'
          ? doc('send')
          : // Đơn đã gửi NCC: bước kế là "Xử lý giao nhận" — mở hộp Giao nhận
            // trên Theo dõi đơn hàng (01/10/2026: trang đơn chỉ còn XEM giao nhận).
            SENT.includes(status)
            ? 'receive'
            : null

  /*
    "SỬA" (doc:edit_terms) đứng ĐẦU thanh trên mọi đơn đã ra khỏi nháp (28/09/2026,
    artboard 14): một nút cho hẹn giao, điều khoản, số HĐ, ghi chú, đợt giao và —
    từ B3 — cả dòng hàng theo luật điều chỉnh. Trước đó bốn cửa sửa rải trong "⋯".
  */
  const quickWanted: (BarKey | null)[] =
    status === 'draft'
      ? [canEdit ? 'edit' : null, 'print']
      : status === 'pending_approval'
        ? [doc('withdraw'), doc('reject'), 'print']
        : status === 'approved'
          ? [doc('edit_terms'), 'print']
          : status === 'ordered'
            ? [doc('edit_terms'), doc('nudge'), 'print']
            : SENT.includes(status)
              ? [doc('edit_terms'), 'cost', 'print']
              : status === 'received'
                ? [doc('edit_terms'), 'cost', 'print']
                : ['print']
  const quick = quickWanted.filter((k): k is BarKey => !!k && k !== primary).slice(0, 3)

  const shown = new Set<BarKey>([...(primary ? [primary] : []), ...quick])
  const more: BarLayout['more'] = []
  const add = (key: BarKey | null, group: BarGroup) => {
    if (key && !shown.has(key) && !more.some((m) => m.key === key))
      more.push({ key, group })
  }

  if (RECEIVING.includes(status)) {
    /*
      GHI GIAO NHẬN RỜI TRANG ĐƠN (01/10/2026, chủ dự án duyệt bản vẽ H2): NCC
      xác nhận, thêm đợt, đang giao, nhận hàng, chốt thiếu, nghiệm thu… làm ở
      hộp Giao nhận trên Theo dõi đơn hàng — nút chính "Xử lý giao nhận" dẫn
      sang đó. Ở đây còn đúng việc ghi PHÍ (không phải số liệu giao nhận).
    */
    add('cost', 'Giao & nhận')
    // "Đổi hẹn giao" KHÔNG còn là mục riêng: hẹn giao sửa trong "Sửa" (28/09/2026).
  }
  if (canEdit) add('edit', 'Đơn')
  for (const id of docIds) {
    // 'open' là lối vào CHÍNH đơn này (dùng ở danh sách) — trên màn đơn nó là
    // nút tự trỏ về mình.
    if (['open', 'edit', 'adjust', 'reschedule', ...DANGER].includes(id)) continue
    add(`doc:${id}`, 'Đơn')
  }
  add('new', 'Đơn')
  add('print', 'In & hiển thị')
  add('excel', 'In & hiển thị')
  add('dense', 'In & hiển thị')
  // Xoá chỉ có nghĩa với NHÁP (đơn đã ra khỏi cửa thì huỷ, không xoá); Huỷ chỉ
  // có nghĩa khi đơn đã ra khỏi nháp. Mục không bao giờ làm được ở bước này là
  // rác, không phải "mục khoá có lý do".
  add(status === 'draft' ? doc('delete') : doc('cancel'), 'Huỷ')

  return { primary, quick, more }
}

/* ══════════════════════════════════════════════════════════════════════
   CHIA THANH NÚT CHO ĐẦU TRANG MỚI (27/09/2026, canvas "Đơn mua", trang "Đầu
   trang sắp xếp lại" — chủ dự án duyệt theo khuyến nghị).

   Việc CHUYỂN TRẠNG THÁI rời thanh nút, về thanh trạng thái (`DocStatus`):
   bước kế tiếp là nút chính của thanh đó, các chuyển khác vào menu "Chuyển
   trạng thái" theo nhóm Đi tiếp / Quay lại / Dừng. Việc KHÔNG đổi trạng thái
   (sửa, ghi phí, in, nhân bản…) ở lại cạnh mã đơn + "⋯".
   ══════════════════════════════════════════════════════════════════════ */
export type MoveGroup = 'Đi tiếp' | 'Quay lại' | 'Dừng'

const MOVES: Partial<Record<BarKey, MoveGroup>> = {
  'doc:submit': 'Đi tiếp',
  'doc:approve': 'Đi tiếp',
  'doc:send': 'Đi tiếp',
  confirm: 'Đi tiếp',
  transit: 'Đi tiếp',
  receive: 'Đi tiếp',
  closeShort: 'Đi tiếp',
  acceptByHand: 'Đi tiếp',
  'doc:withdraw': 'Quay lại',
  'doc:reject': 'Quay lại',
  'doc:reopen': 'Quay lại',
  'doc:cancel': 'Dừng',
  'doc:delete': 'Dừng',
}
const MOVE_ORDER: MoveGroup[] = ['Đi tiếp', 'Quay lại', 'Dừng']

export type StatusBarSplit = {
  /** Bước kế tiếp — nút chính của thanh trạng thái. */
  next: BarKey | null
  /** Các chuyển trạng thái còn lại, đã xếp Đi tiếp → Quay lại → Dừng. */
  moves: { key: BarKey; group: MoveGroup }[]
  /** Việc hay làm đứng cạnh mã đơn (không đổi trạng thái). */
  actions: BarKey[]
  /** Phần còn lại cho menu "⋯", giữ nhóm cũ. */
  menu: { key: BarKey; group: BarGroup }[]
}

export function splitForStatusBar(l: BarLayout): StatusBarSplit {
  const isMove = (k: BarKey) => MOVES[k] != null
  const moves = [...l.quick, ...l.more.map((m) => m.key)]
    .filter((k) => isMove(k) && k !== l.primary)
    .map((key) => ({ key, group: MOVES[key]! }))
    .sort((a, b) => MOVE_ORDER.indexOf(a.group) - MOVE_ORDER.indexOf(b.group))
  return {
    next: l.primary && isMove(l.primary) ? l.primary : null,
    moves,
    actions: [
      ...(l.primary && !isMove(l.primary) ? [l.primary] : []),
      ...l.quick.filter((k) => !isMove(k)),
    ],
    menu: l.more.filter((m) => !isMove(m.key)),
  }
}
