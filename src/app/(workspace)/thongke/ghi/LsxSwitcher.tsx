'use client'

import { useRouter } from 'next/navigation'

/**
 * Ô ĐỔI LỆNH nhanh trên phiếu nhập — đổi là điều hướng ?lsx= (server render
 * lại phiếu), không cần quay về màn chọn.
 */
export function LsxSwitcher({
  options,
  current,
}: {
  options: { id: string; code: string; customer_name: string; open_count: number }[]
  current: string
}) {
  const router = useRouter()
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/thongke/ghi?lsx=${e.target.value}`)}
      className="border-input bg-card text-foreground t-data h-8 max-w-64 rounded-md border px-2 text-xs font-semibold"
      aria-label="Đổi lệnh sản xuất"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.code}
          {o.open_count > 0 ? ` · còn ${o.open_count} việc` : ' · đủ số'}
        </option>
      ))}
    </select>
  )
}
