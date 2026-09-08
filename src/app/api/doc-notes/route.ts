import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docNotesService } from '@/modules/core/doc-notes/doc-notes.service'
import { docNoteCreateSchema, DOC_TYPES, type DocType } from '@/lib/doc-notes'
import { posRepo } from '@/modules/dept/supply/pos.repo'

/**
 * GHI CHÚ TRAO ĐỔI TRÊN CHỨNG TỪ — một endpoint cho MỌI loại.
 *
 * Không tách `/pos/[id]/notes`, `/lsx/[id]/notes`… : bốn bản sao của cùng một
 * việc thì bản thứ tư sẽ lệch. Loại chứng từ đi trong body.
 *
 * QUYỀN: ai mở được chứng từ thì nói được về chứng từ đó — không đẻ quyền
 * riêng. Với `po` thì kiểm bằng chính repo của nó; loại chứng từ chưa nối
 * kiểm quyền thì CHẶN, không mở sẵn cửa.
 */

function docType(v: string | null): DocType | null {
  return DOC_TYPES.includes(v as DocType) ? (v as DocType) : null
}

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const url = new URL(req.url)
  const dt = docType(url.searchParams.get('doc_type'))
  const docId = url.searchParams.get('doc_id')
  if (!dt || !docId) {
    return NextResponse.json({ error: 'Thiếu doc_type hoặc doc_id' }, { status: 400 })
  }
  if (dt !== 'po') {
    return NextResponse.json(
      { error: `Chưa mở ghi chú cho loại chứng từ "${dt}"` },
      { status: 400 },
    )
  }
  // Chứng từ không tồn tại thì 404, KHÔNG trả mảng rỗng: mảng rỗng nói "chưa
  // ai ghi gì", còn sự thật là "không có đơn này".
  const po = await posRepo.findById(docId)
  if (!po) return NextResponse.json({ error: 'Không thấy đơn' }, { status: 404 })

  const notes = await docNotesService.list(user, dt, docId)
  return NextResponse.json({ notes })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, docNoteCreateSchema)
  if (input.doc_type !== 'po') {
    return NextResponse.json(
      { error: `Chưa mở ghi chú cho loại chứng từ "${input.doc_type}"` },
      { status: 400 },
    )
  }
  const po = await posRepo.findById(input.doc_id)
  if (!po) return NextResponse.json({ error: 'Không thấy đơn' }, { status: 404 })

  const { note } = await docNotesService.create(user, input, {
    created_by: po.created_by,
    assigned_to: po.assigned_to,
    approved_by: po.approved_by,
  })
  return NextResponse.json({ note })
})
