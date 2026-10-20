import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPoPrintDraft } from '@/modules/dept/supply/po-print.service'
import type { PoPrintHeader, PoPrintLine } from '@/app/print/supply/PoPrintSheet'

/**
 * XEM TRƯỚC PHIẾU ĐẶT HÀNG TỪ BẢN ĐANG GÕ (10/10/2026 — "dùng 1 loại thôi, loại
 * trong chi tiết"). Nhận đầu đơn + dòng màn soạn đã dựng (`po-preview`), nạp phần
 * còn lại ĐÚNG như trang in chi tiết (`loadPoPrintDraft`) rồi trả props cho
 * `PoPrintSheet`. Không ghi gì — ai soạn được đơn thì xem trước được.
 */
const uuid = z.string().uuid()
const schema = z.object({
  po_id: uuid.nullable(),
  supplier_id: uuid.nullable(),
  lsx_id: uuid.nullable(),
  extra_lsx_ids: z.array(uuid).max(20),
  // Đầu đơn + dòng là bản HIỂN THỊ màn soạn đã dựng qua cùng deriveLine — chỉ để
  // vẽ phiếu, không đi vào DB, nên chỉ chặn hình dạng và cỡ.
  header: z
    .object({ supplier_name: z.string().max(300), created_at: z.string().max(40) })
    .passthrough(),
  lines: z.array(z.object({ id: z.string().max(80) }).passthrough()).max(1000),
  shipments: z
    .array(
      z.object({
        expected_date: z.string().max(20),
        lines: z
          .array(z.object({ line_index: z.number().int().min(0), qty: z.number() }))
          .max(1000),
      }),
    )
    .max(50),
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const body = await parseJson(req, schema)
  const d = await loadPoPrintDraft(user, {
    ...body,
    header: body.header as unknown as PoPrintHeader,
    lines: body.lines as unknown as PoPrintLine[],
  })
  return NextResponse.json(d)
})
