'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, PackageSearch, Truck } from 'lucide-react'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import type { MeetingRiskLevel } from '@/lib/supply-meeting'

/**
 * Bốn ô KPI của Tổng quan Cung ứng — client component vì `StatTile` là client
 * và nhận `icon` là một hàm: trang server không truyền hàm qua ranh giới được.
 * Bấm ô nào là sang trang đã lọc sẵn theo mức đó.
 */
export function KpiTiles({ counts }: { counts: Record<MeetingRiskLevel, number> }) {
  const router = useRouter()
  const go = (href: string) => () => router.push(href)
  return (
    <StatTiles>
      <StatTile
        label="Nguy cơ dừng SX"
        value={counts.stop}
        hint="lệnh · mốc còn ≤ 3 ngày mà chưa đủ"
        tone="stop"
        icon={AlertTriangle}
        onClick={go('/planning/van-de?muc=stop')}
      />
      <StatTile
        label="Thiếu / chưa mua"
        value={counts.warn}
        hint="lệnh · việc của Cung ứng"
        tone="warn"
        icon={PackageSearch}
        onClick={go('/planning/van-de?muc=warn')}
      />
      <StatTile
        label="Đang về"
        value={counts.inflight}
        hint="lệnh · nhà cung cấp đang giao"
        tone="primary"
        icon={Truck}
        onClick={go('/planning/lsx')}
      />
      <StatTile
        label="Đủ vật tư"
        value={counts.ready}
        hint="lệnh · Kho đã xác nhận"
        tone="done"
        icon={CheckCircle2}
        onClick={go('/planning/lsx')}
      />
    </StatTiles>
  )
}
