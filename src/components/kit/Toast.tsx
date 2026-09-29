'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Toast as T } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Ico, type IcoName } from './Icon'

/**
 * THÔNG BÁO BAY (toast) — đứng trên Radix Toast. Thêm 24/09/2026 (B2,
 * docs/he-thiet-ke-erp-ke-hoach.md).
 *
 * VÌ SAO KIT PHẢI CÓ TOAST RIÊNG. Trước B2 kit không có toast, nên 16 màn dựng
 * bằng kit phải mượn `@/components/ui/Toast` của hệ cũ — tức buộc trộn hai hệ
 * trong một file, trái luật CLAUDE.md. Không phải lỗi của người viết màn: kit
 * thiếu thì họ không có đường nào khác.
 *
 * CÙNG API VỚI BẢN CŨ — `useToast()` trả `success / error / info / warning /
 * show`, cùng chữ ký `(title, description?)`. Chuyển một màn sang = đổi đúng
 * một dòng import, không đụng tới chỗ gọi nào.
 *
 * BA LỖI CỦA BẢN CŨ mà Radix giải sẵn:
 *  1. MỌI toast đều `role="alert"` — tức NGẮT LỜI người dùng trình đọc màn hình
 *     kể cả khi chỉ để báo "đã lưu". WCAG 4.1.3: tin trạng thái phải đọc
 *     NHẸ NHÀNG (polite). Ở đây chỉ LỖI và CẢNH BÁO được ngắt lời
 *     (`foreground`); thành công và tin thường thì đợi (`background`).
 *  2. Tự biến mất sau 4 giây và KHÔNG dừng lại khi rê chuột hay focus vào —
 *     người đọc chậm, hoặc đang đọc dở câu lỗi dài, là mất. Radix dừng đồng hồ
 *     khi rê chuột, khi focus vào, và khi cửa sổ mất tiêu điểm (WCAG 2.2.1).
 *  3. Bàn phím không với tới. Radix: phím F8 nhảy thẳng vào khay thông báo.
 *
 * Hệ cũ (70 file còn lại) vẫn dùng `ui/Toast` như cũ — không đụng tới. Hai
 * provider khác context nên không giẫm nhau.
 */

type Tone = 'info' | 'success' | 'error' | 'warning'

type Item = {
  id: number
  tone: Tone
  title: string
  description?: string
  ttl: number
}

export type ToastApi = {
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

const Ctx = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast (kit) phải nằm trong <ToastProvider> của kit')
  return ctx
}

/**
 * Bốn sắc thái lấy màu từ token VÒNG ĐỜI — cùng nghĩa thì cùng màu, dù nó hiện
 * ở nhãn trong bảng hay ở hộp bay lên góc màn.
 *
 * `info` dùng MỰC XÁM, không dùng `--act`: `--act` từ 16/09 chỉ còn nghĩa "bấm
 * được". Bản cũ tô tin thường bằng màu hành động — đúng lỗi "dải trạng thái
 * mượn --act" mà sổ thiết kế cấm.
 */
const TONE: Record<Tone, { spine: string; text: string; icon: IcoName }> = {
  info: { spine: 'var(--ink-3)', text: 'text-[var(--ink-2)]', icon: 'thongTin' },
  success: { spine: 'var(--done)', text: 'text-[var(--done)]', icon: 'xong' },
  warning: { spine: 'var(--warn)', text: 'text-[var(--warn)]', icon: 'canhBao' },
  error: { spine: 'var(--stop)', text: 'text-[var(--stop)]', icon: 'loi' },
}

let dem = 0

export function ToastProvider({
  children,
}: {
  /**
   * Cây được dùng `useToast()`. App đã gắn MỘT lần ở `Providers.tsx` — màn nghiệp
   * vụ chỉ gọi `useToast()`, không bọc thêm. Khay hiện góc dưới phải, nổi trên
   * cả hộp thoại.
   */
  children: ReactNode
}) {
  const [items, setItems] = useState<Item[]>([])

  const show = useCallback<ToastApi['show']>(
    ({ tone = 'info', title, description, ttl }) => {
      const id = ++dem
      // Lỗi đứng lâu hơn: câu lỗi thường dài hơn và người ta cần đọc hết để biết
      // phải làm gì tiếp. Giữ đúng mốc của bản cũ (6 giây / 4 giây).
      const t = ttl ?? (tone === 'error' ? 6000 : 4000)
      setItems((xs) => [...xs, { id, tone, title, description, ttl: t }])
    },
    [],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
      warning: (title, description) => show({ tone: 'warning', title, description }),
    }),
    [show],
  )

  const bo = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id))

  return (
    <Ctx.Provider value={api}>
      {/* `label` là tên của khay mà trình đọc màn hình đọc khi nhảy vào bằng F8. */}
      <T.Provider label="Thông báo" swipeDirection="right">
        {children}
        {items.map((it) => {
          const { spine, text, icon } = TONE[it.tone]
          return (
            <T.Root
              key={it.id}
              // Chỉ lỗi và cảnh báo được NGẮT LỜI trình đọc màn hình.
              type={
                it.tone === 'error' || it.tone === 'warning' ? 'foreground' : 'background'
              }
              duration={it.ttl}
              onOpenChange={(open) => {
                if (!open) bo(it.id)
              }}
              className={cn(
                // `pointer-events-auto`: khi một hộp modal đang mở, Radix đặt
                // `pointer-events: none` lên body — thiếu dòng này là nút đóng
                // toast chết trong lúc hộp mở.
                'pointer-events-auto flex overflow-hidden rounded-[var(--radius)]',
                'border border-[var(--line)] bg-[var(--surface-card)]',
                'shadow-[var(--shadow-drop)]',
              )}
            >
              {/* Vạch màu bên trái, không tô nền cả hộp: toast xếp chồng 3–4 cái
                  là thành đèn nháy, và chữ trên nền màu đặc hết đọc được. */}
              <span
                aria-hidden
                className="w-[3px] shrink-0"
                style={{ background: spine }}
              />
              <div className="flex flex-1 items-start gap-2.5 p-3">
                <span className={cn('mt-px shrink-0', text)}>
                  <Ico name={icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <T.Title className="leading-5 font-semibold text-[var(--ink)]">
                    {it.title}
                  </T.Title>
                  {it.description && (
                    <T.Description className="text-k-sm mt-0.5 leading-snug text-[var(--ink-2)]">
                      {it.description}
                    </T.Description>
                  )}
                </div>
                <T.Close
                  aria-label="Đóng thông báo"
                  className="-mt-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  ✕
                </T.Close>
              </div>
            </T.Root>
          )
        })}
        {/*
          Khay đặt ở layout GỐC — con của `<body>`, ngoài mọi `.kit`. Token kit
          chỉ khai trong `.kit` nên phải đeo lại; `contents` để lớp bọc không tạo
          hộp nào. Lớp gắn TĨNH trong mã (không dò DOM như bản cũ) nên HTML dựng
          ở server và ở client khớp nhau — bản cũ phải né lỗi lệch hydrate bằng
          cách gắn lớp trong effect.
        */}
        <div className="kit contents">
          {/*
            `label` của VIEWPORT là tên VÙNG khay — khác `label` của Provider (tên
            từng toast). Mặc định Radix là tiếng Anh "Notifications ({hotkey})",
            nên người dùng trình đọc màn hình nghe "Notifications F8". Test bắt
            được chỗ này lần chạy đầu (24/09/2026).
          */}
          <T.Viewport
            label="Thông báo ({hotkey})"
            className="k-toasts fixed right-4 z-[var(--z-toast)] m-0 flex w-80 max-w-[calc(100vw-2rem)] list-none flex-col gap-2 p-0 outline-none"
          />
        </div>
      </T.Provider>
    </Ctx.Provider>
  )
}
