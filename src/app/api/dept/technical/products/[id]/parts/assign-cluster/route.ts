import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productPartsAssignClusterSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * "Gom thành cụm…" — chọn nhiều dòng rồi gán một lượt.
 * `cluster_name` = tạo cụm mới; `cluster_id: null` = đưa các dòng về RỜI.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productPartsAssignClusterSchema)
  return NextResponse.json(await productsService.assignCluster(user, id, input))
})
