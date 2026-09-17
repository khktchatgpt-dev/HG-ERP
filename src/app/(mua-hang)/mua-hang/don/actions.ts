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
  /** Bàn giao đơn cho người khác — trưởng phòng CƯ / Giám đốc / admin. */
  reassign?: boolean
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
  | 'reassign'
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
  /** Độ dài lý do tối thiểu (mặc định 1) — khớp hàng rào zod ở server, chặn
   *  ngay ở nút thay vì để server dội lỗi về sau khi người dùng đã bấm. */
  minReason?: number
  needDate?: boolean
  /**
   * Hỏi CHỌN MỘT NGƯỜI trong sheet. Chỉ `reassign` dùng — và nó là hành động
   * duy nhất trên màn này không đổi trạng thái đơn mà đổi NGƯỜI GIỮ nó.
   */
  needPerson?: boolean
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
  build?: (i: {
    id: string
    reason: string
    date: string
    /** Chỉ hành động `needPerson` dùng tới. */
    personId?: string
  }) => ApiCall[]
  /** Chạy được hàng loạt. */
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
  /* Lý do đi vào ghi chú đơn và vào thông báo gửi Giám đốc — một dấu chấm cho
     qua cửa thì cả hai chỗ đó thành vô nghĩa. Ngưỡng khớp hàng rào zod ở server. */
  minReason: 5,
  reasonLabel: 'Vì sao phải sửa lại đơn',
  reasonHint: 'Ghi rõ sai ở đâu — lý do được đóng dấu vào ghi chú đơn để người sau đọc lại hiểu.', // prettier-ignore
  consequence: 'Đơn quay về NHÁP và mất dấu duyệt: Giám đốc phải duyệt lại từ đầu. Chỉ dùng khi số trên đơn nhập sai, không dùng để đổi ý.', // prettier-ignore
  done: 'Đã hạ về nháp — sửa xong nhớ gửi duyệt lại',
  build: ({ id, reason }) => [
    { path: `/api/dept/supply/pos/${id}/reopen`, method: 'POST', body: { reason } },
  ],
})

/**
 * XOÁ NHÁP — và ở mọi bước khác, một cái nút KHOÁ CHỈ ĐƯỜNG.
 *
 * Trước 17/09/2026 nút này chỉ tồn tại ở bước `draft`; các bước sau nó biến mất
 * hẳn. Chủ dự án tìm không ra: _"tôi chưa thấy tính năng xoá đơn khi tạo
 * nhầm"_ — mà tạo nhầm rồi lỡ bấm gửi duyệt thì đúng là bước `draft` đã qua.
 *
 * Đây là chính lối mòn tài liệu đã phê phán khi bày `CANCEL` ở đơn nháp: nút
 * lúc có lúc không thì người dùng không học được vị trí, và không ai đi tìm
 * thứ mình không biết là có. Nay nút luôn có mặt, và khi khoá thì lý do phải
 * CHỈ ĐƯỜNG ĐI TIẾP, không chỉ nói "không được".
 *
 * Luật đằng sau không đổi và không nên đổi: nháp chưa vào sổ nên xoá hẳn được;
 * từ lúc gửi duyệt trở đi tờ giấy đã qua tay người khác, nên chỉ rút về nháp
 * hoặc huỷ có lý do. Xoá một tờ đã vào sổ là làm sổ nói dối một cách trơn tru.
 */
const DELETE = (blocked?: string): Action => ({
  id: 'delete',
  label: 'Xoá nháp',
  ui: 'sheet',
  stakes: 'nang',
  danger: true,
  blocked,
  consequence: 'Xoá hẳn, không có thùng rác. Chỉ đơn nháp mới xoá được.',
  done: 'Đã xoá nháp',
  build: ({ id }) => [{ path: `/api/dept/supply/pos/${id}`, method: 'DELETE' }],
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
  const canReassign = perm.reassign
    ? undefined
    : 'Chỉ trưởng phòng Cung ứng hoặc Giám đốc bàn giao đơn được'
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
        DELETE(notOwn),
        EDIT_TERMS('Đơn nháp thì bấm "Sửa đơn" — sửa được cả dòng hàng lẫn điều khoản'),
        REASSIGN(canReassign),
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
          /*
            TÊN THEO VIỆC ĐÃ XẢY RA. Hành động này đưa đơn về NHÁP kèm lý do,
            giữ số phiếu và lịch sử, để người soạn sửa rồi gửi lại — mở đường
            đi tiếp, không đóng cửa. Gọi nó là "Từ chối" thì người duyệt ngần
            ngại bấm (nghe như đánh trượt cả đơn) còn người soạn tưởng phải làm
            lại từ đầu.

            `id` và giá trị gửi lên server vẫn là `reject` — đổi nhãn là việc
            của tầng nhìn, đổi mã đã ghi vào sổ thì không.
          */
          id: 'reject',
          label: 'Trả lại để sửa',
          ui: 'sheet',
          stakes: 'vua',
          blocked: perm.approve ? undefined : 'Cần quyền duyệt đơn mua',
          needReason: true,
          reasonLabel: 'Cần sửa gì',
          reasonHint: 'Người soạn đọc câu này để sửa — nói rõ thiếu gì, sai gì.',
          consequence:
            'Đơn về nháp kèm lý do, giữ nguyên số phiếu. Người soạn sửa rồi gửi duyệt lại.',
          done: 'Đã trả lại để sửa',
          build: ({ id, reason }) => [
            { path: `/api/dept/supply/pos/${id}/decide`, method: 'POST', body: { decision: 'reject', reason } }, // prettier-ignore
          ],
        },
        EDIT_TERMS(notOwn),
        REOPEN(notReopen),
        DELETE('Đơn đã gửi duyệt — bấm "Rút về nháp" trước, rồi mới xoá được'),
        REASSIGN(canReassign),
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
        DELETE('Đơn đã ra khỏi cửa — sổ phải giữ lại vết, dùng "Huỷ đơn" thay vì xoá'),
        REASSIGN(canReassign),
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
        DELETE('Đơn đã ra khỏi cửa — sổ phải giữ lại vết, dùng "Huỷ đơn" thay vì xoá'),
        REASSIGN(canReassign),
        CANCEL(notOwn),
      ]

    case 'received':
      return [
        { ...OPEN, primary: true },
        EDIT_TERMS(notOwn),
        DUP,
        DELETE('Đơn đã đóng sổ — không xoá được nữa'),
      ]

    case 'cancelled':
      return [
        { ...OPEN, primary: true },
        { ...DUP, label: 'Tạo lại từ đơn này' },
        DELETE('Đơn đã đóng sổ — không xoá được nữa'),
      ]
  }
}

/**
 * BÀN GIAO — đổi người phụ trách đơn.
 *
 * Có mặt ở MỌI bước còn sống, vì lý do dùng nó không liên quan tới bước: người
 * phụ trách nghỉ phép, nghỉ việc, hay chia lại việc trong phòng. Một phòng
 * nhiều người thì đây là thao tác hàng ngày, mà trước 16/09/2026 nó chỉ có ở
 * trang chi tiết — muốn chuyển 12 đơn là mở 12 trang.
 *
 * Chạy hàng loạt được, và là hành động hàng loạt DUY NHẤT không đòi mọi đơn
 * cùng bước: giao việc không phụ thuộc đơn đang ở đâu.
 */
const REASSIGN = (blocked?: string): Action => ({
  id: 'reassign',
  label: 'Bàn giao',
  ui: 'sheet',
  stakes: 'vua',
  blocked,
  needPerson: true,
  done: 'Đã bàn giao',
  consequence:
    'Người nhận sẽ phụ trách đơn: sửa nháp, gửi duyệt, theo dõi giao hàng. Việc bàn giao được ghi vào lịch sử.',
  bulk: true,
  build: ({ id, personId }) => [
    { path: `/api/dept/supply/pos/${id}/reassign`, method: 'POST', body: { user_id: personId } }, // prettier-ignore
  ],
})

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
    /* Dời hẹn HÀNG LOẠT: nhà cung cấp gọi báo lùi một tuần thì thường lùi cả
       mấy đơn đang chạy của họ, không phải một đơn. */
    bulk: true,
    build: ({ id, reason, date }) => [
      { path: `/api/dept/supply/pos/${id}/reschedule`, method: 'POST', body: { expected_at: date, reason } }, // prettier-ignore
    ],
  }
}

/**
 * MỌI hành động hàng loạt của một tập đơn, kèm lý do khoá của từng cái.
 *
 * Trước 16/09/2026 hàm này trả về ĐÚNG MỘT hành động, và chỉ trả khi mọi đơn
 * cùng một bước — chọn 5 đơn mà 3 nháp 2 đã duyệt thì thanh chỉ nói "các đơn
 * đang chọn không cùng một bước" rồi thôi. Người dùng không biết mình vừa mất
 * những gì, và không biết phải bỏ chọn đơn nào để làm được việc.
 *
 * Nay trả ĐỦ DANH SÁCH, mỗi cái tự nói vướng gì — đúng lối Action Pane của
 * Dynamics, nơi nút luôn có mặt và chỉ xám đi. Hai thay đổi đi kèm:
 *
 *  · **Bàn giao** áp cho mọi bước, nên nó là hành động hàng loạt duy nhất chạy
 *    được khi tập chọn lẫn lộn bước. Giao việc không phụ thuộc đơn đang ở đâu.
 *  · Lý do khoá ĐẾM ĐƯỢC: "3/5 đơn không ở bước Nháp" chỉ thẳng phải bỏ bao
 *    nhiêu dòng, thay vì một câu chung chung.
 */
export function bulkActionsFor(
  rows: { status: PoStatus; own: boolean }[],
  perm: { approve: boolean; reassign?: boolean },
): { action: Action; blocked?: string }[] {
  if (rows.length === 0) return []
  const own = rows.every((r) => r.own)
  const p = { own, approve: perm.approve, reassign: perm.reassign }

  /*
    Gom hành động bulk của MỌI bước đang có mặt trong tập chọn, giữ thứ tự xuất
    hiện và không trùng id. Một hành động chỉ chạy được nếu MỌI dòng đều có nó.
  */
  const seen = new Map<ActionId, Action>()
  const countBy = new Map<ActionId, number>()
  for (const r of rows) {
    for (const a of actionsFor(r.status, { ...p, own: r.own })) {
      if (!a.bulk) continue
      /*
        BI QUAN khi gộp: giữ bản CÓ lý do khoá. `own` khác nhau giữa các dòng
        nên cùng một hành động có thể mở ở dòng này và khoá ở dòng kia — giữ
        bản mở là bày một cái nút bấm vào sẽ hỏng ở giữa chừng.
      */
      const cu = seen.get(a.id)
      if (!cu || (!cu.blocked && a.blocked)) seen.set(a.id, a)
      countBy.set(a.id, (countBy.get(a.id) ?? 0) + 1)
    }
  }

  const steps = [...new Set(rows.map((r) => PO_STATUS_LABEL[r.status] ?? r.status))]
  return [...seen.values()].map((a) => {
    const n = countBy.get(a.id) ?? 0
    if (n < rows.length) {
      const thieu = rows.length - n
      return {
        action: a,
        blocked:
          steps.length > 1
            ? `${thieu}/${rows.length} đơn đang chọn không làm được việc này — tập đang lẫn ${steps.length} bước (${steps.join(' · ')})`
            : `${thieu}/${rows.length} đơn đang chọn không làm được việc này`,
      }
    }
    return { action: a, blocked: a.blocked }
  })
}
