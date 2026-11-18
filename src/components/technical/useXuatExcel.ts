'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'

/**
 * Nút "Xuất Excel" SP (`sp-excel/export`) — dùng ở Thư viện SP mới và `/products`.
 *
 * Cả thư viện kèm ảnh mất ~20 giây (đo 18/11/2026: 17–20 s cho 147 SP). Link trần
 * thì màn đứng im suốt lúc đó, người dùng tưởng không ăn và bấm lại (mỗi lần bấm
 * là một lượt tạo file). Nay: gọi `?json=1`, bày "Đang tạo file…", chặn bấm lại,
 * xong thì chuyển tới URL ký của file → trình duyệt tải về. Lỗi bày tại chỗ.
 */
export function useXuatExcel() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [xong, setXong] = useState<number | null>(null)

  async function xuat(href: string) {
    if (busy) return
    setBusy(true)
    setErr(null)
    setXong(null)
    try {
      const sep = href.includes('?') ? '&' : '?'
      const out = await api<{ url: string; count: number }>(`${href}${sep}json=1`)
      setXong(out.count)
      window.location.href = out.url
    } catch (e) {
      setErr(apiErrorText(e, 'Không tạo được file — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  return { busy, err, xong, xuat } as const
}
