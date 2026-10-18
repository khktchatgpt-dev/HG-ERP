import { NextResponse } from 'next/server'
import { BadRequest, handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hoSoLuongService } from '@/modules/dept/hr/luong/ho-so-luong.service'
import { luongViecSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

const rong = (s?: string) => (s === undefined ? undefined : s || null)

/** Chi tiết hồ sơ lương một người: `?nv=<employeeId>`. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const nv = new URL(req.url).searchParams.get('nv')
  if (!nv) throw BadRequest('Thiếu nhân viên')
  return NextResponse.json(await hoSoLuongService.chiTiet(user, nv))
})

/** Mọi thao tác ghi của Hồ sơ lương (B4). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, luongViecSchema)
  switch (v.viec) {
    case 'ban': {
      const {
        employeeId,
        tuKy,
        cachTra,
        donGia,
        luongThang,
        luongBh,
        coBh,
        npt,
        khauTru10,
        ghiChu,
        phuCap,
      } = v
      await hoSoLuongService.luuBan(user, employeeId, {
        tuKy,
        cachTra,
        donGia,
        luongThang,
        luongBh,
        coBh,
        npt,
        khauTru10,
        ghiChu,
        phuCap,
      })
      return NextResponse.json({ ok: true })
    }
    case 'rieng':
      await hoSoLuongService.luuRieng(user, v.employeeId, {
        cccd: rong(v.cccd),
        mst: rong(v.mst),
        nganHang: rong(v.nganHang),
        stk: rong(v.stk),
        ngayVao: rong(v.ngayVao),
      })
      return NextResponse.json({ ok: true })
    case 'hien':
      return NextResponse.json({
        gia: await hoSoLuongService.hien(user, v.employeeId, v.truong),
      })
    case 'don_gia_to':
      return NextResponse.json({ so: await hoSoLuongService.datDonGiaTo(user, v) })
    case 'nap_xem':
      return NextResponse.json(await hoSoLuongService.napXem(user, v.text))
    case 'nap_ghi':
      return NextResponse.json(await hoSoLuongService.napGhi(user, v.tuKy, v.dong))
    case 'phu_cap':
      await hoSoLuongService.luuLoaiPhuCap(user, v)
      return NextResponse.json({ ok: true })
  }
})
