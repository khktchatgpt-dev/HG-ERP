import { registerTaskNotificationHandlers } from './handlers/task.notifications'
import { registerQuoteNotificationHandlers } from './handlers/quote.notifications'

let registered = false

/**
 * Đăng ký toàn bộ handler. Gọi 1 lần khi app khởi động.
 * Idempotent — gọi nhiều lần không double-register.
 */
export function registerEventHandlers(): void {
  if (registered) return
  registered = true
  registerTaskNotificationHandlers()
  registerQuoteNotificationHandlers()
}

// Auto-register khi module import lần đầu — Next.js server sẽ chạy dòng này
// ở request đầu tiên tới bất cứ route nào import `emit` (qua bus.ts import path).
// Đủ đơn giản cho scope hiện tại. ERP lớn nên chuyển sang boot hook explicit.
registerEventHandlers()
