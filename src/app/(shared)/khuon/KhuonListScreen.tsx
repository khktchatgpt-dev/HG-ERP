'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  FileQuestionMark,
  ImageOff,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { EmptyState } from '@/components/erp/EmptyState'
import { FilterChip } from '@/components/erp/FilterChip'
import { PageHeader } from '@/components/erp/PageHeader'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import type { DieRow } from '@/modules/dept/technical/dies.repo'
import { KhuonCard } from './_components/KhuonCard'
import { KhuonFormDialog } from './_components/KhuonFormDialog'
import { KhuonImageViewer } from './_components/KhuonImageViewer'
import { money } from './_lib/labels'

/**
 * THƯ VIỆN KHUÔN NHÔM — dựng theo ĐÚNG hệ giao diện của `/products`.
 *
 * Thiết kế + số đo: docs/quan-ly-khuon-ke-hoach.md §5.1.
 *
 * VÌ SAO KHÔNG DÙNG BỘ KIT MỚI Ở MÀN NÀY (chủ dự án chốt 13/09/2026, sau hai
 * bản dựng bằng kit đều bị chê). Luật chung của dự án là màn mới dùng
 * `@/components/kit`, nhưng luật đứng trên nó là: **một cặp màn người dùng đọc
 * cùng nhau thì phải cùng một hệ**. Khuôn nhôm và Thư viện sản phẩm nằm cạnh
 * nhau trong mục "Dùng chung", cùng là thư viện tra cứu có ảnh, và người dùng
 * nhảy qua lại giữa chúng. Kit dày–phẳng–hairline đặt cạnh v3 bo góc–đổ bóng là
 * hai bộ token đánh nhau ngay trước mắt người xem.
 *
 * Hồ sơ một khuôn (`/khuon/[id]`) HIỆN VẪN dựng bằng kit — biết là còn lệch, và
 * là việc kế tiếp, không phải bỏ quên.
 *
 * ═══ BA LUẬT TẢI CHÉP TỪ `/products`, ĐỪNG GỠ ═══
 *
 * 1. VÀO LÀ THẤY TRANG ĐẦU, KHÔNG THẤY HẾT. Chủ dự án chốt 13/09/2026: thư viện
 *    mà mở ra trống trơn thì người dùng phải đoán trong đó có gì. Hiện ngay 24
 *    thẻ đầu, phần còn lại đi theo phân trang.
 * 2. ẢNH CHỈ TẢI THEO TRANG. Mỗi tấm là một vòng gọi Supabase Storage (~1–1,5s,
 *    đo 31/08/2026). Bản đầu đổ cả 169 ảnh ngay lúc mở trang — lỗi nặng nhất của
 *    nó. Nay tối đa `PAGE` tấm.
 * 3. SỐ TRÊN CHIP ĐẾM TRÊN CẢ TẬP, không phải trên trang đang xem.
 *
 * Dữ liệu vẫn nạp một lượt (215 dòng CHỮ, một truy vấn): có đủ tập mới đếm đúng
 * và tìm mới tức thời. Thứ đắt là ẢNH, không phải dòng chữ.
 */

type Props = {
  rows: DieRow[]
  /** Cờ SỬA từ service — UI không tự tính lại luật quyền. */
  canEdit: boolean
  /** id ảnh → URL đã ký (xem `@/server/file-image`). Ký ở server, không ở đây. */
  imageUrls: Record<string, string>
}

/** Số thẻ mỗi trang — cũng là TRẦN số ảnh tải trong một lượt xem. */
const PAGE = 24

/** Bao nhiêu nơi giữ được bày sẵn thành lối tắt ở màn mở đầu. */
const TOP_HOLDERS = 6

/** Mỗi chip là một CÂU HỎI của người phụ trách, không phải một giá trị enum. */
const CHIPS: {
  id: string
  label: string
  icon: typeof Search
  test: (r: DieRow) => boolean
}[] = [
  {
    id: 'unknown',
    label: 'Chưa rõ tình trạng',
    icon: FileQuestionMark,
    test: (r) => r.status === 'unknown',
  },
  {
    id: 'review',
    label: 'Cần rà số liệu',
    icon: AlertTriangle,
    test: (r) => r.data_confidence === 'needs_review',
  },
  {
    id: 'dup',
    label: 'Nghi trùng',
    icon: Copy,
    test: (r) => r.duplicate_group != null,
  },
  {
    id: 'broken',
    label: 'Hư / chờ mở',
    icon: AlertTriangle,
    test: (r) => r.status === 'broken' || r.status === 'pending',
  },
  {
    id: 'noimg',
    label: 'Chưa có mặt cắt',
    icon: ImageOff,
    test: (r) => r.image_file_id == null,
  },
]

const norm = (s: string) => s.toLowerCase().trim()

export function KhuonListScreen({ rows, imageUrls, canEdit }: Props) {
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState<{ die: DieRow; url: string } | null>(null)
  const [q, setQ] = useState('')
  const [chip, setChip] = useState<string | null>(null)
  const [holder, setHolder] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  /** Đang thu hẹp chứ không phải chỉ mở trang — y hệt `/products`. */
  const narrowing = q.trim() !== '' || chip != null || holder != null

  /* Đổi điều kiện lọc là đổi tập → về trang 1. Làm trong handler chứ không qua
     `useEffect`: đặt state trong effect là dựng hai lượt mỗi lần gõ một ký tự. */
  const changeQ = (v: string) => {
    setQ(v)
    setPage(1)
  }
  const toggleChip = (id: string) => {
    setChip((cur) => (cur === id ? null : id))
    setPage(1)
  }
  const toggleHolder = (name: string) => {
    setHolder((cur) => (cur === name ? null : name))
    setPage(1)
  }
  const clearAll = () => {
    setQ('')
    setChip(null)
    setHolder(null)
    setPage(1)
  }

  const holders = useMemo(() => {
    const by = new Map<string, number>()
    for (const r of rows) {
      const k = r.holder_name ?? 'Chưa ghi nơi giữ'
      by.set(k, (by.get(k) ?? 0) + 1)
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  /* Nhóm chi tiết đã có trong danh mục — gợi ý cho ô nhập, để người thêm khuôn
     mới không gõ ra "Diềm Bàn" bên cạnh "Diềm bàn" đã có. */
  const groupOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.part_group).filter((g): g is string => !!g))].sort(),
    [rows],
  )

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test
    const needle = norm(q)
    return rows.filter((r) => {
      if (test && !test(r)) return false
      if (holder && (r.holder_name ?? 'Chưa ghi nơi giữ') !== holder) return false
      if (!needle) return true
      return (
        norm(r.code).includes(needle) ||
        norm(r.name ?? '').includes(needle) ||
        norm(r.part_group ?? '').includes(needle) ||
        norm(r.holder_name ?? '').includes(needle) ||
        r.legacy_codes.some((l) => norm(l).includes(needle))
      )
    })
  }, [rows, q, chip, holder])

  const pages = Math.max(1, Math.ceil(kept.length / PAGE))
  const current = Math.min(page, pages)
  const shown = kept.slice((current - 1) * PAGE, current * PAGE)
  const from = kept.length === 0 ? 0 : (current - 1) * PAGE + 1
  const to = Math.min(current * PAGE, kept.length)

  /* Tiền tính trên CẢ TẬP đang lọc, không phải trang đang xem: "53 khuôn" mà chỉ
     cộng 24 thẻ là con số nói dối. */
  const priced = kept.filter((r) => r.die_price != null)
  const total = priced.reduce((s, r) => s + (r.die_price ?? 0), 0)
  const noPrice = kept.length - priced.length

  const count = (test: (r: DieRow) => boolean) => rows.filter(test).length
  const withImage = count((r) => r.image_file_id != null)

  return (
    <div className="flex flex-col gap-4">
      {/* Khu dùng chung: breadcrumb KHÔNG dẫn về /technical — người ngoài phòng
          Kỹ thuật bấm vào là bị gate workspace đá về '/'. */}
      <PageHeader
        breadcrumbs={[{ label: 'Khuôn nhôm' }]}
        title="Khuôn nhôm"
        description={
          narrowing
            ? `${kept.length} kết quả · lọc từ ${rows.length} khuôn`
            : `${rows.length} khuôn · ${holders.length} nơi giữ · ${withImage} có mặt cắt`
        }
        actions={
          <>
            {narrowing && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <X /> Xoá lọc
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus /> Thêm khuôn
              </Button>
            )}
          </>
        }
      />

      <KhuonImageViewer
        die={preview?.die ?? null}
        url={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />

      {adding && (
        <KhuonFormDialog
          open
          onOpenChange={setAdding}
          holderOptions={holders.map(([name]) => name)}
          groupOptions={groupOptions}
        />
      )}

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-sm">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => changeQ(e.target.value)}
            aria-label="Tìm khuôn"
            placeholder="Tìm mã khuôn, mã cũ, tên chi tiết, nơi giữ…"
            className="h-9 pl-8"
          />
        </div>
        {CHIPS.map((c) => (
          <FilterChip
            key={c.id}
            label={c.label}
            icon={c.icon}
            count={count(c.test)}
            active={chip === c.id}
            onClick={() => toggleChip(c.id)}
          />
        ))}
      </div>

      {/*
        LỐI TẮT THEO NƠI GIỮ — hàng chip nhỏ, luôn hiện.

        Trước 13/09/2026 khối này là cả một "màn mở đầu" chiếm trọn chỗ của lưới,
        và lưới chỉ hiện sau khi người dùng gõ hoặc bấm gì đó. Chủ dự án chốt bỏ:
        vào thư viện mà không thấy thứ gì trong thư viện thì phải đoán xem trong
        đó có gì. Nay lưới hiện ngay TRANG ĐẦU (24 thẻ) còn lối tắt co lại thành
        một hàng chip đứng cạnh.
      */}
      {!narrowing && holders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Khuôn đang ở:</span>
          {holders.slice(0, TOP_HOLDERS).map(([name, n]) => (
            <FilterChip
              key={name}
              label={name}
              icon={MapPin}
              count={n}
              active={holder === name}
              onClick={() => toggleHolder(name)}
            />
          ))}
        </div>
      )}

      {kept.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6 text-[var(--primary)]" />}
          title="Không tìm thấy khuôn nào"
          description="Ô tìm đã dò cả cách viết cũ của mã. Vẫn không ra thì mã đó chưa có trong danh mục — thử bỏ bớt bộ lọc hoặc gõ lại từ khoá."
          action={
            <Button variant="outline" size="sm" onClick={clearAll}>
              <X /> Xoá lọc
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
            {holder && <span>Đang ở {holder}</span>}
            <span className="tabular-nums">Tiền khuôn {money(total)} ₫</span>
            {noPrice > 0 && <span>chưa gồm {noPrice} khuôn không ghi giá</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((d) => (
              <KhuonCard
                key={d.id}
                die={d}
                imageUrl={d.image_file_id ? imageUrls[d.image_file_id] : undefined}
                onZoom={(url) => setPreview({ die: d, url })}
              />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground text-xs tabular-nums">
                {from}–{to} / {kept.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                >
                  Trước
                </Button>
                <span className="text-muted-foreground px-2 text-xs tabular-nums">
                  {current} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
