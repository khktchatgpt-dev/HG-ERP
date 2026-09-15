import { canReschedule } from '@/lib/po-reschedule'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'

/**
 * HÀNH ĐỘNG THEO BƯỚC — chép Action Pane của Dynamics 365: bày ĐỦ hành động của
 * bước hiện tại, nút không dùng được thì KHOÁ kèm lý do, không giấu.
 *
 * Xem `docs/mua-hang-phieu-mua.md` §4.5. File thuần, có test: gọi nhầm route là
 * ghi nhầm vào sổ đơn thật mà giao diện trông vẫn bình thường.
 *
 * KHÔNG MỞ ĐƯỜNG GHI MỚI: mọi route ở đây là route màn chi tiết
 * `/planning/pos/[id]` đang gọi. Màn danh sách chỉ rút ngắn đường tới chúng.
 */

export type ApiCall = {
  path: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export type Perm = {
  /** Đúng người phụ trách, hoặc trưởng phòng / admin. */
  own: boolean
  approve: boolean
  /** Admin / trưởng phòng CƯ / người duyệt — đủ quyền hạ đơn về nháp. */
  privileged?: boolean
  /** Đơn đã có phiếu nhập kho: chặn cứng đường hạ về nháp. */
  hasReceipts?: boolean
}

export type ActionId =
  | 'submit'
  | 'withdraw'
  | 'reopen'
  | 'approve'
  | 'reject'
  | 'send'
  | 'reschedule'
  | 'nudge'
  | 'edit'
  | 'duplicate'
  | 'delete'
  | 'cancel'
  | 'edit_terms'
  | 'open'
  /** Tab Nhận hàng của màn chứng từ — định nghĩa tại màn, không qua actionsFor. */
  | 'confirm'
  | 'transit'
  | 'accept'
  | 'close_short'

export type Action = {
  id: ActionId
  label: string
  /** Nút CHÍNH của bước — mỗi bước đúng một. */
  primary?: boolean
  /** Có = bị khoá, và đây là lý do hiện trên `title`. */
  blocked?: string
  /** `direct` bấm là chạy · `sheet` hỏi thêm · `link` mở trang khác. */
  ui: 'direct' | 'sheet' | 'link'
  stakes: 'nhe' | 'vua' | 'nang'
  danger?: boolean
  href?: (id: string) => string
  needReason?: boolean
  needDate?: boolean
  reasonLabel?: string
  reasonHint?: string
  consequence?: string
  /**
   * Nhãn NÚT XÁC NHẬN trong sheet, khi nó phải ngắn hơn `label`.
   *
   * Hành động theo dòng đặt tên dòng vào `label` để tiêu đề sheet nói rõ đang
   * làm gì với dòng nào — nhưng nhét nguyên tên vật tư lên một cái nút đỏ thì
   * nút không còn đọc ra là hành động gì nữa.
   */
  confirmLabel?: string
  done?: string
  build?: (i: { id: string; reason: string; date: string }) => ApiCall[]
  /** Chạy được hàng loạt khi mọi dòng cùng bước. */
  bulk?: boolean
}

const OPEN: Action = { id: 'open', label: 'Mở đơn đầy đủ', ui: 'link', stakes: 'nhe', href: (id) => `/mua-hang/don/${id}` } // prettier-ignore
const EDIT = (blocked?: string): Action => ({ id: 'edit', label: 'Sửa đơn', ui: 'link', stakes: 'nhe', href: (id) => `/mua-hang/don/${id}?sua=1`, blocked }) // prettier-ignore
const DUP: Action = { id: 'duplicate', label: 'Nhân bản', ui: 'link', stakes: 'nhe', href: (id) => `/mua-hang/don/moi?tu=${id}` } // prettier-ignore

/**
 * HUỶ ĐƠN ĐÃ GỬI — hành động màn cũ CÓ (`PoDetailScreen.tsx:711`) mà màn mới
 * KHÔNG CÓ NÚT nào, dù route `cancel` đã sẵn sàng từ lâu.
 *
 * Đây không phải thiếu sót thẩm mỹ: `closeShort` từ chối đơn chưa nhận được gì
 * bằng câu *"NCC không giao gì nữa thì dùng Huỷ đơn"* — trỏ vào một cái nút
 * không tồn tại trong module mới. Người mua đọc xong không còn đường nào đi,
 * ngoài việc quay về `/planning`.
 *
 * `draft` vẫn bày nút nhưng KHOÁ, đúng lối Action Pane: nháp thì xoá hẳn
 * (`remove`), không huỷ — nhưng người dùng phải học được vị trí của nút, và nút
 * lúc có lúc không thì họ không học được.
 */
const CANCEL = (blocked?: string): Action => ({
  id: 'cancel',
  label: 'Huỷ đơn',
  ui: 'sheet',
  stakes: 'nang',
  danger: true,
  blocked,
  needReason: true,
  reasonLabel: 'Vì sao huỷ đơn',
  reasonHint: 'Đơn đã gửi đi nên không xoá được — huỷ và ghi lại lý do. Chỉ cần sửa nội dung thì rút về nháp, đừng huỷ.', // prettier-ignore
  consequence: 'Đơn đóng lại, phần chưa về thôi tính là "đang đặt" nên đề xuất mua sẽ giục mua lại chỗ khác. Không mở lại được — muốn mua tiếp thì nhân bản thành đơn mới.', // prettier-ignore
  done: 'Đã huỷ đơn',
  build: ({ id, reason }) => [
    { path: `/api/dept/supply/pos/${id}/cancel`, method: 'POST', body: { reason } },
  ],
})

/**
 * SỬA ĐIỀU KHOẢN — thao tác HẸP, mở cho đơn ĐÃ DUYỆT và đã gửi.
 *
 * Vì sao không mở lại "Sửa đơn": sau khi duyệt, giá và dòng hàng là cam kết với
 * Giám đốc và là bản NCC đang cầm. Nhưng CHỮ TRÊN PHIẾU thì sửa thật — NCC đổi
 * nơi giao, kế toán đòi ghi số hợp đồng, đổi người ký. Không có đường ghi lại
 * thì người mua phải chọn giữa để phiếu in sai hoặc huỷ đơn tạo lại.
 *
 * Service (`posService.updateTerms`) mở cho MỌI trạng thái trừ đã huỷ — kể cả
 * đã về đủ, vì ghi chú đối chiếu vẫn cần sửa. `ui: 'link'` chỉ để `start()` bắt
 * lấy: nó bật CHẾ ĐỘ sửa hẹp trên chính màn này, không gọi route nào ngay.
 */
const EDIT_TERMS = (blocked?: string): Action => ({
  id: 'edit_terms',
  label: 'Sửa điều khoản',
  ui: 'link',
  stakes: 'nhe',
  blocked,
})

/**
 * HẠ VỀ NHÁP ĐỂ SỬA — đường sửa sai DỮ LIỆU của đơn đã gửi.
 *
 * Khác `withdraw` ở chỗ dùng cho ai và khi nào: `withdraw` là người soạn tự rút
 * bản mình vừa gửi duyệt, còn cái này là trưởng phòng / Giám đốc mở lại một đơn
 * đã đi xa hơn, để sửa số nhập sai. Vì nó VÔ HIỆU HOÁ CHỮ KÝ DUYỆT nên bắt lý
 * do, và service chặn cứng khi đơn đã có phiếu nhập kho.
 *
 * Nút vẫn BÀY khi bị khoá, đúng lối Action Pane — nói rõ vướng gì thay vì biến
 * mất để người dùng đi tìm.
 */
const REOPEN = (blocked?: string): Action => ({
  id: 'reopen',
  label: 'Hạ về nháp để sửa',
  ui: 'sheet',
  stakes: 'nang',
  blocked,
  needReason: true,
  reasonLabel: 'Vì sao phải sửa lại đơn',
  reasonHint: 'Ghi rõ sai ở đâu — lý do được đóng dấu vào ghi chú đơn để người sau đọc lại hiểu.', // prettier-ignore
  consequence: 'Đơn quay về NHÁP và mất dấu duyệt: Giám đốc phải duyệt lại từ đầu. Chỉ dùng khi số trên đơn nhập sai, không dùng để đổi ý.', // prettier-ignore
  done: 'Đã hạ về nháp — sửa xong nhớ gửi duyệt lại',
  build: ({ id, reason }) => [
    { path: `/api/dept/supply/pos/${id}/reopen`, method: 'POST', body: { reason } },
  ],
})

const NOTE = (id: string, body: string): ApiCall => ({
  path: '/api/doc-notes',
  method: 'POST',
  body: { doc_type: 'po', doc_id: id, audience: 'internal', body },
})

/**
 * Bảng hành động của một đơn ở trạng thái `status`, với quyền `perm`.
 *
 * Trả về theo THỨ TỰ HIỆN: nút chính trước, rồi các nút phụ, nút nguy hiểm sau
 * cùng. Nút bị khoá vẫn có mặt — Dynamics làm vậy vì người dùng học vị trí nút;
 * nút lúc có lúc không thì họ không học được.
 */
export function actionsFor(status: PoStatus, perm: Perm): Action[] {
  const notOwn = perm.own ? undefined : 'Đơn này do người khác phụ trách'
  /*
    Hai hàng rào client BIẾT được thì nói ngay tại nút; hàng rào còn lại (trạng
    thái) do chính chỗ gọi quyết định bằng cách có bày nút hay không. Server vẫn
    kiểm đủ cả bốn — đây chỉ là để người dùng không bấm rồi mới biết.
  */
  const notReopen = !perm.privileged
    ? 'Chỉ Giám đốc hoặc trưởng phòng Cung ứng hạ đơn về nháp được'
    : perm.hasReceipts
      ? 'Đơn đã có phiếu nhập kho — sửa dòng sẽ làm phiếu nhập mồ côi'
      : notOwn

  switch (status) {
    case 'draft':
      return [
        {
          id: 'submit',
          label: 'Gửi Giám đốc duyệt',
          primary: true,
          ui: 'sheet',
          stakes: 'vua',
          blocked: notOwn,
          consequence: 'Gửi rồi thì không sửa được cho tới khi Giám đốc quyết, hoặc bạn rút về nháp. Đơn còn thiếu thông tin sẽ bị chặn và báo tên.', // prettier-ignore
          done: 'Đã gửi duyệt',
          bulk: true,
          build: ({ id }) => [
            { path: `/api/dept/supply/pos/${id}/submit`, method: 'POST' },
          ],
        },
        EDIT(notOwn),
        DUP,
        {
          id: 'delete',
          label: 'Xoá nháp',
          ui: 'sheet',
          stakes: 'nang',
          danger: true,
          blocked: notOwn,
          consequence: 'Xoá hẳn, không có thùng rác. Chỉ đơn nháp mới xoá được.',
          done: 'Đã xoá nháp',
          build: ({ id }) => [{ path: `/api/dept/supply/pos/${id}`, method: 'DELETE' }],
        },
        EDIT_TERMS('Đơn nháp thì bấm "Sửa đơn" — sửa được cả dòng hàng lẫn điều khoản'),
        CANCEL('Đơn nháp thì xoá hẳn, không cần huỷ'),
        OPEN,
      ]

    case 'pending_approval':
      return [
        {
          id: 'approve',
          label: 'Duyệt đơn',
          primary: true,
          ui: 'direct',
          stakes: 'vua',
          blocked: perm.approve ? undefined : 'Cần quyền duyệt đơn mua',
          done: 'Đã duyệt',
          bulk: true,
          build: ({ id }) => [
            { path: `/api/dept/supply/pos/${id}/decide`, method: 'POST', body: { decision: 'approve' } }, // prettier-ignore
          ],
        },
        /**
         * RÚT VỀ NHÁP — hành động màn cũ CÓ HÀM mà KHÔNG CÓ NÚT ở đâu
         * (`usePoActions.withdrawPo`, đo 10/09/2026). Người gửi nhầm phải nhờ
         * Giám đốc từ chối. Đây là lỗ hổng rẻ nhất để lấp.
         */
        {
          id: 'withdraw',
          label: 'Rút về nháp',
          ui: 'sheet',
          stakes: 'vua',
          blocked: notOwn,
          consequence:
            'Đơn rời bàn Giám đốc, về nháp để bạn sửa. Gửi lại thì xếp hàng từ đầu.',
          done: 'Đã rút về nháp',
          build: ({ id }) => [
            { path: `/api/dept/supply/pos/${id}/withdraw`, method: 'POST' },
          ],
        },
        {
          id: 'reject',
          label: 'Từ chối',
          ui: 'sheet',
          stakes: 'nang',
          danger: true,
          blocked: perm.approve ? undefined : 'Cần quyền duyệt đơn mua',
          needReason: true,
          reasonLabel: 'Lý do từ chối',
          reasonHint: 'Người soạn đọc câu này để sửa — nói rõ thiếu gì, sai gì.',
          consequence: 'Đơn về nháp kèm lý do. Người soạn nhận thông báo.',
          done: 'Đã từ chối',
          build: ({ id, reason }) => [
            { path: `/api/dept/supply/pos/${id}/decide`, method: 'POST', body: { decision: 'reject', reason } }, // prettier-ignore
          ],
        },
        EDIT_TERMS(notOwn),
        REOPEN(notReopen),
        CANCEL(notOwn),
        OPEN,
      ]

    case 'approved':
      return [
        {
          id: 'send',
          label: 'Gửi nhà cung cấp',
          primary: true,
          ui: 'direct',
          stakes: 'vua',
          blocked: notOwn,
          done: 'Đã gửi NCC',
          bulk: true,
          build: ({ id }) => [
            { path: `/api/dept/supply/pos/${id}/advance`, method: 'POST', body: { to: 'ordered' } }, // prettier-ignore
          ],
        },
        reschedule(status, notOwn),
        EDIT_TERMS(notOwn),
        REOPEN(notReopen),
        DUP,
        CANCEL(notOwn),
        OPEN,
      ]

    case 'ordered':
    case 'confirmed':
    case 'in_transit':
    case 'partial':
      return [
        { ...OPEN, primary: true, label: 'Mở đơn · ghi nhận nhận hàng ở Kho' },
        /**
         * GHI VIỆC ĐÃ GIỤC — cùng nhịp với hộp thư việc: gọi NCC xong thì để lại
         * vết trên đơn, kèm hẹn mới nếu NCC hứa. Không có vết thì mai người thứ
         * hai lại gọi lần nữa.
         */
        {
          id: 'nudge',
          label: 'Ghi việc đã giục',
          ui: 'sheet',
          stakes: 'vua',
          blocked: notOwn,
          needReason: true,
          reasonLabel: 'Nhà cung cấp nói gì',
          reasonHint: 'Lưu thành ghi chú nội bộ trên đơn. Có hẹn mới thì điền ngày để đơn rời nhóm quá hẹn.', // prettier-ignore
          done: 'Đã ghi việc giục',
          build: ({ id, reason, date }) => {
            const calls: ApiCall[] = [NOTE(id, `[Đã giục NCC] ${reason}`)]
            if (date)
              calls.push({ path: `/api/dept/supply/pos/${id}/reschedule`, method: 'POST', body: { expected_at: date, reason } }) // prettier-ignore
            return calls
          },
        },
        reschedule(status, notOwn),
        EDIT_TERMS(notOwn),
        REOPEN(notReopen),
        DUP,
        CANCEL(notOwn),
      ]

    case 'received':
      return [{ ...OPEN, primary: true }, EDIT_TERMS(notOwn), DUP]

    case 'cancelled':
      return [
        { ...OPEN, primary: true },
        { ...DUP, label: 'Tạo lại từ đơn này' },
      ]
  }
}

function reschedule(status: PoStatus, notOwn?: string): Action {
  const g = canReschedule(status)
  return {
    id: 'reschedule',
    label: 'Đổi hẹn giao',
    ui: 'sheet',
    stakes: 'vua',
    blocked: notOwn ?? (g.ok ? undefined : g.reason),
    needReason: true,
    needDate: true,
    reasonLabel: 'Vì sao đổi',
    reasonHint:
      'Ghi vào vết của đơn — sau này ai hỏi "ai dời, dời vì gì" còn có chỗ tra.',
    done: 'Đã đổi hẹn giao',
    build: ({ id, reason, date }) => [
      { path: `/api/dept/supply/pos/${id}/reschedule`, method: 'POST', body: { expected_at: date, reason } }, // prettier-ignore
    ],
  }
}

/**
 * Hành động hàng loạt cho một tập đơn — CHỈ khi mọi đơn cùng trạng thái và
 * đều có một hành động `bulk` không bị khoá. Khác bước thì trả lý do, không
 * trả nút: thanh hàng loạt phải nói thẳng vì sao không làm được.
 */
export function bulkActionFor(
  rows: { status: PoStatus; own: boolean }[],
  perm: { approve: boolean },
): { action: Action } | { reason: string } {
  if (rows.length === 0) return { reason: 'Chưa chọn đơn nào' }
  const statuses = new Set(rows.map((r) => r.status))
  if (statuses.size > 1) return { reason: 'Các đơn đang chọn không cùng một bước' }
  const status = rows[0].status
  const own = rows.every((r) => r.own)
  const a = actionsFor(status, { own, approve: perm.approve }).find((x) => x.bulk)
  /*
    NHÃN TIẾNG VIỆT, không phải mã trong DB. Trước 15/09/2026 câu này in thẳng
    `status` nên người dùng đọc ra 'Bước "received" không có việc làm hàng
    loạt' — một chữ tiếng Anh giữa màn toàn tiếng Việt, và là từ vựng của bảng
    dữ liệu chứ không phải của người mua.
  */
  if (!a)
    return {
      reason: `Bước "${PO_STATUS_LABEL[status] ?? status}" không có việc làm hàng loạt`,
    }
  if (a.blocked) return { reason: a.blocked }
  return { action: a }
}
