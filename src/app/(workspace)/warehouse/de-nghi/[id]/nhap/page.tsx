import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { conPhaiNhap } from '@/lib/de-nghi-nhap'
import { todayVn } from '@/lib/date-vn'
import { NhapDeNghiScreen, type DongCho } from './NhapDeNghiScreen'

export const metadata = { title: 'Kho · Nhập hàng đã mua' }
export const dynamic = 'force-dynamic'

/**
 * KHO NHẬP HÀNG ĐÃ MUA theo phiếu đề nghị (0238 · Đ3, bản vẽ DN-3). Chỉ mở khi
 * phiếu đã duyệt / đang nhập và người xem ghi được sổ kho; còn lại quay về phiếu
 * (nút ở đó đã nói vì sao chưa nhập được).
 */
export default async function NhapDeNghiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [chiTiet, ncc, taxonomy, canCreateMa] = await Promise.all([
    deNghiService.get(user, id).catch(() => null),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    materialTaxonomy(),
    canAction(user, 'warehouse.material.create'),
  ])
  if (!chiTiet) notFound()
  const { phieu, canNhap } = chiTiet
  if (!canNhap || (phieu.status !== 'approved' && phieu.status !== 'ordering'))
    redirect(`/warehouse/de-nghi/${id}`)

  // Chỉ các dòng CÒN PHẢI NHẬP; dòng duyệt 0 (không mua) và dòng đã đủ thì thôi.
  const dong: DongCho[] = phieu.lines
    .filter((l) => conPhaiNhap(l.can, l.da_nhap) > 0)
    .map((l) => ({
      line_id: l.id,
      material_id: l.material_id,
      code: l.code,
      name: l.name,
      unit: l.unit,
      can: l.can,
      da_nhap: l.da_nhap,
      gia_du_kien: l.unit_price,
    }))

  return (
    <NhapDeNghiScreen
      phieu={{
        id: phieu.id,
        code: phieu.code,
        status: phieu.status,
        approved_by_name: phieu.approved_by_name,
      }}
      dong={dong}
      nccGoiY={[...new Set(ncc.rows.map((s) => s.name.trim()))]}
      nhomOptions={taxonomy.groups.map((g) => g.name)}
      canCreateMa={canCreateMa}
      today={todayVn()}
      nguoiMua={user.name ?? user.email}
    />
  )
}
