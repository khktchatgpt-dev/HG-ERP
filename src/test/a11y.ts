import axe from 'axe-core'

/**
 * KIỂM TRUY CẬP cho test giao diện — chạy `axe-core` trên một vùng DOM.
 *
 * Dùng thẳng `axe-core` (Deque bảo trì) thay cho gói bọc `vitest-axe`: gói bọc
 * đứng yên đã lâu, còn thứ nó làm chỉ là mấy dòng dưới đây. Ít một tầng phụ
 * thuộc là ít một thứ phải chờ người khác vá.
 *
 * HAI LUẬT TẮT CÓ CHỦ ĐÍCH — môi trường test không có bố cục thật:
 *
 * - `color-contrast`: cần màu đã tính + vị trí vẽ. `happy-dom` không dựng bố
 *   cục nên axe chỉ trả "không kết luận được", không bao giờ bắt được lỗi thật.
 *   Tương phản đo ở tầng TOKEN (một chỗ khai, mọi màn hưởng) và bằng trình
 *   duyệt thật — xem cách đo `--fill` trên `--track` ngày 23/09/2026.
 * - `region`: đòi mọi nội dung nằm trong landmark (`main`, `nav`…). Test dựng
 *   MỘT thành phần rời, không phải cả trang, nên luật này luôn kêu oan.
 *
 * Mọi luật khác chạy đủ: vai trò ARIA, nhãn, thuộc tính hợp lệ, tên gọi của
 * nút/liên kết, cấu trúc bảng…
 */
export async function a11yViolations(root: Element): Promise<axe.Result[]> {
  const res = await axe.run(root, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
    },
  })
  return res.violations
}

/**
 * Tóm vi phạm thành một chuỗi đọc được — để khi test đỏ, thông báo nói ngay
 * LUẬT nào hỏng ở PHẦN TỬ nào, thay vì một mảng object dài.
 */
export function formatViolations(v: axe.Result[]): string {
  return v
    .map(
      (x) =>
        `[${x.id}] ${x.help}\n` +
        x.nodes.map((n) => `    → ${n.html.slice(0, 120)}`).join('\n'),
    )
    .join('\n')
}
