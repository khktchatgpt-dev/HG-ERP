'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { NavSection } from '@/workspaces/workspaces.config'

const KEY = 'hg-nav-nhom-mo'

function docLuu(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return v && typeof v === 'object' ? (v as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/**
 * NHÓM MENU GẬP (`NavSection.gap`, Kho "cho người mới" 27/10/2026) — dùng chung
 * cho rail desktop và drawer mobile. Nhóm mở khi: không gập sẵn, HOẶC chứa
 * trang đang mở (người dùng phải thấy mình đang ở đâu), HOẶC người dùng đã bấm
 * mở — lựa chọn đó nhớ trong localStorage theo tên nhóm.
 */
export function useNhomGap() {
  const pathname = usePathname()
  const [luu, setLuu] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage sau hydrate, như DesktopSidebar
    setLuu(docLuu())
  }, [])

  const dangO = (s: NavSection) =>
    s.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
  const mo = (s: NavSection) => !s.gap || dangO(s) || !!luu[s.heading]
  const lat = (s: NavSection) =>
    setLuu((cu) => {
      const moi = { ...cu, [s.heading]: !cu[s.heading] }
      try {
        localStorage.setItem(KEY, JSON.stringify(moi))
      } catch {
        /* localStorage bị chặn — vẫn gập/mở trong phiên */
      }
      return moi
    })
  /** Tổng số đếm của nhóm — bày cạnh tên nhóm khi gập, để số không biến mất. */
  const tongSo = (s: NavSection) => s.items.reduce((t, i) => t + (i.badge ?? 0), 0)
  return { mo, lat, dangO, tongSo }
}
