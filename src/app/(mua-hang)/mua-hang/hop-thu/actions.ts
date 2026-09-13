import type { SupplyTodoKind } from '@/lib/supply-watch'

/**
 * MỘT LÀN — MỘT VIỆC. Bảng này là chỗ duy nhất nói mỗi nhóm việc thì bấm nút
 * chính sẽ gọi API nào.
 *
 * TÁCH KHỎI MÀN để test được: đây là chỗ dễ sai nhất của cả trang (gọi nhầm
 * route là ghi nhầm vào sổ đơn thật), mà lại là logic thuần — không cần dựng
 * giao diện mới kiểm được.
 *
 * KHÔNG MỞ ĐƯỜNG GHI MỚI. Mọi lời gọi ở đây đều là route mà màn chi tiết
 * `/planning/pos/[id]` đang dùng. Màn này chỉ rút ngắn đường đi tới chúng.
 */

export type ApiCall = {
  path: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export type BuildInput = {
  note: string
  newDate: string
  po: { id: string; expected_at: string | null }
}

export type ActionSpec = {
  /** Chữ trên nút. Thể MỆNH LỆNH, nói việc — không nói trạng thái đích. */
  label: string
  /** Chữ trong toast khi xong. */
  done: string
  /**
   * `direct` bấm là chạy · `sheet` mở phiếu khai thêm · `link` chỉ mở đơn ra.
   * `link` dành cho việc KHÔNG được làm tắt.
   */
  kindOfUi: 'direct' | 'sheet' | 'link'
  stakes: 'nhe' | 'vua' | 'nang'
  sheetHint?: string
  consequence?: string
  needNote?: boolean
  needDate?: boolean
  /** Ngày mặc định trong phiếu: bỏ trống hoặc lấy hôm nay. */
  dateDefault?: 'today' | 'empty'
  noteLabel?: string
  notePlaceholder?: string
  noteWhy?: string
  build: (i: BuildInput) => ApiCall[]
}

/** Ghi chú nội bộ trên đơn — đúng endpoint mà tab Trao đổi của màn chi tiết dùng. */
function noteCall(poId: string, body: string): ApiCall {
  return {
    path: '/api/doc-notes',
    method: 'POST',
    body: { doc_type: 'po', doc_id: poId, audience: 'internal', body },
  }
}

export const KIND_ACTION: Record<SupplyTodoKind, ActionSpec> = {
  /**
   * QUÁ HẸN GIAO — nhịp đóng vòng quan trọng nhất của cả màn.
   *
   * Không có API "giục nhà cung cấp", và cũng không nên có: giục là việc xảy
   * ra ngoài hệ thống, qua điện thoại. Thứ hệ thống cần là VẾT của cuộc gọi
   * đó. Nên nút này ghi một ghi chú lên đơn, và nếu NCC hứa ngày mới thì dời
   * hẹn giao luôn trong cùng một nhịp.
   *
   * Không có vết thì mai người thứ hai lại gọi lần nữa, và NCC nghe hai cuộc
   * cùng một nội dung — đúng chuyện đang xảy ra hôm nay.
   */
  overdue: {
    label: 'Ghi việc đã giục',
    done: 'Đã ghi việc giục',
    kindOfUi: 'sheet',
    stakes: 'vua',
    sheetHint: 'Gọi nhà cung cấp xong thì ghi lại ở đây — người sau đọc để khỏi gọi lại.',
    needNote: true,
    needDate: false,
    dateDefault: 'empty',
    noteLabel: 'Nhà cung cấp nói gì',
    notePlaceholder: 'VD: Gọi anh Trần B, báo thiếu vít 7 màu, hẹn giao 18/09.',
    noteWhy:
      'Lưu thành ghi chú nội bộ trên chính đơn này. Có hẹn ngày mới thì điền ô ngày phía trên để đơn rời khỏi nhóm quá hẹn.',
    build: ({ note, newDate, po }) => {
      const calls: ApiCall[] = [noteCall(po.id, `[Đã giục NCC] ${note}`)]
      if (newDate) {
        calls.push({
          path: `/api/dept/supply/pos/${po.id}/reschedule`,
          method: 'POST',
          body: { expected_at: newDate, reason: note },
        })
      }
      return calls
    },
  },

  /**
   * ĐÃ DUYỆT · CHƯA GỬI NCC — một cú bấm, không hỏi gì thêm.
   *
   * Giám đốc đã ký, việc còn lại chỉ là bấm cho đơn ra khỏi cửa. Đây cũng là
   * chỗ đơn nằm im lâu nhất theo số đo, nên phải là đường ngắn nhất trong màn.
   */
  unsent: {
    label: 'Gửi nhà cung cấp',
    done: 'Đã gửi NCC',
    kindOfUi: 'direct',
    stakes: 'vua',
    build: ({ po }) => [
      {
        path: `/api/dept/supply/pos/${po.id}/advance`,
        method: 'POST',
        body: { to: 'ordered' },
      },
    ],
  },

  /**
   * CHƯA CÓ HẸN GIAO — bắt ngày, và `reschedule` cũng bắt lý do.
   *
   * Lý do ở đây không phải thủ tục: đơn không hẹn ngày thì mọi cảnh báo trễ
   * đều bỏ qua nó, nên khi cuối cùng cũng có ngày thì phải nói được ngày đó
   * lấy từ đâu ra.
   */
  no_eta: {
    label: 'Chốt ngày giao',
    done: 'Đã chốt ngày giao',
    kindOfUi: 'sheet',
    stakes: 'vua',
    sheetHint: 'Ngày nhà cung cấp cam kết. Đơn sẽ vào lịch hàng về theo ngày này.',
    needNote: true,
    needDate: true,
    dateDefault: 'empty',
    noteLabel: 'Ngày này lấy ở đâu',
    notePlaceholder: 'VD: NCC xác nhận qua Zalo ngày 10/09.',
    noteWhy: 'Ghi vào vết của đơn, để sau này ai hỏi "ai hẹn ngày này" còn có chỗ tra.',
    build: ({ note, newDate, po }) => [
      {
        path: `/api/dept/supply/pos/${po.id}/reschedule`,
        method: 'POST',
        body: { expected_at: newDate, reason: note },
      },
    ],
  },

  /**
   * VỀ MỘT PHẦN — CỐ Ý chỉ mở đơn, không làm tắt.
   *
   * Việc thật ở đây là chốt phần thiếu, tức đóng sổ một khoản đã cam kết với
   * NCC. Muốn quyết đúng phải nhìn ma trận dòng × phiếu nhập, mà thứ đó không
   * nhét vừa một khay bên phải. Rút ngắn đường đi tới một quyết định sai là
   * làm hỏng, không phải làm nhanh.
   */
  partial: {
    label: 'Mở đơn để chốt phần thiếu',
    done: '',
    kindOfUi: 'link',
    stakes: 'nang',
    build: () => [],
  },

  /**
   * NHÁP CHƯA GỬI DUYỆT — bấm là gửi, server tự chặn nếu đơn còn thiếu.
   *
   * Không tự kiểm ở client: `posService.submit` đã có bảng kiểm riêng, và
   * chép luật kiểm sang màn này là nuôi hai bản sẽ lệch nhau. Đơn nào thiếu
   * thì lượt chạy dừng lại đúng ở đó và báo tên đơn.
   */
  draft: {
    label: 'Gửi Giám đốc duyệt',
    done: 'Đã gửi duyệt',
    kindOfUi: 'sheet',
    stakes: 'vua',
    sheetHint: 'Đơn còn thiếu thông tin sẽ bị chặn và báo tên ngay tại đây.',
    consequence:
      'Gửi rồi thì không sửa được nữa cho tới khi Giám đốc quyết, hoặc bạn rút đơn về nháp.',
    needNote: false,
    needDate: false,
    build: ({ po }) => [{ path: `/api/dept/supply/pos/${po.id}/submit`, method: 'POST' }],
  },
}
