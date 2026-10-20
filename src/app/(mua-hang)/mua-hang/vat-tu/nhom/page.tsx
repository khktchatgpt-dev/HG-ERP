import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { materialGroupsService } from '@/modules/dept/warehouse/material-groups.service'
import { PO_TEMPLATES, PO_TEMPLATE_META } from '@/lib/po-template'
import { NhomScreen } from './NhomScreen'

export const metadata = { title: 'Mua hàng · Nhóm vật tư' }
export const dynamic = 'force-dynamic'

/**
 * NHÓM VẬT TƯ — khu Mua hàng (29/09/2026, artboard 17b đã duyệt).
 *
 * Thay `/planning/materials/nhom` (đã xoá). Câu hỏi của trang: "danh mục đang
 * chia nhóm ra sao, chỗ nào trống, nhãn nào trùng?" — nên mỗi dòng là một nhóm
 * chính kèm số mã, số mã CHƯA có nhóm con (bấm là mở rổ chia nhóm đã lọc sẵn),
 * và các nhóm con kèm số mã; nhãn nghi trùng tô vàng, bấm để gộp.
 *
 * Mọi thao tác đi qua `material-groups` có sẵn (quyền `group_manage`). Đếm chỉ
 * mã ĐANG DÙNG — cùng nguồn `overview` với màn cũ.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [data, canEdit] = await Promise.all([
    materialGroupsService.overview(user),
    canAction(user, 'warehouse.material.group_manage'),
  ])
  return (
    <NhomScreen
      data={data}
      canEdit={canEdit}
      templates={PO_TEMPLATES.map((t) => ({
        value: t,
        label: PO_TEMPLATE_META[t].label,
      }))}
    />
  )
}
