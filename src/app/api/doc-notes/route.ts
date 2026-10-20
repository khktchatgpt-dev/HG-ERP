import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docNotesService } from '@/modules/core/doc-notes/doc-notes.service'
import { docNoteCreateSchema, DOC_TYPES, type DocType } from '@/lib/doc-notes'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'

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

/** Ai được nhắc khi có ghi chú mới — người đã đụng vào chứng từ. */
type Watchers = {
  created_by?: string | null
  assigned_to?: string | null
  approved_by?: string | null
}

/**
 * Tra chứng từ + lấy người theo dõi, theo LOẠI. Trả null = không có chứng từ.
 *
 * Mỗi loại mở thêm thì thêm MỘT nhánh ở đây. Loại chưa nối vẫn bị chặn (trả
 * null) chứ không mở sẵn cửa: `doc_id` đến từ người dùng, và ghi chú nội bộ
 * hay chứa chuyện không phải ai cũng được đọc.
 */
async function loadDoc(dt: DocType, id: string): Promise<{ watchers: Watchers } | null> {
  if (dt === 'po') {
    const po = await posRepo.findById(id)
    if (!po) return null
    return {
      watchers: {
        created_by: po.created_by,
        assigned_to: po.assigned_to,
        approved_by: po.approved_by,
      },
    }
  }
  if (dt === 'lsx') {
    const lsx = await productionRepo.findById(id)
    if (!lsx) return null
    // Lệnh SX không có `assigned_to`. Người PHÁT HÀNH lệnh (Bán hàng) đóng vai
    // đó: họ là người phải biết ngay khi xưởng nói gì về lệnh, vì họ đang cầm
    // lời hứa ngày giao với khách.
    return {
      watchers: {
        created_by: lsx.created_by,
        assigned_to: lsx.issued_by,
        approved_by: lsx.approved_by,
      },
    }
  }
  return null
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
  const doc = await loadDoc(dt, docId)
  if (!doc) {
    return NextResponse.json({ error: 'Không thấy chứng từ' }, { status: 404 })
  }

  const notes = await docNotesService.list(user, dt, docId)
  return NextResponse.json({ notes })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, docNoteCreateSchema)
  const doc = await loadDoc(input.doc_type, input.doc_id)
  if (!doc) {
    return NextResponse.json({ error: 'Không thấy chứng từ' }, { status: 404 })
  }

  const { note } = await docNotesService.create(user, input, doc.watchers)
  return NextResponse.json({ note })
})
