/**
 * Khoá so TÊN CỤM — không phân biệt hoa thường, gọn khoảng trắng (12/11/2026).
 *
 * Hồ sơ BN0228HG-AL từng có cả "Cụm tựa" lẫn "cụm tựa" (bảng cụm unique theo
 * chuỗi, phân biệt hoa thường): Nan tựa ×8 và Nan liên kết tựa ×3 rơi khỏi Cụm
 * tựa, màn Ghi sản lượng đếm cụm 3 chi tiết thay vì 5. Mọi chỗ so tên cụm — gom
 * dòng theo cụm, đếm chi tiết trong cụm, "gõ tên cụm đã có thì gán vào" ở hồ sơ
 * SP — đi qua hàm này. Thuần, client dùng được.
 */
export function khoaCum(name: string | null | undefined): string {
  return (name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
}
