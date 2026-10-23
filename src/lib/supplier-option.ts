/**
 * MỘT LỰA CHỌN NCC cho ô chọn (Combobox lọc tại chỗ theo `label` + `hint`).
 *
 * Nhãn gọn `mã · tên ngắn`, nhưng ô tìm phải hiểu cả TÊN ĐẦY ĐỦ: 41/207 NCC có tên
 * ngắn khác hẳn tên thật ("ATP · HP" là Hồng Phát, "HGHN · HG HN" là nhôm Hoàng
 * Gia). Trước 22/10/2026 tên đầy đủ không nằm trong nhãn → gõ "Hồng Phát" ở ô
 * "NCC mặc định" khi thêm vật tư ra rỗng, người dùng tưởng NCC chưa có.
 */
export function supplierOption(s: {
  id: string
  code: string | null
  name: string
  short_name: string | null
}): { value: string; label: string; hint?: string } {
  const ngan = s.short_name?.trim() || s.name
  const label = s.code ? `${s.code} · ${ngan}` : s.name
  return ngan !== s.name && s.code
    ? { value: s.id, label, hint: s.name }
    : { value: s.id, label }
}
