'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  Code,
  Empty,
  FilterBar,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  Table,
  TableSettings,
  Tag,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import { goiYMucDich } from '@/lib/po-muc-dich'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { searchMatcher } from '@/lib/search-text'
import type { ProjectRow } from '@/modules/dept/supply/projects.service'
import { HangMucSheet } from './hang-muc-sheet'
import { tien, tienTheoLoai } from './hang-muc.shared'

const CHIPS = [
  { id: 'mo', label: 'Đang mở', test: (r: ProjectRow) => r.status === 'open' },
  { id: 'chuY', label: 'Cần chú ý', test: (r: ProjectRow) => r.chu_y.length > 0 },
  { id: 'dong', label: 'Đã đóng', test: (r: ProjectRow) => r.status === 'closed' },
  { id: 'all', label: 'Tất cả', test: () => true },
] as const
type ChipId = (typeof CHIPS)[number]['id']

function cot(): KitCol<ProjectRow>[] {
  return [
    {
      id: 'ma',
      header: 'Mã',
      pin: true,
      sort: (r) => r.code,
      cell: (r) => (
        <Code as="a" href={`/mua-hang/hang-muc/${r.id}`}>
          {r.code}
        </Code>
      ),
    },
    {
      id: 'ten',
      header: 'Hạng mục',
      rowHeader: true,
      grow: true,
      sort: (r) => r.name,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <a
            href={`/mua-hang/hang-muc/${r.id}`}
            className="font-semibold hover:underline"
          >
            {r.name}
          </a>
          {r.status === 'closed' && <Tag>Đã đóng</Tag>}
        </span>
      ),
    },
    { id: 'loai', header: 'Loại', muted: true, sort: (r) => r.kind, cell: (r) => r.kind },
    { id: 'phuTrach', header: 'Phụ trách', sort: (r) => r.owner_name, cell: (r) => r.owner_name ?? '' }, // prettier-ignore
    {
      id: 'don',
      header: 'Đơn',
      num: true,
      sort: (r) => r.so.n,
      cell: (r) => (
        <span className="num">
          {r.so.n || ''}
          {r.so.nhap > 0 && (
            <span className="text-[var(--ink-3)]"> +{r.so.nhap} nháp</span>
          )}
        </span>
      ),
    },
    {
      id: 'dat',
      header: 'Đã đặt',
      num: true,
      sort: (r) => r.so.ordered,
      title: () => 'Tổng thanh toán (gồm VAT) các đơn đã rời nháp, trừ đơn huỷ',
      cell: (r) => (r.so.ordered ? tien(r.so.ordered, r.currency) : ''),
    },
    {
      id: 'duToan',
      header: 'So dự toán',
      width: 170,
      sort: (r) => r.so.pct ?? -1,
      tone: (r) => (r.so.pct != null && r.so.pct >= NGUONG_DU_TOAN ? 'warn' : undefined),
      cell: (r) =>
        r.budget == null ? (
          <span className="text-[var(--ink-3)]">không dự toán</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="block h-1.5 w-full bg-[var(--line-soft,#e3e7ee)]">
              <span
                className="block h-full"
                style={{ width: `${Math.min(r.so.pct ?? 0, 100)}%`, background: (r.so.pct ?? 0) >= NGUONG_DU_TOAN ? 'var(--warn)' : 'var(--act)' }} // prettier-ignore
              />
            </span>
            <span className="num text-k-label">
              {r.so.pct}% của {tien(r.budget, r.currency)}
            </span>
          </span>
        ),
    },
    {
      id: 've',
      header: 'Đã về',
      num: true,
      sort: (r) => r.so.received_net,
      title: (r) =>
        r.so.thieu_gia
          ? `${r.so.thieu_gia} đơn có phiếu nhập KHÔNG GIÁ — tiền về của chúng đang tính 0; bổ sung giá ở phiếu nhập`
          : 'Theo phiếu kho, chưa VAT — cùng số mục Tài chính của từng đơn',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.so.received_net ? tien(r.so.received_net, r.currency) : ''}
          {r.so.thieu_gia > 0 && <Tag tone="warn">thiếu giá</Tag>}
          {r.so.loi_tai_chinh > 0 && <Tag tone="stop">chưa đọc được</Tag>}
        </span>
      ),
    },
    {
      id: 'no',
      header: 'Còn nợ NCC',
      num: true,
      sort: (r) => r.so.owed,
      title: () => 'Hoá đơn gồm VAT − đã trả',
      cell: (r) => (r.so.owed ? tien(r.so.owed, r.currency) : ''),
    },
    {
      id: 'chuY',
      header: 'Cần chú ý',
      sort: (r) => r.chu_y.length,
      tone: (r) => (r.chu_y.length ? 'warn' : undefined),
      cell: (r) => r.chu_y.join(' · '),
    },
  ]
}

/** Danh sách hạng mục ngoài sản xuất — xem `page.tsx`. */
export function HangMucScreen({
  rows,
  canManage,
}: {
  rows: ProjectRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [chip, setChip] = useState<ChipId>('mo')
  const [q, setQ] = useState('')
  const [tao, setTao] = useState(false)
  const match = searchMatcher(q)
  const kept = rows.filter(
    (r) =>
      CHIPS.find((c) => c.id === chip)!.test(r) &&
      match([r.code, r.name, r.kind, r.owner_name]),
  )
  const cong = (k: 'ordered' | 'received_net' | 'owed') => {
    const m: Record<string, number> = {}
    for (const r of kept) m[r.currency] = (m[r.currency] ?? 0) + r.so[k]
    return tienTheoLoai(m)
  }
  const columns = useMemo(() => cot(), [])
  const engine = useKitTable({
    rows: kept,
    columns,
    rowKey: (r) => r.id,
    prefsKey: 'mua-hang-hang-muc',
    foot: {
      label: `Cộng ${kept.length} hạng mục đang hiện`,
      note: `Đã đặt ${cong('ordered') || '0'} · đã về ${cong('received_net') || '0'} · còn nợ ${cong('owed') || '0'} — KHÔNG gồm đơn nháp, đơn huỷ, phí vận chuyển; cộng riêng từng loại tiền.`, // prettier-ignore
    },
  })
  const mo = rows.filter((r) => r.status === 'open')
  const chuY = rows.filter((r) => r.chu_y.length > 0).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Hạng mục ngoài sản xuất"
        facts={[
          { label: 'Đang mở', value: String(mo.length) },
          {
            label: 'Cần chú ý',
            value: String(chuY),
            tone: chuY > 0 ? 'warn' : 'neutral',
          },
          { label: 'Đơn đã đặt', value: String(mo.reduce((t, r) => t + r.so.n, 0)) },
        ]}
        actions={
          <Btn
            icon="them"
            primary
            blockedBy={canManage ? undefined : 'phòng Cung ứng'}
            onClick={() => setTao(true)}
          >
            Hạng mục mới
          </Btn>
        }
      />
      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã, tên, loại, người phụ trách…"
          width={300}
        />{' '}
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={rows.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {' '}
            {c.label}
          </Chip>
        ))}
        <span className="ml-auto">
          <TableSettings engine={engine} />
        </span>
      </FilterBar>
      {kept.length === 0 ? (
        <Empty
          headline={
            rows.length === 0 ? 'Chưa có hạng mục nào' : 'Không có hạng mục nào khớp'
          }
          reason={
            rows.length === 0
              ? 'Hạng mục là việc ngoài sản xuất gom nhiều đơn mua — vd. Xây dựng văn phòng, Dự trữ kho.'
              : `Bộ lọc “${CHIPS.find((c) => c.id === chip)!.label}”${q.trim() ? ` cộng từ khoá “${q.trim()}”` : ''} không còn dòng nào.` // prettier-ignore
          }
          next={
            rows.length === 0 ? (
              <Btn
                icon="them"
                primary
                onClick={() => setTao(true)}
                blockedBy={canManage ? undefined : 'phòng Cung ứng'}
              >
                {' '}
                Tạo hạng mục đầu tiên
              </Btn>
            ) : (
              <Btn icon="boLoc" onClick={() => (setQ(''), setChip('all'))}>
                Bỏ lọc, xem cả {rows.length} hạng mục
              </Btn>
            )
          }
        />
      ) : (
        <Table engine={engine} />
      )}
      <StatusBar
        left={['Bấm mã hoặc tên để mở hồ sơ hạng mục', 'Tạo đơn cho hạng mục: ô "Cho việc" ở màn soạn đơn']} // prettier-ignore
        right={`${kept.length} / ${rows.length} hạng mục`}
      />
      {tao && (
        <HangMucSheet
          goiYLoai={goiYMucDich(rows.map((r) => r.kind))}
          onClose={() => setTao(false)}
          onSaved={(p) => router.push(`/mua-hang/hang-muc/${p.id}`)}
        />
      )}
    </ScreenFrame>
  )
}
