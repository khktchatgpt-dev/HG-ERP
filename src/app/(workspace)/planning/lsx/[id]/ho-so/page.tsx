import { LsxDetailScreen } from '../../../../production/lsx/[id]/LsxDetailScreen'

/**
 * HỒ SƠ LỆNH đầy đủ trong shell Cung ứng — bảng chi tiết sản phẩm, tiến độ,
 * panel vật tư. Trước 03/09/2026 nó nằm ở `/planning/lsx/[id]`; chỗ đó nay là
 * danh sách đơn mua của lệnh (câu người mua hỏi trước tiên), còn hồ sơ lùi về
 * một nhịp — vẫn đủ gần vì có nút "Hồ sơ lệnh" ngay đầu trang kia.
 */
export default async function PlanningLsxRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="planning" />
}
