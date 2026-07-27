import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productClusterCreateSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Danh sách CỤM của một sản phẩm (0097 — cột `Parts/ Bộ phận` của biểu mẫu BOM). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const clusters = await productsService.listClusters(user, id)
  return NextResponse.json({ clusters })
})

/** Tạo cụm. Tên đã tồn tại thì trả về đúng cụm đó — không đẻ cụm trùng tên. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productClusterCreateSchema)
  const cluster = await productsService.addCluster(user, id, input)
  return NextResponse.json({ cluster }, { status: 201 })
})
