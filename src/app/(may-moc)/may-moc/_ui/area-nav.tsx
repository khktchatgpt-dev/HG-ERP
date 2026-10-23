'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Btn, SearchInput } from '@/components/kit'
import { apiErrorText } from '@/lib/api'
import { statusOf, type AssetKind, type AssetStatus } from '@/lib/may-moc'
import { normalizeSearch } from '@/lib/search-text'
import { cn } from '@/lib/utils'
import { loadLookup, ScanSheet, type LookupAsset } from './scan-sheet'

const TABS = [
  { href: '/may-moc', label: 'Việc hôm nay', exact: true, badge: 'home' },
  { href: '/may-moc/may', label: 'Máy móc' },
  { href: '/may-moc/bao-tri', label: 'Lịch bảo trì', badge: 'maint' },
  { href: '/may-moc/bao-hong', label: 'Báo hỏng', badge: 'issues' },
  { href: '/may-moc/chi-phi', label: 'Chi phí', cost: true },
  { href: '/may-moc/dung-cu', label: 'Dụng cụ theo người', badge: 'tools' },
] as const

/**
 * Ô tìm máy — như ô "Tìm máy, mã tem, serial…" trên đầu demo MOCA. Danh sách tải
 * lần đầu bấm vào ô (một yêu cầu gọn), lọc ngay trên máy người dùng.
 */
function AssetSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [list, setList] = useState<LookupAsset[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const loading = useRef(false)
  const ensure = () => {
    if (list || loading.current) return
    loading.current = true
    loadLookup().then(
      (r) => setList(r.assets),
      (e) => {
        loading.current = false
        setErr(apiErrorText(e))
      },
    )
  }
  const words = normalizeSearch(q).split(/\s+/).filter(Boolean)
  const hits = words.length
    ? (list ?? [])
        .filter((a) =>
          words.every((w) =>
            normalizeSearch(
              `${a.code} ${a.name} ${a.model ?? ''} ${a.serial ?? ''}`,
            ).includes(w),
          ),
        )
        .slice(0, 8)
    : []
  const go = (a: LookupAsset) => {
    setOpen(false)
    setQ('')
    router.push(`/may-moc/may/${encodeURIComponent(a.code)}`)
  }
  return (
    <div
      className="relative"
      onFocus={() => {
        ensure()
        setOpen(true)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
        if (e.key === 'Enter' && hits[0]) go(hits[0])
      }}
    >
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v)
          setOpen(true)
        }}
        placeholder="Tìm máy, mã tem, serial…"
        label="Tìm máy"
        width={240}
      />
      {open && words.length > 0 && (
        <div
          role="listbox"
          aria-label="Máy tìm được"
          className="absolute top-full right-0 z-[var(--z-pop)] mt-1 grid w-[340px] gap-0.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-drop)]"
        >
          {err ? (
            <p className="text-k-sm p-2 text-[var(--warn)]">
              Không tải được danh sách máy: {err}
            </p>
          ) : !list ? (
            <p className="text-k-sm p-2 text-[var(--ink-3)]">Đang tải…</p>
          ) : hits.length === 0 ? (
            <p className="text-k-sm p-2 text-[var(--ink-3)]">Không tìm thấy máy nào.</p>
          ) : (
            hits.map((a) => {
              const s = statusOf(a.kind as AssetKind, a.status as AssetStatus)
              return (
                <button
                  key={a.code}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(a)}
                  className="text-k-sm grid gap-0.5 rounded-[var(--radius)] px-2 py-1.5 text-left hover:bg-[var(--act-wash)] focus:bg-[var(--act-wash)]"
                >
                  <span className="flex items-center gap-2">
                    <b className="font-mono">{a.code}</b>
                    <span className="min-w-0 truncate">{a.name}</span>
                  </span>
                  <span className="text-[var(--ink-3)]">
                    {a.dept_name ?? 'chưa gán tổ'} · {s.label}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Dải điều hướng TRONG khu Máy móc — sáu trang của bản demo MOCA. Sidebar chỉ
 * giữ MỘT mục "Máy móc & bảo trì" để không đẻ sáu dòng vào menu mỗi phòng.
 * Mục "Chi phí" chỉ hiện với ai có quyền xem (service vẫn gác lại). Tab đầu mang
 * tên theo bản trang đầu người đó vào mặc định ("Tổng quan" cho Giám đốc).
 * Bên phải: ô tìm máy + nút quét tem QR, như thanh trên của demo.
 */
export type NavBadges = { home: number; maint: number; issues: number; tools: number }

/** Số trên tab — đỏ khi là việc trễ / mới hỏng / còn nợ dụng cụ, cam khi chờ duyệt. */
function Badge({ n, tone, label }: { n: number; tone: 'stop' | 'warn'; label: string }) {
  if (!n) return null
  return (
    <span
      aria-label={label}
      className="text-k-label ml-1.5 inline-grid min-w-[18px] place-items-center rounded-full px-1 font-mono font-semibold text-white"
      style={{ background: `var(--${tone})` }}
    >
      {n}
    </span>
  )
}

const BADGE_TEXT: Record<keyof NavBadges, (n: number) => string> = {
  home: (n) => `${n} phiếu chờ duyệt`,
  maint: (n) => `${n} hạng mục quá hạn`,
  issues: (n) => `${n} phiếu mới báo`,
  tools: (n) => `${n} người đã nghỉ còn giữ dụng cụ`,
}

export function AreaNav({
  showCost,
  homeLabel,
  badges,
}: {
  showCost: boolean
  homeLabel: string
  badges: NavBadges
}) {
  const path = usePathname()
  const xem = useSearchParams().get('xem')
  // Tên tab đầu theo đúng bản đang xem (chip ở trang đầu đổi `?xem=`); ngoài trang đầu
  // thì theo bản mặc định của quyền — bấm tab là mở bản đó.
  const home =
    path === '/may-moc' && xem
      ? xem === 'tong-quan'
        ? 'Tổng quan'
        : 'Việc hôm nay'
      : homeLabel
  const [scan, setScan] = useState(false)
  return (
    <nav
      aria-label="Khu máy móc và bảo trì"
      className="flex shrink-0 flex-wrap items-end gap-0 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] md:flex-nowrap"
    >
      {/* Điện thoại: ô tìm + nút quét lên hàng trên, dải tab xuống hàng dưới và cuộn
          ngang. Để chung một hàng thì ô tìm 240px ép dải tab còn 0px — mất lối sang
          các trang khác (đo 23/10/2026 ở 375px). */}
      <div className="order-2 flex w-full min-w-0 items-end overflow-x-auto md:order-none md:w-auto">
        {TABS.filter((t) => !('cost' in t) || showCost).map((t) => {
          const on =
            'exact' in t
              ? path === t.href
              : path === t.href || path.startsWith(`${t.href}/`)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'text-k-body border-b-2 px-3 py-2 whitespace-nowrap no-underline',
                on
                  ? 'border-[var(--act)] font-semibold text-[var(--act-text)]'
                  : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]',
              )}
            >
              {'exact' in t ? home : t.label}
              {'badge' in t && (
                <Badge
                  n={badges[t.badge]}
                  tone={t.badge === 'home' ? 'warn' : 'stop'}
                  label={BADGE_TEXT[t.badge](badges[t.badge])}
                />
              )}
            </Link>
          )
        })}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 py-1 md:ml-auto md:w-auto md:pl-3">
        <AssetSearch />
        <Btn icon="quetQr" onClick={() => setScan(true)}>
          Quét QR
        </Btn>
      </div>
      {scan && <ScanSheet onClose={() => setScan(false)} />}
    </nav>
  )
}
