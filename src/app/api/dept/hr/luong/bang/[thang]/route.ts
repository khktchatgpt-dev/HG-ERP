import { NextResponse } from 'next/server'
import { BadRequest, handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bangLuongService } from '@/modules/dept/hr/luong/bang-luong.service'
import {
  bangLuongViecSchema,
  kyThangSchema,
} from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Chuyển tiếp + khoản theo kỳ + công người không chấm công của bảng lương (B5). */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ thang: string }> }) => {
    const user = await authService.requireUser()
    const t = kyThangSchema.safeParse((await ctx.params).thang)
    if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
    const thang = t.data
    const v = await parseJson(req, bangLuongViecSchema)
    switch (v.viec) {
      case 'tinh':
        return NextResponse.json(await bangLuongService.tinh(user, thang))
      case 'gui':
        await bangLuongService.gui(user, thang, v.ghiChu)
        break
      case 'rut':
        await bangLuongService.rut(user, thang)
        break
      case 'quyet':
        await bangLuongService.quyet(user, thang, v.dongY, v.lyDo)
        break
      case 'mo_lai':
        await bangLuongService.moLai(user, thang, v.lyDo)
        break
      case 'chi':
        await bangLuongService.chi(user, thang)
        break
      case 'them_khoan':
        return NextResponse.json({
          so: await bangLuongService.themKhoan(user, thang, v.ds),
        })
      case 'xoa_khoan':
        await bangLuongService.xoaKhoan(user, thang, v.id)
        break
      case 'nhap_cong':
        await bangLuongService.nhapCong(user, thang, {
          ma: v.ma,
          cong: v.cong,
          tcGio: v.tcGio,
          ghiChu: v.ghiChu,
        })
        break
    }
    return NextResponse.json({ ok: true })
  },
)
