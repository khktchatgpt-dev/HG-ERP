import { z } from 'zod'
import { ISSUE_KINDS } from '@/lib/po-tracking'

/** Ghi một sự cố giao hàng (0213). */
export const issueSchema = z.object({
  kind: z.enum(ISSUE_KINDS),
  po_line_id: z.string().uuid().nullable().optional(),
  qty: z.coerce.number().min(0).nullable().optional(),
  description: z.string().trim().min(5, 'Mô tả sự cố ít nhất 5 ký tự').max(1000),
})
export type IssueInput = z.infer<typeof issueSchema>

export const resolveIssueSchema = z.object({
  resolution: z.string().trim().min(5, 'Ghi cách xử lý ít nhất 5 ký tự').max(1000),
})
