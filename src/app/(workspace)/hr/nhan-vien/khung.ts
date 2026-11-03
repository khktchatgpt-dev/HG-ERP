'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Chốt chiều cao gốc màn = 100dvh − đỉnh màn (như khung khu Kho): chỉ vùng giữa cuộn, đầu trang /
 * tab / thanh đáy đứng yên, đầu cột và chân bảng dính được. Dùng chung danh sách + hồ sơ.
 */
export function useCaoKhung() {
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 48px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  return { ref: goc, style: { height: cao } } as const
}
