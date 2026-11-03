'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { routeForGroup, isPurchasedGroup } from '@/lib/stage-route'
import { splitClusterRoute, countingOf } from '@/lib/stage-config'
import { sameStages, type Draft, type LoTrinhProps } from './lo-trinh.shared'

/**
 * Trạng thái màn Lộ trình: một bản nháp id → stages (null = suy theo nhóm).
 * Khoá của cụm = cluster.id, khoá của dòng rời = part.id. Lưu gửi CHỈ những
 * khoá đã đổi; server sắp lại theo thứ tự danh mục.
 */
export function useLoTrinh(p: LoTrinhProps) {
  const router = useRouter()
  const order = useMemo(() => new Map(p.stages.map((s, i) => [s.code, i])), [p.stages])
  const sortStages = useCallback(
    (xs: string[]) =>
      [...new Set(xs)].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99)),
    [order],
  )

  const goc = useMemo<Draft>(() => {
    const d: Draft = {}
    for (const c of p.clusters) d[c.id] = c.stages
    for (const x of p.parts) if (!x.cluster_id) d[x.id] = x.stages
    return d
  }, [p.clusters, p.parts])
  const [nhap, setNhap] = useState<Draft>(goc)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)

  const partsByCluster = useMemo(() => {
    const m = new Map<string, LoTrinhProps['parts']>()
    for (const x of p.parts) {
      if (!x.cluster_id) continue
      const arr = m.get(x.cluster_id) ?? []
      arr.push(x)
      m.set(x.cluster_id, arr)
    }
    return m
  }, [p.parts])

  /** Lộ trình SUY của một cụm = hợp lộ trình nhóm của các chi tiết trong cụm. */
  const suyCum = useCallback(
    (clusterId: string): string[] => {
      const set = new Set<string>()
      for (const x of partsByCluster.get(clusterId) ?? []) {
        for (const s of routeForGroup(x.group_code)) set.add(s)
      }
      return sortStages([...set])
    },
    [partsByCluster, sortStages],
  )

  /** Lộ trình HIỆU LỰC để vẽ ô: khai thì khai, chưa khai thì suy. */
  const hieuLuc = useCallback(
    (id: string, suy: string[]): { stages: string[]; khai: boolean } => {
      const v = nhap[id]
      return v ? { stages: v, khai: true } : { stages: suy, khai: false }
    },
    [nhap],
  )

  const toggle = useCallback(
    (id: string, suy: string[], stage: string) => {
      setNhap((n) => {
        const cur = n[id] ?? suy
        const next = cur.includes(stage)
          ? cur.filter((s) => s !== stage)
          : [...cur, stage]
        return { ...n, [id]: sortStages(next) }
      })
      setLoi(null)
    },
    [sortStages],
  )

  const veMacDinh = useCallback((id: string) => {
    setNhap((n) => ({ ...n, [id]: null }))
  }, [])

  const dirty = useMemo(
    () => Object.keys(nhap).some((k) => !sameStages(nhap[k] ?? null, goc[k] ?? null)),
    [nhap, goc],
  )

  /** Cụm khai rỗng → chặn lưu (cụm biến mất khỏi sổ). */
  const cumRong = useMemo(
    () =>
      p.clusters.filter(
        (c) =>
          nhap[c.id] !== null && nhap[c.id] !== undefined && nhap[c.id]!.length === 0,
      ),
    [p.clusters, nhap],
  )
  const doiRong = useMemo(
    () =>
      p.parts.filter(
        (x) =>
          !x.cluster_id &&
          nhap[x.id] !== null &&
          nhap[x.id] !== undefined &&
          nhap[x.id]!.length === 0,
      ),
    [p.parts, nhap],
  )

  const luu = useCallback(async () => {
    setBusy(true)
    setLoi(null)
    try {
      const clusters = p.clusters
        .filter((c) => !sameStages(nhap[c.id] ?? null, goc[c.id] ?? null))
        .map((c) => ({ id: c.id, stages: nhap[c.id] ?? null }))
      const parts = p.parts
        .filter(
          (x) => !x.cluster_id && !sameStages(nhap[x.id] ?? null, goc[x.id] ?? null),
        )
        .map((x) => ({ id: x.id, stages: nhap[x.id] ?? null }))
      await api(`/api/dept/technical/products/${p.productId}/lo-trinh`, {
        method: 'PATCH',
        body: { clusters, parts },
      })
      const gio = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      setThongBao(
        `Đã lưu lộ trình lúc ${gio} — ${clusters.length} cụm · ${parts.length} dòng rời`,
      )
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Lưu không được, thử lại'))
    } finally {
      setBusy(false)
    }
  }, [p.clusters, p.parts, p.productId, nhap, goc, router])

  const huy = useCallback(() => {
    setNhap(goc)
    setLoi(null)
  }, [goc])

  const counting = useMemo(
    () =>
      countingOf(p.stages.map((s) => ({ code: s.code, label: s.label, meta: s.meta }))),
    [p.stages],
  )
  const chia = useCallback(
    (stages: string[]) => splitClusterRoute(stages, p.stages),
    [p.stages],
  )

  return {
    nhap,
    goc,
    busy,
    loi,
    thongBao,
    dirty,
    cumRong,
    doiRong,
    partsByCluster,
    suyCum,
    hieuLuc,
    toggle,
    veMacDinh,
    luu,
    huy,
    counting,
    chia,
    isPurchasedGroup,
    routeForGroup,
  } as const
}

export type LoTrinhCtx = ReturnType<typeof useLoTrinh>
