import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docNotesService } from '@/modules/core/doc-notes/doc-notes.service'
import { DOC_TYPES } from '@/lib/doc-notes'

const schema = z.object({
  doc_type: z.enum(DOC_TYPES),
  doc_id: z.string().uuid(),
  muted: z.boolean(),
})

/**
 * Bật/tắt theo dõi chứng từ.
 *
 * Tách khỏi `/api/doc-notes` vì đây là thao tác trên NGƯỜI XEM, không phải
 * trên nội dung — gộp vào cùng route thì một cái POST hai nghĩa.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { doc_type, doc_id, muted } = await parseJson(req, schema)
  await docNotesService.setMuted(user, doc_type, doc_id, muted)
  return NextResponse.json({ ok: true })
})
