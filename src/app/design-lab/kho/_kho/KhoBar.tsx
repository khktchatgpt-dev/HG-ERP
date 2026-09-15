'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Thanh chuyển giữa MƯỜI HAI MÀN MẪU của phân hệ Kho.
 *
 * Đứng riêng với `LabBar` có chủ ý: `LabBar` là mục lục của SỔ (sáu khuôn +
 * thư viện), còn thanh này là mục lục của MỘT PHÂN HỆ dựng bằng sáu khuôn đó.
 *
 * THANH NÀY CHÍNH LÀ BẢN ĐỒ MODULE, không phải một danh sách link.
 * Bốn họ xếp theo ĐƯỜNG ĐI VẬT LÝ của hàng — VÀO → RA → TRONG KHO → NHÌN —
 * cộng họ NỀN bị đẩy ra sau cùng. Cả Odoo, SAP, Dynamics và NetSuite đều chia
 * đúng như vậy, và lý do rất tầm thường: nó trùng với cái thủ kho nhìn thấy
 * bằng mắt mỗi ngày, nên không phải học.
 *
 * NỀN tách hẳn sau một vạch: thủ kho gần như không bao giờ vào đó. Trộn danh
 * mục vào menu nghiệp vụ là bắt người làm việc 30 lần/ngày đi qua thứ họ dùng
 * một lần mỗi tháng.
 *
 * Nhãn mang kèm chữ cái khuôn (A–F) — đó là phần đáng xem nhất: cả một phân
 * hệ mười hai màn dựng bằng đúng sáu khuôn, không khuôn nào phải chế thêm.
 */
type Item = { href: string; label: string; khuon: string }
type Group = { label: string; items: Item[] }

const GROUPS: Group[] = [
  {
    label: 'Vào việc',
    items: [{ href: '/design-lab/kho', label: 'Bàn làm việc', khuon: 'A' }],
  },
  {
    label: 'Vào',
    items: [
      { href: '/design-lab/kho/hang-ve', label: 'Hàng về', khuon: 'B' },
      { href: '/design-lab/kho/phieu-nhap', label: 'Phiếu nhập', khuon: 'D' },
      { href: '/design-lab/kho/cat-hang', label: 'Chờ cất', khuon: 'F' },
    ],
  },
  {
    label: 'Ra',
    items: [{ href: '/design-lab/kho/cap-vat-tu', label: 'Cấp vật tư', khuon: 'B' }],
  },
  {
    label: 'Trong kho',
    items: [
      { href: '/design-lab/kho/hang-khoa', label: 'Hàng mắc', khuon: 'C' },
      { href: '/design-lab/kho/kiem-ke', label: 'Kiểm kê', khuon: 'D' },
      { href: '/design-lab/kho/phieu-moi', label: 'Soạn phiếu', khuon: 'F' },
    ],
  },
  {
    label: 'Nhìn',
    items: [
      { href: '/design-lab/kho/ton', label: 'Tồn kho', khuon: 'C' },
      { href: '/design-lab/kho/vat-tu', label: 'Hồ sơ vật tư', khuon: 'E' },
      { href: '/design-lab/kho/so-phieu', label: 'Sổ phiếu', khuon: 'C' },
    ],
  },
  {
    label: 'Nền',
    items: [{ href: '/design-lab/kho/ke', label: 'Sơ đồ kệ', khuon: 'C' }],
  },
]

export function KhoBar() {
  const path = usePathname()
  return (
    <nav
      className="flex min-h-[38px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[3px]"
      aria-label="Màn mẫu phân hệ Kho"
    >
      <span className="font-bold tracking-[.14em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
        Kho · 12 màn
      </span>
      {GROUPS.map((g, gi) => (
        <div key={g.label} className="flex flex-wrap items-center gap-0.5">
          {/* Vạch ngăn trước họ NỀN — nó không thuộc menu nghiệp vụ */}
          {gi === GROUPS.length - 1 && (
            <span className="mr-2 h-[16px] w-px bg-[var(--line)]" aria-hidden />
          )}
          <span className="mr-1 font-bold tracking-[.1em] text-[var(--fs-micro)] text-[var(--ink-3)] uppercase">
            {g.label}
          </span>
          {g.items.map((it) => {
            const on = path === it.href
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? 'page' : undefined}
                className={
                  on
                    ? 'inline-flex h-[24px] items-center gap-1.5 rounded-[var(--radius)] bg-[var(--act-wash)] px-2.5 font-semibold text-[var(--act-text)] text-[var(--fs-sm)]'
                    : 'inline-flex h-[24px] items-center gap-1.5 rounded-[var(--radius)] px-2.5 text-[var(--fs-sm)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                }
              >
                <span className="num font-bold text-[var(--fs-micro)] opacity-60">
                  {it.khuon}
                </span>
                {it.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
