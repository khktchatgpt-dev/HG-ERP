'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { PAGE_SIZE } from './constants'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Stock = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  /** TỔNG mọi trạng thái. KHÔNG dùng để tính đủ/thiếu — xem `qty_ok`. */
  on_hand: number
  is_low: boolean
  /** Dùng được — số duy nhất cấp đi được ngay (0194). */
  qty_ok: number
  /** Đã nhận, chưa được phép dùng. */
  qty_qc: number
  /** Hỏng / sai quy cách, chờ quyết trả hay huỷ. */
  qty_blocked: number
  /** Giữ chỗ cho các LSX đã duyệt/đang SX (bước 2 Kho). */
  reserved: number
  /** on_hand − reserved; âm = thiếu cho LSX. */
  available: number
}

type Movement = {
  id: string
  direction: 'in' | 'out'
  qty: number
  qty_rejected: number
  qc_status: string | null
  ref_type: string
  ref_no: string | null
  note: string | null
  created_at: string
  material_code: string | null
}

/** Cùng bộ rổ với `StockBucket` của repo — đổi một bên là chip nói dối. */
type Bucket = 'has' | 'low' | 'out' | 'qc' | 'blocked' | 'short' | 'all'

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'has', label: 'Đang có tồn' },
  { id: 'low', label: 'Dưới mức tối thiểu' },
  { id: 'out', label: 'Hết hàng (không còn dùng được)' },
  // Hai rổ của trạng thái lượng (0194) — chúng trả lời "lô nào đang mắc, ai
  // phải quyết", câu mà một cột tồn duy nhất không bao giờ trả lời được.
  { id: 'qc', label: 'Có lô chờ kiểm' },
  { id: 'blocked', label: 'Có lô khoá' },
  { id: 'short', label: 'Đã hứa quá số dùng được' },
  { id: 'all', label: 'Cả danh mục' },
]

const REF_LABEL: Record<string, string> = {
  po: 'Theo đơn đặt',
  external: 'Mua ngoài',
  lsx: 'Theo LSX',
  daily: 'Thường ngày',
  adjust: 'Điều chỉnh kiểm kê',
  transfer: 'Điều chuyển',
}

export function StockManager({
  stock,
  total,
  counts,
  groups,
  bucket,
  page,
  filters,
  canEdit,
}: {
  /** MỘT TRANG, không phải cả danh mục — xem chú ở `page.tsx`. */
  stock: Stock[]
  /** Số dòng khớp bộ lọc hiện tại, để phân trang nói đúng. */
  total: number
  /** Đếm từng rổ, tính bằng CÙNG bộ lọc q/group với trang đang xem. */
  counts: {
    all: number
    has: number
    low: number
    out: number
    qc: number
    blocked: number
    short: number
  }
  /** Danh sách nhóm CHỐT từ taxonomy, không lấy từ trang kết quả. */
  groups: string[]
  bucket: Bucket
  page: number
  filters: { q: string; group: string }
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [navigating, startTransition] = useTransition()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [receiveFor, setReceiveFor] = useState<Stock | null>(null)
  const [issueFor, setIssueFor] = useState<Stock | null>(null)
  const [historyFor, setHistoryFor] = useState<Stock | null>(null)

  /**
   * Ô tìm gõ tại chỗ, ĐẨY LÊN URL khi Enter.
   *
   * Gõ tới đâu gọi server tới đó thì mỗi phím là một lượt truy vấn cả view 13k
   * dòng — nên ô này giữ nháp ở client và chỉ đẩy khi Enter.
   *
   * Đồng bộ lại theo URL bằng cách CHỈNH STATE TRONG LÚC RENDER (mẫu chính
   * thức của React cho "prop đổi thì state theo"), không dùng `useEffect`:
   * setState trong effect đẻ một lượt render thừa và bị `hg` chặn ở mức error.
   * Cần đồng bộ vì nút "Xoá bộ lọc" ở trạng thái rỗng và nút Lùi của trình
   * duyệt đều đổi URL mà không đi qua ô nhập.
   */
  const [q, setQ] = useState(filters.q)
  const [qSeen, setQSeen] = useState(filters.q)
  if (qSeen !== filters.q) {
    setQSeen(filters.q)
    setQ(filters.q)
  }

  /**
   * Mọi bộ lọc sống trên URL, không trong `useState`.
   *
   * Ba thứ được cùng lúc: F5 không mất lọc, gửi link cho người khác ra đúng
   * danh sách đó, và nút Lùi của trình duyệt chạy đúng. Bản cũ giữ lọc trong
   * state nên không có thứ nào trong ba.
   *
   * Đổi bộ lọc luôn ĐƯA VỀ TRANG 1: đang ở trang 7 mà lọc lại còn 2 trang thì
   * người dùng nhìn vào một bảng rỗng và tưởng hỏng.
   */
  const pushFilter = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString())
      // Deep-link đời cũ: một khi người dùng tự đổi rổ thì hai tham số này hết
      // nghĩa, để lại thì chúng ghi đè lựa chọn mới ở vòng render sau.
      next.delete('low')
      next.delete('short')
      if (!('page' in patch)) next.delete('page')
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      const qs = next.toString()
      startTransition(() => router.replace(qs ? `?${qs}` : '?'))
    },
    [router, sp],
  )

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function post(url: string, body: unknown, okMsg: string): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method: 'POST', body })
      router.refresh()
      toast.success(okMsg)
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  /**
   * XUẤT CẢ TẬP KHỚP LỌC, không xuất mỗi trang đang xem.
   *
   * Màn đã phân trang nên `stock` chỉ là 50 dòng; xuất đúng 50 dòng đó rồi đặt
   * tên tệp "ton-kho" là một tệp nói dối. Gọi lại API danh sách đầy đủ với
   * cùng q/group để tệp khớp đúng thứ người dùng đang nhìn.
   *
   * Rổ `short` phải lọc lại ở client: `available` không có trong SQL, cùng lý
   * do service phải xử nó riêng.
   */
  async function exportCsv() {
    setBusy(true)
    let rows: Stock[] = []
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.group) params.set('group_name', filters.group)
      if (bucket === 'low') params.set('low_only', '1')
      const res = await api<{ rows: Stock[] }>(
        `/api/dept/warehouse/stock?${params.toString()}`,
      )
      rows = res.rows
      if (bucket === 'has') rows = rows.filter((r) => r.on_hand > 0)
      else if (bucket === 'out') rows = rows.filter((r) => r.on_hand === 0)
      else if (bucket === 'short') rows = rows.filter((r) => r.available < 0)
    } catch (e) {
      toast.error('Không xuất được', e instanceof ApiError ? e.message : 'Có lỗi')
      return
    } finally {
      setBusy(false)
    }
    downloadCsv(`ton-kho-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Tên' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'qty_ok', header: 'Dùng được', get: (s) => String(s.qty_ok) },
      { key: 'qty_qc', header: 'Chờ kiểm', get: (s) => String(s.qty_qc) },
      { key: 'qty_blocked', header: 'Khoá', get: (s) => String(s.qty_blocked) },
      { key: 'on_hand', header: 'Tổng mọi trạng thái', get: (s) => String(s.on_hand) },
      { key: 'reserved', header: 'Giữ cho lệnh', get: (s) => String(s.reserved) },
      { key: 'available', header: 'Còn dùng', get: (s) => String(s.available) },
      { key: 'min_stock', header: 'Tồn tối thiểu', get: (s) => String(s.min_stock) },
      { key: 'shelf_location', header: 'Vị trí kệ', get: (s) => s.shelf_location ?? '' },
      {
        key: 'is_low',
        header: 'Trạng thái',
        get: (s) =>
          s.qty_blocked > 0
            ? 'Có lô khoá'
            : s.qty_qc > 0
              ? 'Có lô chờ kiểm'
              : s.qty_ok === 0
                ? 'Hết'
                : s.is_low
                  ? 'Thấp'
                  : 'Đủ',
      },
    ])
    toast.success(`Đã xuất ${rows.length} dòng CSV`)
  }

  const columns: Column<Stock>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (s) => s.code,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{s.code}</span>
          <span className="truncate font-medium">{s.name}</span>
        </div>
      ),
    },
    /*
      BỐN CỘT LƯỢNG thay cho một cột "Tồn hiện có" (0194).
      Một cột tổng là con số ĐÚNG mà VÔ DỤNG: 2.400 con bulon nằm trong kho mà
      chưa kiểm thì cấp đi không được, và một hệ thống nói "tồn 2.400" là hứa
      hộ nhà kho một thứ nó không giao nổi.
      Cột "Chờ kiểm" và "Khoá" để TRỐNG khi bằng 0 — bảng đầy số 0 thì mắt phải
      lọc thủ công để tìm dòng có chuyện, mà dòng có chuyện mới là thứ cần nhìn.
    */
    {
      key: 'qty_ok',
      header: 'Dùng được',
      width: '120px',
      align: 'right',
      sortValue: (s) => s.qty_ok,
      cell: (s) => (
        <span
          className={`font-semibold tabular-nums ${
            s.qty_ok === 0 ? 'text-[var(--stop)]' : s.is_low ? 'text-[var(--warn)]' : ''
          }`}
        >
          {s.qty_ok} <span className="text-xs font-normal text-zinc-400">{s.unit}</span>
        </span>
      ),
    },
    {
      key: 'qty_qc',
      header: 'Chờ kiểm',
      width: '95px',
      align: 'right',
      sortValue: (s) => s.qty_qc,
      cell: (s) =>
        s.qty_qc > 0 ? (
          <span
            className="text-[var(--warn)] tabular-nums"
            title="Đã nhận nhưng chưa được phép dùng — chờ người kiểm hàng mở khoá"
          >
            {s.qty_qc}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        ),
    },
    {
      key: 'qty_blocked',
      header: 'Khoá',
      width: '95px',
      align: 'right',
      sortValue: (s) => s.qty_blocked,
      cell: (s) =>
        s.qty_blocked > 0 ? (
          <span
            className="font-semibold text-[var(--stop)] tabular-nums"
            title="Hỏng / sai quy cách — chờ Cung ứng quyết trả NCC hay huỷ"
          >
            {s.qty_blocked}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        ),
    },
    {
      key: 'reserved',
      header: 'Đặt trước',
      width: '105px',
      align: 'right',
      sortValue: (s) => s.reserved,
      cell: (s) =>
        s.reserved > 0 ? (
          <span
            className="text-amber-600 tabular-nums dark:text-amber-500"
            title="Giữ chỗ cho các LSX đã duyệt / đang sản xuất (cần − đã xuất)"
          >
            {s.reserved}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">—</span>
        ),
    },
    {
      key: 'available',
      header: 'Còn dùng',
      width: '110px',
      align: 'right',
      sortValue: (s) => s.available,
      cell: (s) =>
        s.available < 0 ? (
          <span
            className="font-semibold text-red-600 tabular-nums dark:text-red-400"
            title="Đã hứa cho LSX nhiều hơn số DÙNG ĐƯỢC đang có"
          >
            thiếu {Math.abs(s.available)}
          </span>
        ) : (
          <span className="font-semibold tabular-nums">
            {s.available}{' '}
            <span className="text-xs font-normal text-zinc-400">{s.unit}</span>
          </span>
        ),
    },
    {
      key: 'min_stock',
      header: 'Tối thiểu',
      width: '100px',
      align: 'right',
      sortValue: (s) => s.min_stock,
      cell: (s) => <span className="text-zinc-500 tabular-nums">{s.min_stock}</span>,
    },
    {
      key: 'shelf_location',
      header: 'Kệ',
      width: '90px',
      sortValue: (s) => s.shelf_location ?? 'zzz',
      cell: (s) =>
        s.shelf_location ? (
          <span className="font-mono text-xs">{s.shelf_location}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      sortValue: (s) =>
        s.qty_blocked > 0 ? 0 : s.qty_qc > 0 ? 1 : s.qty_ok === 0 ? 2 : s.is_low ? 3 : 4,
      /* Thứ tự ưu tiên là thứ tự VIỆC PHẢI LÀM, không phải mức nghiêm trọng:
         lô khoá cần người quyết → lô chờ kiểm cần người kiểm → rồi mới tới
         chuyện đủ/thiếu. Gộp cả bốn thành "Hết hàng" là mất đúng thông tin
         quyết định bước tiếp theo. */
      cell: (s) =>
        s.qty_blocked > 0 ? (
          <Badge tone="red">Có lô khoá</Badge>
        ) : s.qty_qc > 0 ? (
          <Badge tone="amber">Chờ kiểm</Badge>
        ) : s.qty_ok === 0 ? (
          <Badge tone="red">Hết hàng</Badge>
        ) : s.is_low ? (
          <Badge tone="amber">Tồn thấp</Badge>
        ) : (
          <Badge tone="green">Đủ</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (s) => {
        const items = [{ label: 'Lịch sử nhập/xuất', onClick: () => setHistoryFor(s) }]
        if (canEdit) {
          items.unshift(
            { label: '↑ Nhập kho', onClick: () => setReceiveFor(s) },
            { label: '↓ Xuất kho', onClick: () => setIssueFor(s) },
          )
        }
        return <RowMenu items={items} />
      },
    },
  ]

  const groupOptions = [
    { value: '', label: 'Mọi nhóm' },
    ...groups.map((g) => ({ value: g, label: g })),
  ]
  const bucketOptions = BUCKETS.map((b) => ({
    value: b.id,
    // Số đếm ĐI KÈM nhãn: chọn một rổ mà không biết nó có bao nhiêu dòng là
    // lọc mù — người dùng phải chọn rồi mới biết mình vừa chọn gì.
    label: `${b.label} (${counts[b.id].toLocaleString('vi-VN')})`,
  }))

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Tồn kho' }]}
        title="Tồn kho"
        /* Mô tả nói ĐÚNG NỀN TÍNH sau 0194: "Còn dùng" trừ trên DÙNG ĐƯỢC,
           không trên tổng tồn. Câu cũ ("Khả dụng = tồn − đặt trước") giờ sai,
           và một dòng mô tả sai còn hại hơn không có dòng nào. */
        description={`${total.toLocaleString('vi-VN')} vật tư khớp lọc trên ${counts.all.toLocaleString('vi-VN')} mã trong danh mục. Tồn tự tính từ phiếu nhập/xuất. Dùng được = chưa trừ phần chờ kiểm và phần khoá. Còn dùng = dùng được − đã hứa cho LSX đã duyệt.`}
        actions={
          <button onClick={exportCsv} className={btnSecondary}>
            Export CSV
          </button>
        }
      />

      {/* Đếm Ở SERVER trên CẢ tập khớp lọc, không đếm trên trang đang xem —
          đếm trên trang thì con số đổi mỗi lần bấm sang trang sau. */}
      <StatsBar
        stats={[
          { label: 'Cả danh mục', value: counts.all, tone: 'default' },
          { label: 'Đang có tồn', value: counts.has, tone: 'green' },
          { label: 'Tồn thấp', value: counts.low, tone: counts.low ? 'amber' : 'gray' },
          { label: 'Chờ kiểm', value: counts.qc, tone: counts.qc ? 'amber' : 'gray' },
          {
            label: 'Có lô khoá',
            value: counts.blocked,
            tone: counts.blocked ? 'red' : 'gray',
          },
          {
            label: 'Thiếu cho LSX',
            value: counts.short,
            tone: counts.short ? 'red' : 'gray',
          },
        ]}
      />

      {counts.low > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠ Có <strong>{counts.low}</strong> vật tư tồn dưới mức tối thiểu — cần đề xuất
          mua bổ sung.
        </div>
      )}

      <div>
        <Toolbar
          left={
            <>
              {/* Tìm theo MÃ và TÊN, CÓ DẤU — view tồn không có cột không dấu
                  như bảng danh mục. Nói thẳng trong placeholder thay vì để
                  người dùng gõ "vit" rồi tưởng mã không tồn tại. */}
              <ToolbarInput
                value={q}
                onChange={setQ}
                onEnter={() => pushFilter({ q })}
                placeholder="Mã hoặc tên — gõ không dấu cũng được, Enter để tìm…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={filters.group}
                onChange={(v) => pushFilter({ group: v })}
                options={groupOptions}
              />
              <ToolbarSelect
                value={bucket}
                onChange={(v) => pushFilter({ bucket: v })}
                options={bucketOptions}
              />
            </>
          }
          right={
            busy || navigating ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Spinner size={12} /> Đang xử lý…
              </span>
            ) : undefined
          }
        />

        <DataTable<Stock>
          rows={stock}
          /* Dòng tồn không có `id` (khoá là material_id) — thiếu keyFn thì
             DataTable rơi về String(row) = "[object Object]" cho MỌI dòng:
             React trùng key, dòng có thể vẽ thiếu/vẽ đúp khi lọc. */
          keyFn={(s) => s.material_id}
          columns={columns}
          storageKey="warehouse-stock"
          /* TẮT phân trang trong DataTable: nó mặc định cắt 25 dòng/trang ở
             client, mà server đã trả đúng một trang 50 dòng. Để cả hai thì có
             HAI thanh phân trang lồng nhau — thanh trong nói "1/2", thanh
             ngoài nói "trang 1/265", và không ai hiểu mình đang ở đâu. */
          pagination={false}
          emptyState={
            /* Rỗng vì CHƯA CÓ VIỆC khác hẳn rỗng vì LỌC QUÁ TAY — hai câu khác
               nhau, và câu thứ hai phải kèm đường ra. Đặc biệt với rổ mặc định
               "Đang có tồn": kho vừa đưa tồn về 0 ngày 15/09 để nạp lại, nên
               rỗng ở đây là ĐÚNG SỰ THẬT chứ không phải hỏng — nói thẳng thay
               vì để người dùng tưởng mất dữ liệu. */
            <EmptyState
              icon="▦"
              title={
                filters.q || filters.group
                  ? 'Không mã nào khớp bộ lọc'
                  : bucket === 'has'
                    ? 'Chưa mã nào đang có tồn'
                    : 'Rổ này đang trống'
              }
              description={
                filters.q || filters.group
                  ? `Không có mã nào khớp trong rổ "${BUCKETS.find((b) => b.id === bucket)?.label}". Mã có thể nằm ở rổ khác — cả danh mục đang có ${counts.all.toLocaleString('vi-VN')} mã.`
                  : bucket === 'has'
                    ? `Không mã nào có tồn khác 0. Chuyển sang rổ "Cả danh mục" (${counts.all.toLocaleString('vi-VN')} mã) để tra một mã cụ thể, hoặc lập phiếu nhập để tồn bắt đầu chạy.`
                    : 'Không mã nào rơi vào điều kiện của rổ đang chọn.'
              }
              action={
                filters.q || filters.group ? (
                  <button
                    className={btnSecondary}
                    onClick={() => pushFilter({ q: '', group: '' })}
                  >
                    Xoá bộ lọc
                  </button>
                ) : bucket !== 'all' ? (
                  <button
                    className={btnSecondary}
                    onClick={() => pushFilter({ bucket: 'all' })}
                  >
                    Xem cả danh mục
                  </button>
                ) : undefined
              }
            />
          }
        />

        {/* PHÂN TRANG — chỉ hiện khi thật sự có nhiều hơn một trang. */}
        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <span>
              {((page - 1) * PAGE_SIZE + 1).toLocaleString('vi-VN')}–
              {Math.min(page * PAGE_SIZE, total).toLocaleString('vi-VN')} trên{' '}
              <strong>{total.toLocaleString('vi-VN')}</strong> mã khớp lọc
            </span>
            <div className="flex items-center gap-2">
              <button
                className={btnSecondary}
                disabled={page <= 1 || navigating}
                onClick={() => pushFilter({ page: String(page - 1) })}
              >
                ← Trước
              </button>
              <span>
                trang {page} / {pages}
              </span>
              <button
                className={btnSecondary}
                disabled={page >= pages || navigating}
                onClick={() => pushFilter({ page: String(page + 1) })}
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nhập kho */}
      <Modal
        open={!!receiveFor}
        onClose={() => setReceiveFor(null)}
        title={receiveFor ? `Nhập kho — ${receiveFor.name}` : ''}
      >
        {receiveFor && (
          <ReceiveForm
            material={receiveFor}
            onSubmit={async (body) => {
              const ok = await post(
                '/api/dept/warehouse/receipts',
                { material_id: receiveFor.material_id, ...body },
                `Đã nhập ${body.qty} ${receiveFor.unit}`,
              )
              if (ok) setReceiveFor(null)
            }}
          />
        )}
      </Modal>

      {/* Xuất kho */}
      <Modal
        open={!!issueFor}
        onClose={() => setIssueFor(null)}
        title={issueFor ? `Xuất kho — ${issueFor.name}` : ''}
      >
        {issueFor && (
          <IssueForm
            material={issueFor}
            onSubmit={async (body) => {
              const ok = await post(
                '/api/dept/warehouse/issues',
                { material_id: issueFor.material_id, ...body },
                `Đã xuất ${body.qty} ${issueFor.unit}`,
              )
              if (ok) setIssueFor(null)
            }}
          />
        )}
      </Modal>

      {/* Lịch sử */}
      <Modal
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title={historyFor ? `Lịch sử — ${historyFor.name}` : ''}
      >
        {historyFor && (
          <MovementHistory materialId={historyFor.material_id} unit={historyFor.unit} />
        )}
      </Modal>
    </div>
  )
}

// ── Forms ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

function ReceiveForm({
  material,
  onSubmit,
}: {
  material: Stock
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const rejected = Number(fd.get('qty_rejected') ?? 0) || 0
    const body: Record<string, unknown> = {
      qty: Number(fd.get('qty') ?? 0) || 0,
      qty_rejected: rejected,
      qc_status: rejected > 0 ? 'partial' : 'pass',
      ref_type: String(fd.get('ref_type') ?? 'external'),
      ref_no: String(fd.get('ref_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }
  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <div className="text-xs text-zinc-500 sm:col-span-2">
        Tồn hiện có: <strong>{material.on_hand}</strong> {material.unit}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Số đạt (vào kho) <span className="text-red-500">*</span>
        <input
          name="qty"
          type="number"
          min="0.01"
          step="0.01"
          required
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số không đạt (QC)
        <input
          name="qty_rejected"
          type="number"
          min="0"
          step="0.01"
          defaultValue={0}
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nguồn nhập
        <select name="ref_type" defaultValue="external" className={inputCls}>
          <option value="external">Mua ngoài</option>
          <option value="po">Theo đơn đặt hàng</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số đơn đặt / chứng từ
        <input name="ref_no" maxLength={60} placeholder="(nếu có)" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}↑ Nhập kho
        </button>
      </div>
    </form>
  )
}

function IssueForm({
  material,
  onSubmit,
}: {
  material: Stock
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      qty: Number(fd.get('qty') ?? 0) || 0,
      ref_type: String(fd.get('ref_type') ?? 'daily'),
      ref_no: String(fd.get('ref_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }
  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <div className="text-xs text-zinc-500 sm:col-span-2">
        Tồn hiện có: <strong>{material.on_hand}</strong> {material.unit} — không xuất quá
        số này.
        {material.reserved > 0 && (
          <>
            {' '}
            Đang giữ chỗ cho LSX: <strong>{material.reserved}</strong> — khả dụng{' '}
            <strong
              className={material.available < 0 ? 'text-red-600 dark:text-red-400' : ''}
            >
              {material.available}
            </strong>
            .
          </>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Số lượng xuất <span className="text-red-500">*</span>
        <input
          name="qty"
          type="number"
          min="0.01"
          step="0.01"
          max={material.on_hand}
          required
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mục đích
        <select name="ref_type" defaultValue="daily" className={inputCls}>
          <option value="daily">Xuất thường ngày</option>
          <option value="lsx">Theo lệnh sản xuất (LSX)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Mã LSX / lý do
        <input
          name="ref_no"
          maxLength={60}
          placeholder="(nếu xuất theo LSX)"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}↓ Xuất kho
        </button>
      </div>
    </form>
  )
}

function MovementHistory({ materialId, unit }: { materialId: string; unit: string }) {
  const [rows, setRows] = useState<Movement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ rows: Movement[] }>(`/api/dept/warehouse/movements?material_id=${materialId}`)
      .then((r) => alive && setRows(r.rows))
      .catch(
        (e) =>
          alive && setError(e instanceof ApiError ? e.message : 'Không tải được lịch sử'),
      )
    return () => {
      alive = false
    }
  }, [materialId])

  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (rows === null)
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
        <Spinner size={14} /> Đang tải…
      </div>
    )
  if (rows.length === 0)
    return (
      <div className="py-6 text-center text-sm text-zinc-500">
        Chưa có phiếu nhập/xuất nào.
      </div>
    )

  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-zinc-50 text-[10px] tracking-wider text-zinc-500 uppercase dark:bg-zinc-900">
          <tr>
            <th className="px-2 py-1.5">Thời gian</th>
            <th className="px-2 py-1.5">Loại</th>
            <th className="px-2 py-1.5 text-right">SL</th>
            <th className="px-2 py-1.5">Nguồn</th>
            <th className="px-2 py-1.5">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500">
                {new Date(m.created_at).toLocaleString('vi-VN')}
              </td>
              <td className="px-2 py-1.5">
                {m.direction === 'in' ? (
                  <span className="font-medium text-green-600">↑ Nhập</span>
                ) : (
                  <span className="font-medium text-sky-600">↓ Xuất</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {m.qty} {unit}
                {m.qty_rejected > 0 && (
                  <span className="ml-1 text-red-500">(loại {m.qty_rejected})</span>
                )}
              </td>
              <td className="px-2 py-1.5">
                {/* Xuất gắn PO = TRẢ HÀNG NCC (0080) — "Theo đơn đặt · ↓ Xuất"
                    đọc như nhập hàng, gây hiểu lầm đúng chỗ nhạy cảm nhất. */}
                {m.direction === 'out' && m.ref_type === 'po'
                  ? 'Trả NCC'
                  : (REF_LABEL[m.ref_type] ?? m.ref_type)}
                {m.ref_no && <span className="ml-1 text-zinc-400">#{m.ref_no}</span>}
              </td>
              <td className="px-2 py-1.5 text-zinc-500">{m.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
