import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'
import { initUploadSchema } from '@/modules/core/files/files.schema'

const listQuerySchema = z.object({ product_id: z.string().uuid() })

/** List file theo parent — hiện hỗ trợ product (FR-ENG-03). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { product_id } = parseQuery(new URL(req.url), listQuerySchema)
  const files = await filesService.listForProduct(user, product_id)
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
