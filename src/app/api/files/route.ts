import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery, TooManyRequests } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'
import { initUploadSchema } from '@/modules/core/files/files.schema'
import { usersRepo } from '@/modules/core/users/users.repo'
import { consumeRateLimit } from '@/server/rate-limit'

/**
 * 120 lượt khởi tạo upload / 10 phút cho mỗi người.
 *
 * Rộng rãi có chủ đích: nhập một đợt ảnh sản phẩm hàng chục file là chuyện
 * thường ngày của Kỹ thuật, chặn nhầm việc thật thì tệ hơn nhiều so với thứ
 * đang phòng — một tài khoản bị lộ mật khẩu bơm rác cho đầy kho.
 */
const UPLOAD_LIMIT = { limit: 120, windowMs: 10 * 60_000 }

const PARENT_QUERY_KEYS = [
  'product_id',
  'quote_id',
  'sales_order_id',
  'production_order_id',
  'purchase_order_id',
  'sample_id',
] as const

const listQuerySchema = z
  .object({
    product_id: z.string().uuid().optional(),
    quote_id: z.string().uuid().optional(),
    sales_order_id: z.string().uuid().optional(),
    production_order_id: z.string().uuid().optional(),
    purchase_order_id: z.string().uuid().optional(),
    sample_id: z.string().uuid().optional(),
  })
  .refine(
    (q) => PARENT_QUERY_KEYS.filter((k) => q[k]).length === 1,
    `Cần đúng 1 tham số parent (${PARENT_QUERY_KEYS.join('/')})`,
  )

/** List file gốc theo parent: product / báo giá / đơn hàng / LSX / PO / mẫu. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), listQuerySchema)
  const column = PARENT_QUERY_KEYS.find((k) => q[k])!
  const files = await filesService.listForDocument(user, column, q[column]!)

  // Tên NGƯỜI TẢI LÊN: hồ sơ tài liệu mà không nói được ai đưa file này vào thì
  // 6 tháng sau không ai dám xoá, cũng không biết hỏi ai khi file sai.
  const names = await usersRepo.displayNamesByIds(
    files.map((f) => f.owner_id).filter((x): x is string => !!x),
  )

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
      doc_type: f.doc_type,
      owner_name: f.owner_id ? (names.get(f.owner_id) ?? null) : null,
    })),
  })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()

  const rl = consumeRateLimit(`upload:${user.id}`, UPLOAD_LIMIT)
  if (!rl.ok) {
    throw TooManyRequests(
      `Tải lên quá nhiều file liên tiếp. Thử lại sau ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} phút.`,
    )
  }

  const input = await parseJson(req, initUploadSchema)
  const result = await filesService.initUpload(user, input)
  return NextResponse.json(result, { status: 201 })
})
