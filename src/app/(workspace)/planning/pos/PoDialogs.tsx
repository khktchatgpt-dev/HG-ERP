'use client'

import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/erp/Spinner'
import type { PoRef } from './usePoActions'

/**
 * HAI HỘP THOẠI NHỎ CỦA ĐƠN ĐẶT: đổi hẹn giao và bàn giao người phụ trách.
 *
 * Cả danh sách (menu ⋯) lẫn trang chi tiết đều mở được chúng, nên chúng không
 * thuộc về màn nào cả. Trước khi tách, chúng nằm trong thân `PosManager` —
 * trang chi tiết mới sẽ phải chép sang, và hai bản chép thì lệch ngay lần sửa
 * đầu tiên (đúng vết xe của bảng nhãn trạng thái từng phải gom lại).
 *
 * Component chỉ giữ HÌNH; state ở phía gọi, lời gọi API ở `usePoActions`.
 */

/**
 * Hộp thoại THU LÝ DO — từ chối duyệt và huỷ đơn.
 *
 * Hai thao tác này trước đây dùng `window.prompt`. Lý do nhập vào không phải
 * thủ tục: nó vào lịch sử phê duyệt và vào thông báo gửi cho người soạn đơn,
 * nên phải nhập được đàng hoàng — nhiều dòng, có giới hạn ký tự, có nút huỷ.
 */
export type ReasonState = {
  po: PoRef
  kind: 'reject' | 'cancel'
  reason: string
}

const REASON_COPY = {
  reject: {
    title: 'Từ chối đơn',
    hint: 'Lý do sẽ hiện trong thông báo gửi người soạn và lưu vào lịch sử phê duyệt. Đơn quay về NHÁP để sửa rồi gửi lại.',
    placeholder: 'Giá cao hơn báo giá đã duyệt · sai nhà cung cấp · chưa cần gấp…',
    confirm: 'Từ chối đơn',
  },
  cancel: {
    title: 'Huỷ đơn',
    hint: 'Đơn đã gửi đi nên không xoá được — huỷ và ghi lại lý do. Nếu chỉ cần sửa nội dung thì rút về nháp, đừng huỷ.',
    placeholder: 'NCC báo hết hàng · đổi phương án vật tư · lệnh SX bị huỷ…',
    confirm: 'Huỷ đơn',
  },
} as const

export function ReasonDialog({
  state,
  onChange,
  onSubmit,
  busy,
}: {
  state: ReasonState | null
  onChange: (s: ReasonState | null) => void
  onSubmit: (s: ReasonState) => void
  busy: boolean
}) {
  const copy = state ? REASON_COPY[state.kind] : null
  return (
    <Modal
      open={!!state}
      onClose={() => onChange(null)}
      title={state && copy ? `${copy.title} — ${state.po.code}` : ''}
      maxWidth="sm:max-w-md"
    >
      {state && copy && (
        <div className="flex flex-col gap-3 text-sm">
          <p className={hint}>{copy.hint}</p>
          <label className="flex flex-col gap-1">
            <span className={label}>
              Lý do <span className="text-[var(--stop)]">*</span>
            </span>
            <textarea
              rows={3}
              maxLength={1000}
              autoFocus
              value={state.reason}
              onChange={(e) => onChange({ ...state, reason: e.target.value })}
              placeholder={copy.placeholder}
              className="w-full rounded-md border border-input px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onChange(null)}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
            >
              Quay lại
            </button>
            <button
              disabled={busy || !state.reason.trim()}
              onClick={() => onSubmit(state)}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--stop)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {copy.confirm}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export type RescheduleState = { po: PoRef; date: string; reason: string }
export type ReassignState = {
  po: PoRef & { assignee_name?: string | null; assigned_to?: string | null }
  toId: string
}

const field =
  'h-9 w-full rounded-md border border-input px-2 text-sm focus:border-ring focus:outline-none'
const label = 'font-medium text-foreground'
const hint =
  'rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground'

export function PoDialogs({
  rescheduling,
  onRescheduleChange,
  onRescheduleSubmit,
  reassigning,
  onReassignChange,
  onReassignSubmit,
  staff,
  busy,
  /** Hẹn giao hiện tại — danh sách có sẵn trong dòng, trang chi tiết truyền vào. */
  currentExpected,
}: {
  rescheduling: RescheduleState | null
  onRescheduleChange: (s: RescheduleState | null) => void
  onRescheduleSubmit: (s: RescheduleState) => void
  reassigning: ReassignState | null
  onReassignChange: (s: ReassignState | null) => void
  onReassignSubmit: (s: ReassignState) => void
  staff: { id: string; name: string }[]
  busy: boolean
  currentExpected?: string | null
}) {
  return (
    <>
      <Modal
        open={!!reassigning}
        onClose={() => onReassignChange(null)}
        title={reassigning ? `Bàn giao — ${reassigning.po.code}` : ''}
        maxWidth="sm:max-w-md"
      >
        {reassigning && (
          <div className="flex flex-col gap-3 text-sm">
            <p className={hint}>
              Người nhận sẽ <b>phụ trách</b> đơn này (sửa nháp, gửi duyệt, theo dõi giao
              hàng). Dùng khi người phụ trách cũ nghỉ phép / nghỉ việc. Việc bàn giao được
              ghi vào lịch sử phê duyệt.
            </p>
            <label className="flex flex-col gap-1">
              <span className={label}>Đang phụ trách</span>
              <span className="text-muted-foreground">
                {reassigning.po.assignee_name ?? 'chưa có'}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>
                Bàn giao cho <span className="text-[var(--stop)]">*</span>
              </span>
              <select
                value={reassigning.toId}
                onChange={(e) =>
                  onReassignChange({ ...reassigning, toId: e.target.value })
                }
                className={field}
              >
                <option value="">— Chọn nhân viên cung ứng —</option>
                {staff
                  .filter((s) => s.id !== reassigning.po.assigned_to)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onReassignChange(null)}
                className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
              >
                Huỷ
              </button>
              <button
                disabled={busy || !reassigning.toId}
                onClick={() => onReassignSubmit(reassigning)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Bàn giao
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rescheduling}
        onClose={() => onRescheduleChange(null)}
        title={rescheduling ? `Đổi hẹn giao — ${rescheduling.po.code}` : ''}
        maxWidth="sm:max-w-md"
      >
        {rescheduling && (
          <div className="flex flex-col gap-3 text-sm">
            <p className={hint}>
              Chỉ đổi <b>ngày giao</b>. Nhà cung cấp, dòng hàng và tiền giữ nguyên — đơn
              đã duyệt nên chữ ký của Giám đốc vẫn còn giá trị. Lý do được ghi vào ghi chú
              của đơn.
            </p>
            <label className="flex flex-col gap-1">
              <span className={label}>Hẹn giao hiện tại</span>
              <span className="text-muted-foreground">
                {currentExpected
                  ? new Date(currentExpected).toLocaleDateString('vi-VN')
                  : 'chưa hẹn'}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>
                Ngày giao mới <span className="text-[var(--stop)]">*</span>
              </span>
              <input
                type="date"
                value={rescheduling.date}
                onChange={(e) =>
                  onRescheduleChange({ ...rescheduling, date: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>
                Lý do <span className="text-[var(--stop)]">*</span>
              </span>
              <textarea
                rows={2}
                maxLength={1000}
                value={rescheduling.reason}
                onChange={(e) =>
                  onRescheduleChange({ ...rescheduling, reason: e.target.value })
                }
                placeholder="NCC báo trễ tàu · xưởng giục sớm · đổi lịch giao…"
                className="w-full rounded-md border border-input px-2 py-1.5 text-sm focus:border-ring focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => onRescheduleChange(null)}
                className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
              >
                Huỷ
              </button>
              <button
                disabled={busy || !rescheduling.date || !rescheduling.reason.trim()}
                onClick={() => onRescheduleSubmit(rescheduling)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Lưu hẹn giao mới
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
