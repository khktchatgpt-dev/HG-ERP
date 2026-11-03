/** Khoá xem: người không có quyền hr.employee.private (Q5 lượt 2). Dùng ở tab Hợp đồng, Giấy tờ. */
export function KhoaRieng({ viec }: { viec: string }) {
  return (
    <div className="text-k-sm flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-5 text-[var(--ink-2)]">
      <span aria-hidden className="text-[18px]">
        🔒
      </span>
      <div>
        <b className="text-[var(--ink)]">{viec}</b>
        <br />
        Bạn vẫn xem được mã, họ tên, tổ, ca, chức danh. Cần thêm thì nhờ Phòng Nhân sự.
      </div>
    </div>
  )
}
