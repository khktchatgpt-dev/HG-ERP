'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CircleSlash, Ellipsis, ImageOff, Maximize2 } from 'lucide-react'
import { isSvgUrl } from '@/lib/image'
import { Badge } from '@/components/shadcn/badge'
import { RowMenu, type RowMenuItem } from '@/components/erp/RowMenu'
import { DocMeter, classLabel, sizeLabel } from './product-meta'
import { IMAGE_FRAME_BG, type ProductRow } from './types'

/** Thẻ SP trong lưới thư viện — ảnh + nhận diện + dải hồ sơ. */
export function ProductCard({
  p,
  imageUrl,
  actions,
  onZoom,
}: {
  p: ProductRow
  imageUrl?: string
  actions: RowMenuItem[]
  /** Mở hộp xem ảnh lớn. Chỉ gọi khi `imageUrl` có. */
  onZoom: (url: string) => void
}) {
  const size = sizeLabel(p)
  const cls = classLabel(p)

  return (
    <div
      // `isolate`: nút ⋯ bên trong dùng z-10, không đóng khung lại thì nó tranh
      // z-index với cả trang — và `-translate-y` lúc hover còn đổi luôn ngữ cảnh
      // xếp lớp, thành ra thẻ cư xử khác nhau giữa lúc rê chuột và lúc không.
      className={`group bg-card relative isolate flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:border-sky-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5 dark:hover:border-sky-800 ${
        !p.is_active ? 'opacity-65' : ''
      }`}
    >
      <div className="absolute top-1.5 right-1.5 z-10">
        <RowMenu
          items={actions}
          trigger={<Ellipsis className="size-4" />}
          triggerClassName="grid size-7 place-items-center rounded-md border bg-card/85 text-muted-foreground backdrop-blur-sm hover:bg-sky-600 hover:border-sky-600 hover:text-white focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </div>

      <Link
        href={`/products/${p.id}`}
        className="focus-visible:ring-ring/50 flex flex-1 flex-col rounded-t-xl focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <div className={`relative aspect-4/3 overflow-hidden border-b ${IMAGE_FRAME_BG}`}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              unoptimized={isSvgUrl(imageUrl)}
              sizes="(min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              /* `cover` chứ không `contain`: lưới thư viện là để NHẬN RA sản
                 phẩm, ảnh lấp đầy khung thì hàng thẻ mới thành một dải liền
                 mạch thay vì mỗi thẻ một viền trống một kiểu. Cái giá là ảnh
                 bị cắt mép — chấp nhận được vì nút ⛶ ngay trên thẻ mở ảnh
                 NGUYÊN KHỔ (hộp xem để `contain`), không phải vào trang chi
                 tiết mới xem được đủ. */
              className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
            />
          ) : (
            /* 87/537 SP chưa có ảnh, nên ô trống này chiếm phần lớn lưới. In mã
               SP mờ vào giữa để chỗ trống vẫn nhận diện được từ xa, thay vì một
               mảng xám kèm icon ảnh vỡ trông như lỗi tải. */
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3">
              <span className="text-muted-foreground/25 max-w-full truncate font-mono text-lg font-semibold tracking-tight">
                {p.code}
              </span>
              <span className="text-muted-foreground/50 inline-flex items-center gap-1 text-[11px]">
                <ImageOff className="size-3.5" aria-hidden /> Chưa có ảnh
              </span>
            </div>
          )}
          {!p.is_active && (
            <Badge className="absolute top-1.5 left-1.5 border-transparent bg-zinc-900/80 text-white backdrop-blur-sm">
              <CircleSlash /> Ngừng dùng
            </Badge>
          )}
          {/* Phân loại nằm ĐÈ lên ảnh, góc dưới trái: khối chữ dưới ảnh đã có
              3 dòng (tên / mã / khách), thêm dòng thứ tư là thẻ cao thêm mà
              chẳng dễ đọc hơn. Góc này của ảnh vốn bỏ không. */}
          {cls && (
            <Badge
              variant="secondary"
              className="bg-background/85 absolute bottom-1.5 left-1.5 font-normal backdrop-blur-sm"
            >
              {cls}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-0.5 p-2.5">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</h3>
          <p className="text-muted-foreground truncate font-mono text-[11px]">
            {p.code}
            {p.customer_item_code && (
              <span className="text-muted-foreground/70">
                {' '}
                · KH {p.customer_item_code}
              </span>
            )}
          </p>
          {/* Kích thước nằm cạnh tên khách chứ không ở dải icon: 5 icon đã ăn
              hết bề ngang dải đó trên thẻ hẹp (2 cột, màn điện thoại). */}
          <div className="text-muted-foreground mt-auto flex items-baseline gap-2 pt-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate">
              {p.customer_name ?? (
                <span className="text-muted-foreground/70 italic">Mẫu chung</span>
              )}
            </span>
            {size && (
              <span className="text-muted-foreground/70 shrink-0 tabular-nums">
                {size}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Nút xem ảnh nằm NGOÀI <Link>: bấm nó là phóng to tại chỗ, không nhảy
          trang. Hiện thường trực chứ không chỉ khi hover — máy cảm ứng không
          có hover thì nút ẩn là nút không tồn tại. */}
      {imageUrl && (
        <button
          type="button"
          onClick={() => onZoom(imageUrl)}
          aria-label={`Xem ảnh lớn — ${p.name}`}
          title="Xem ảnh lớn"
          className="bg-card/85 text-muted-foreground focus-visible:ring-ring/50 absolute top-10 right-1.5 z-10 grid size-7 place-items-center rounded-md border backdrop-blur-sm hover:border-sky-600 hover:bg-sky-600 hover:text-white focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <Maximize2 className="size-3.5" />
        </button>
      )}

      <div className="flex items-center justify-between gap-2 border-t px-2.5 py-1.5">
        <DocMeter p={p} />
      </div>
    </div>
  )
}
