import type { DomainEvent, EventName, EventOf } from './types'

type Handler<N extends EventName> = (event: EventOf<N>) => void | Promise<void>

const handlers: { [N in EventName]?: Handler<N>[] } = {}

/**
 * In-process typed pub/sub.
 *
 * Ràng buộc:
 *   - Chỉ chạy trong 1 process. Nhiều instance Next.js → mỗi instance có bus riêng.
 *     Với ERP nhỏ (1 server) đủ dùng. Sau này scale → thay bằng Postgres LISTEN/NOTIFY
 *     hoặc queue (BullMQ, QStash) mà không cần đổi API `emit`.
 *   - Handler error bị catch + log, KHÔNG throw ra emitter. Notification lỗi
 *     không được làm rollback task creation.
 *   - `emit` await tất cả handler theo mặc định (đảm bảo audit + notif viết trước
 *     khi request trả về). Pass `{ fireAndForget: true }` nếu handler dài, chấp
 *     nhận không chắc chạy xong khi response về.
 */
export function on<N extends EventName>(name: N, handler: Handler<N>): () => void {
  const list = (handlers[name] ??= []) as Handler<N>[]
  list.push(handler)
  return () => {
    const idx = list.indexOf(handler)
    if (idx >= 0) list.splice(idx, 1)
  }
}

export async function emit<E extends DomainEvent>(
  event: E,
  opts: { fireAndForget?: boolean } = {},
): Promise<void> {
  const list = handlers[event.name] as Handler<E['name']>[] | undefined
  if (!list || list.length === 0) return

  const runOne = async (h: Handler<E['name']>) => {
    try {
      await h(event as unknown as EventOf<E['name']>)
    } catch (err) {
      console.error(`[event ${event.name}] handler failed:`, err)
    }
  }

  if (opts.fireAndForget) {
    // Fire, không await. Chú ý: nếu process kết thúc trước handler xong → mất.
    void Promise.all(list.map(runOne))
    return
  }

  await Promise.all(list.map(runOne))
}

/** Test-only: xoá mọi handler. Không dùng ở runtime. */
export function _resetForTests(): void {
  for (const k of Object.keys(handlers)) {
    delete handlers[k as EventName]
  }
}
