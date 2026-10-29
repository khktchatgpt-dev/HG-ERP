import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docNotesService } from '@/modules/core/doc-notes/doc-notes.service'
import { loadDocRef } from '@/modules/core/doc-notes/doc-ref'
import { docNoteCreateSchema, DOC_TYPES, type DocType } from '@/lib/doc-notes'

/**
 * GHI CHÚ TRAO ĐỔI TRÊN CHỨNG TỪ — một endpoint cho MỌI loại.
 *
 * Không tách `/pos/[id]/notes`, `/lsx/[id]/notes`… : bốn bản sao của cùng một
 * việc thì bản thứ tư sẽ lệch. Loại chứng từ đi trong body.
 *
 * QUYỀN: ai mở được chứng từ thì nói được về chứng từ đó — không đẻ quyền
 * riêng. Tra chứng từ ở `loadDocRef` (dùng chung với yêu cầu việc, 0281); loại
 * chứng từ chưa nối kiểm quyền thì CHẶN, không mở sẵn cửa.
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
  // Chứng từ không tồn tại (hoặc loại chưa mở) thì 404, KHÔNG trả mảng rỗng:
  // mảng rỗng đọc thành "chưa ai ghi gì", còn sự thật là "không có tờ này".
  const doc = await loadDocRef(dt, docId)
  if (!doc) {
    return NextResponse.json({ error: 'Không thấy chứng từ' }, { status: 404 })
  }

  const notes = await docNotesService.list(user, dt, docId)
  return NextResponse.json({ notes })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, docNoteCreateSchema)
  const doc = await loadDocRef(input.doc_type, input.doc_id)
  if (!doc) {
    return NextResponse.json({ error: 'Không thấy chứng từ' }, { status: 404 })
  }

  const { note } = await docNotesService.create(user, input, doc.watchers)
  return NextResponse.json({ note })
})
