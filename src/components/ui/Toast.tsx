'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { resolvePortalTheme } from '@/components/shadcn/portal-theme'

type Tone = 'info' | 'success' | 'error' | 'warning'

type Toast = {
  id: number
  tone: Tone
  title: string
  description?: string
  ttl: number
}

type Ctx = {
  show: (input: {
    tone?: Tone
    title: string
    description?: string
    ttl?: number
  }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastCtx = createContext<Ctx | null>(null)

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show: Ctx['show'] = useCallback(
    ({ tone = 'info', title, description, ttl = 4000 }) => {
      const id = ++counter
      setToasts((ts) => [...ts, { id, tone, title, description, ttl }])
    },
    [],
  )

  const api: Ctx = {
    show,
    success: (title, description) => show({ tone: 'success', title, description }),
    error: (title, description) => show({ tone: 'error', title, description, ttl: 6000 }),
    info: (title, description) => show({ tone: 'info', title, description }),
    warning: (title, description) => show({ tone: 'warning', title, description }),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Viewport
        toasts={toasts}
        dismiss={(id) => setToasts((ts) => ts.filter((t) => t.id !== id))}
      />
    </ToastCtx.Provider>
  )
}

function Viewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[]
  dismiss: (id: number) => void
}) {
  /*
   * BẪY GIỐNG PORTAL RADIX — khay toast do `ToastProvider` dựng ở layout GỐC,
   * nên nó là con trực tiếp của `<body>`, NGOÀI wrapper `.theme-v3` mà
   * `WorkspaceShell` đeo. Đo trên `/design-lab` ngày 04/09/2026: viền toast ra
   * `#e4e4e7` (zinc-200 của `:root`) thay vì `--border` `#e4e7ec`, chữ mô tả ra
   * `#52525b` thay vì `--muted-foreground` `#475467`. Vạch màu vòng đời thì
   * đúng — vì `--done`/`--stop` tình cờ cũng khai ở `:root` — nên lỗi này ẩn
   * kỹ: nhìn thoáng qua vẫn thấy "toast xanh, toast đỏ", chỉ sai mấy sắc xám.
   *
   * Gắn lớp bằng tay trong effect chứ không đưa vào `className` lúc render:
   * khay này có mặt trong cả HTML dựng ở server, mà ở đó `document` chưa tồn
   * tại nên dò luôn ra rỗng — lượt render đầu ở client phải khớp y hệt server,
   * trả lớp ngay là lệch hydrate và React bỏ qua (đo được: lớp không lên).
   * Effect chạy sau khi cây đã vào DOM nên `.theme-v3` chắc chắn có mặt. Đụng
   * thẳng `classList` để khỏi `setState` trong effect — React cũng không quản
   * lớp này nên không có gì để nó ghi đè.
   */
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const theme = resolvePortalTheme()
    if (theme) ref.current?.classList.add(theme)
  }, [])

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Thông báo"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

/**
 * Bốn tone lấy màu từ token vòng đời, cùng bộ với `Badge` và vạch `spine` của
 * bảng — cùng một nghĩa thì phải cùng một màu, dù nó hiện ở nhãn trong bảng hay
 * ở hộp bay lên góc màn hình.
 *
 * Trước 04/09 chỗ này gõ cứng `bg-green-500`/`bg-red-500`/`border-zinc-200` +
 * icon bằng KÝ TỰ (`✓ ✕ ⚠ ℹ`). Cổng ESLint không bắt được vì `components/ui/*`
 * nằm trong danh sách miễn trừ — miễn trừ đó dành cho nơi ĐỊNH NGHĨA chuẩn,
 * nên một tệp lệch theme nằm trong đó thì lệch im lặng mãi. Đây lại là thứ
 * người dùng thấy nhiều nhất: 86 tệp đang gọi `useToast`.
 *
 * Vạch màu 3px bên trái chứ không tô nền cả hộp: toast xếp chồng 3–4 cái là
 * thành đèn nháy, và chữ trên nền màu đặc hết đọc được.
 */
const TONE: Record<Tone, { spine: string; text: string; Icon: typeof Info }> = {
  info: { spine: 'var(--primary)', text: 'text-[var(--primary)]', Icon: Info },
  success: { spine: 'var(--done)', text: 'text-[var(--done)]', Icon: CheckCircle2 },
  warning: { spine: 'var(--warn)', text: 'text-[var(--warn)]', Icon: AlertTriangle },
  error: { spine: 'var(--stop)', text: 'text-[var(--stop)]', Icon: XCircle },
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, toast.ttl)
    return () => clearTimeout(id)
  }, [onClose, toast.ttl])

  const { spine, text, Icon } = TONE[toast.tone]

  return (
    <div
      role="alert"
      className="bg-card pointer-events-auto flex overflow-hidden rounded-xl border shadow-lg"
    >
      <span aria-hidden className="w-[3px] shrink-0" style={{ background: spine }} />
      <div className="flex flex-1 items-start gap-2.5 p-3">
        <Icon aria-hidden className={`mt-px size-4 shrink-0 ${text}`} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-5 font-medium">{toast.title}</div>
          {toast.description && (
            <div className="text-muted-foreground mt-0.5 text-xs leading-[17px]">
              {toast.description}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-0.5 -mr-1 rounded-md p-1 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
