import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'
import { initUploadSchema } from '@/modules/core/files/files.schema'

const PARENT_QUERY_KEYS = [
  'product_id',
  'quote_id',
  'sales_order_id',
  'production_order_id',
  'purchase_order_id',
] as const

const listQuerySchema = z
  .object({
    product_id: z.string().uuid().optional(),
    quote_id: z.string().uuid().optional(),
    sales_order_id: z.string().uuid().optional(),
    production_order_id: z.string().uuid().optional(),
    purchase_order_id: z.string().uuid().optional(),
  })
  .refine(
    (q) => PARENT_QUERY_KEYS.filter((k) => q[k]).length === 1,
    `Cần đúng 1 tham số parent (${PARENT_QUERY_KEYS.join('/')})`,
  )

/** List file gốc theo parent: product / báo giá / đơn hàng / LSX / PO. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), listQuerySchema)
  const column = PARENT_QUERY_KEYS.find((k) => q[k])!
  const files = await filesService.listForDocument(user, column, q[column]!)
  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
    })),
  })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, initUploadSchema)
  const result = await filesService.initUpload(user, input)
  return NextResponse.json(result, { status: 201 })
})
