'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  CircleCheck,
  CircleSlash,
  Ellipsis,
  ImageOff,
  Lock,
  Maximize2,
} from 'lucide-react'
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from '@/lib/product-lifecycle'
import { isSvgUrl } from '@/lib/image'
import { Badge } from '@/components/shadcn/badge'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { RowMenu, type RowMenuItem } from '@/components/erp/RowMenu'
import { DocMeter, classLabel, docOkCount } from './product-meta'
import type { ProductRow } from './types'

/**
 * Ảnh nhỏ cho dòng bảng — cùng nguồn signed URL với thẻ lưới. Có ảnh thì bấm
 * được để phóng to, giống nút ⛶ trên thẻ; không có thì chỉ là ô trống.
 */
function Thumb({ p, url, onZoom }: { p: ProductRow; url?: string; onZoom: () => void }) {
  if (!url) {
    return (
      <div className="bg-muted grid size-9 place-items-center rounded border">
        <ImageOff
          className="text-muted-foreground/50 size-3.5"
          aria-label={`${p.name}: chưa có ảnh`}
        />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onZoom}
      title="Xem ảnh lớn"
      aria-label={`Xem ảnh lớn — ${p.name}`}
      className="group/thumb bg-muted focus-visible:ring-ring/50 relative block size-9 overflow-hidden rounded border hover:border-sky-400 focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <Image
        src={url}
        alt=""
        fill
        sizes="36px"
        unoptimized={isSvgUrl(url)}
        className="object-cover"
      />
      <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity group-hover/thumb:opacity-100">
        <Maximize2 className="size-3 text-white" />
      </span>
    </button>
  )
}

/** Chế độ bảng của thư viện — dùng chung dải hồ sơ và menu ⋯ với thẻ lưới. */
export function ProductTable({
  products,
  imageUrls,
  rowActions,
  onZoom,
}: {
  products: ProductRow[]
  imageUrls: Record<string, string>
  rowActions: (p: ProductRow) => RowMenuItem[]
  onZoom: (p: ProductRow, url: string) => void
}) {
  const columns: Column<ProductRow>[] = [
    {
      key: 'image',
      header: '',
      width: '52px',
      cell: (p) => {
        const url = imageUrls[p.id]
        return <Thumb p={p} url={url} onZoom={() => url && onZoom(p, url)} />
      },
    },
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (p) => p.code,
      cell: (p) => (
        <Link
          href={`/products/${p.id}`}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="text-muted-foreground font-mono text-xs">
            {p.code}
            {p.customer_item_code && (
              <span className="text-muted-foreground/70">
                {' '}
                · KH {p.customer_item_code}
              </span>
            )}
          </span>
          <span className="truncate font-medium">{p.name}</span>
        </Link>
      ),
    },
    {
      key: 'class',
      header: 'Loại',
      // Sắp theo NHÃN đã dịch, không theo mã 2 ký tự: người đọc thấy "Bàn, Bộ
      // sản phẩm, Ghế…" thì thứ tự phải theo chữ đó chứ không theo TB/ST/CH.
      sortValue: (p) => classLabel(p) ?? '',
      width: '150px',
      cell: (p) => {
        const cls = classLabel(p)
        return cls ? (
          <span className="truncate">{cls}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )
      },
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      sortValue: (p) => p.customer_name ?? '',
      width: '170px',
      cell: (p) =>
        p.customer_name ? (
          <span className="truncate">{p.customer_name}</span>
        ) : (
          <span className="text-muted-foreground/70 italic">Mẫu chung</span>
        ),
    },
    {
      key: 'docs',
      header: 'Hồ sơ',
      // Sắp theo SỐ MỤC ĐÃ ĐỦ — sort cột này là để lôi SP thiếu nhiều lên đầu.
      sortValue: docOkCount,
      width: '120px',
      cell: (p) => <DocMeter p={p} />,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      // Hồ sơ ĐÃ KHOÁ lên đầu khi sort: đó là các bản đã chốt, dùng được ngay.
      sortValue: (p) => (p.locked_at ? 0 : p.is_active ? 1 : 2),
      width: '130px',
      cell: (p) => (
        <div className="flex flex-col items-start gap-1">
          {p.is_active ? (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <CircleCheck /> Đang dùng
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <CircleSlash /> Ngừng
            </Badge>
          )}
          {/* 0140 — hồ sơ chốt: bảng phải nói ra như lưới thẻ. */}
          {p.locked_at && (
            <Badge
              title={`Khoá ${new Date(p.locked_at).toLocaleDateString('vi-VN')}`}
              className="border-transparent bg-emerald-600 text-white"
            >
              <Lock /> Đã khoá
            </Badge>
          )}
          {/* TRẠNG THÁI hồ sơ (0145) — như lưới thẻ, chỉ hiện khi đã rời "Nháp". */}
          {p.lifecycle !== 'draft' && (
            <Badge className={`border-transparent ${LIFECYCLE_TONE[p.lifecycle]}`}>
              {LIFECYCLE_LABEL[p.lifecycle]}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (p) => (
        <RowMenu
          items={rowActions(p)}
          trigger={<Ellipsis className="size-4" />}
          triggerClassName="grid size-7 place-items-center rounded-md border text-muted-foreground hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
        />
      ),
    },
  ]

  return (
    <DataTable<ProductRow>
      rows={products}
      columns={columns}
      storageKey="tech-products"
      rowClassName={(p) => (!p.is_active ? 'opacity-65' : '')}
    />
  )
}
