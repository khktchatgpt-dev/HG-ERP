import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cutPlanDocSchema } from '@/modules/dept/production/cut-plan.schema'
import {
  buildCutPlanExcel,
  cutPlanExcelFilename,
} from '@/modules/dept/production/cut-plan-excel'
import { planCut } from '@/lib/cut-plan/optimize'

/**
 * Xuất quy cắt dạng .xlsx. Nhận CẢ ĐỢT (tham số + dòng), tính lại sơ đồ ở server
 * rồi mới ghi file — file và màn hình đọc cùng một thuật toán, không nhận kết
 * quả client gửi lên.
 */
export const POST = handle(async (req: Request) => {
  await authService.requireUser()
  const doc = await parseJson(req, cutPlanDocSchema)
  const result = planCut(doc)
  const buf = await buildCutPlanExcel(doc, result)
  const filename = cutPlanExcelFilename(doc)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
