import { BadRequest, handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import {
  buildChiTietExcel,
  buildTongHopExcel,
} from '@/modules/dept/hr/cham-cong/bang-cong-excel'
import { kyThangSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { todayVn } from '@/lib/date-vn'

/**
 * Excel chấm công theo mẫu phần mềm cũ cho một nhóm của Bảng công:
 * `?thang=YYYY-MM&bp=<tổ | vp | all>&loai=chi-tiet|tong-hop`.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams
  const homNay = todayVn()
  const t = kyThangSchema.safeParse(sp.get('thang') ?? thangCuaNgay(homNay))
  if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
  const bp = sp.get('bp')?.trim()
  if (!bp) throw BadRequest('Chọn tổ / bộ phận trước khi xuất')
  const loai = sp.get('loai')
  if (loai !== 'chi-tiet' && loai !== 'tong-hop')
    throw BadRequest('loai phải là chi-tiet hoặc tong-hop')
  const d = await gioCongService.duLieuXuat(user, t.data, homNay, bp)
  // Tên như thư mục phần mềm cũ: "Tổ Phôi … .xlsx" và "tổng hợp Tổ Phôi … .xlsx".
  const ky = `${t.data.slice(5)}-${t.data.slice(0, 4)}`
  const ten = `${loai === 'tong-hop' ? 'tổng hợp ' : ''}${d.nhom} kỳ ${ky}.xlsx`
  return xlsxResponse(
    loai === 'chi-tiet' ? await buildChiTietExcel(d) : await buildTongHopExcel(d),
    ten,
  )
})
