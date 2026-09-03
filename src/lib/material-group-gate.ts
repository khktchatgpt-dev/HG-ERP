/**
 * CỔNG NHÓM CHÍNH VẬT TƯ — Đợt 4 của kế hoạch phân nhóm (03/09/2026).
 *
 * Nhóm chính là DANH SÁCH CHỐT (catalog_items.type = material_group): nó quyết
 * định phạm vi chặn trùng tên, mẫu đơn mua, và là trục lọc của mọi màn Cung
 * ứng. Form đã là dropdown, nhưng API tạo/sửa vật tư và các script nạp liệu vẫn
 * nhận `group_name` là chuỗi bất kỳ — một lần gõ "Sắt thép" thay vì "Sắt thép -
 * tôn - tấm" là danh mục lại đẻ nhóm thứ 22 mà không ai bấm "Thêm nhóm chính".
 *
 * Hàm thuần, không đụng DB: service truyền danh sách nhóm đang active vào.
 * Trả về câu lỗi (để ném BadRequest) hoặc null nếu hợp lệ. Bỏ trống nhóm vẫn
 * được phép — chặn cái SAI, không ép cái THIẾU (2 mã cũ vẫn chưa có nhóm).
 */
export function groupGateError(
  knownGroups: readonly string[],
  groupName: string | null | undefined,
): string | null {
  if (groupName == null) return null
  const name = groupName.trim()
  if (!name) return null
  if (knownGroups.includes(name)) return null
  // Gõ lệch hoa/thường hay thừa khoảng trắng thì chỉ ra nhóm đúng, đỡ đoán.
  const near = knownGroups.find(
    (g) => g.localeCompare(name, 'vi', { sensitivity: 'base' }) === 0,
  )
  return near
    ? `Nhóm "${name}" không có trong danh mục — ý bạn là "${near}"?`
    : `Nhóm "${name}" không có trong danh mục nhóm. Thêm ở Quản lý nhóm trước, rồi mới gán cho vật tư.`
}
