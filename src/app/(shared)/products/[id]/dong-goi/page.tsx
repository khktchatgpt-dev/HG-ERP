import { redirect } from 'next/navigation'

/**
 * Tab "Đóng gói" ĐÃ GỘP vào tab Hồ sơ (user chốt 13/08/2026: "phần đóng gói nên
 * ở trang hồ sơ sản phẩm luôn, không nên tách riêng").
 *
 * Giữ route này làm cầu chuyển hướng thay vì xoá hẳn: link cũ nằm rải trong LSX
 * (chip "sửa ở hồ sơ SP" của màn soạn dòng), trong ghi chú và bookmark của mọi
 * người — 404 thì họ tưởng mất dữ liệu đóng gói. Cùng layout `[id]` nên vẫn qua
 * đúng gate đăng nhập trước khi chuyển.
 */
export default async function ProductPackingRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/products/${id}`)
}
