import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productClusterUpdateSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string; clusterId: string }> }

/** Đổi tên cụm / khai SL cụm-trên-SP / đặt lộ trình công đoạn. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, clusterId } = await params
  const patch = await parseJson(req, productClusterUpdateSchema)
  const cluster = await productsService.updateCluster(user, id, clusterId, patch)
  return NextResponse.json({ cluster })
})

/** Xoá cụm — các dòng của nó về RỜI, KHÔNG dòng nào bị xoá theo. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, clusterId } = await params
  return NextResponse.json(await productsService.removeCluster(user, id, clusterId))
})
