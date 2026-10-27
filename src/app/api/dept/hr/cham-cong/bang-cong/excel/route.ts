import { BadRequest, handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import {
  buildChiTietExcel,
  buildTongHopExcel,
} from '@/modules/dept/hr/cham-cong/bang-cong-excel'
import { kyThangSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { khoangKyService } from '@/modules/dept/hr/cham-cong/khoang-ky.service'
import { todayVn } from '@/lib/date-vn'
import { khoangNgayTenFile, tenFileXuat } from '@/lib/ten-file-xuat'

/**
 * Excel chấm công theo mẫu phần mềm cũ cho một nhóm của Bảng công:
 * `?thang=YYYY-MM&bp=<tổ | vp | all>&loai=chi-tiet|tong-hop`.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams
  const homNay = todayVn()
  const t = kyThangSchema.safeParse(
    sp.get('thang') ?? (await khoangKyService.thangCua(homNay)),
  )
  if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
  const bp = sp.get('bp')?.trim()
  if (!bp) throw BadRequest('Chọn tổ / bộ phận trước khi xuất')
  const loai = sp.get('loai')
  if (loai !== 'chi-tiet' && loai !== 'tong-hop')
    throw BadRequest('loai phải là chi-tiet hoặc tong-hop')
  const d = await gioCongService.duLieuXuat(user, t.data, homNay, bp)
  // "Chi tiết chấm công - Cả công ty - 26.09-25.10.2026.xlsx" (user 27/10/2026: tên file phải nói
  // rõ file gì, nhóm nào, kỳ nào — trước là "Cả công ty kỳ 10-2026.xlsx").
  return xlsxResponse(
    loai === 'chi-tiet' ? await buildChiTietExcel(d) : await buildTongHopExcel(d),
    tenFileXuat(
      loai === 'tong-hop' ? 'Tổng hợp chấm công' : 'Chi tiết chấm công',
      d.nhom,
      khoangNgayTenFile(d.tu, d.den),
    ),
  )
})
