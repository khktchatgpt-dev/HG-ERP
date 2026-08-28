import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { docTemplateUpdateSchema } from '@/modules/core/doc-templates/doc-templates.schema'

/**
 * Sửa MẪU CHỨNG TỪ của một loại phiếu (0164) — quy tắc đánh số + khuôn mẫu in.
 * Quyền gác trong service (`system.settings.manage`).
 *
 * `PUT` sửa, `DELETE` trả về mặc định gốc trong code.
 */
export const PUT = handle(
  async (req: Request, { params }: { params: Promise<{ kind: string }> }) => {
    const user = await authService.requireUser()
    const { kind } = await params
    const patch = await parseJson(req, docTemplateUpdateSchema)
    const saved = await docTemplatesService.update(user, kind, patch)
    return NextResponse.json(saved)
  },
)

export const DELETE = handle(
  async (_req: Request, { params }: { params: Promise<{ kind: string }> }) => {
    const user = await authService.requireUser()
    const { kind } = await params
    return NextResponse.json(await docTemplatesService.reset(user, kind))
  },
)
