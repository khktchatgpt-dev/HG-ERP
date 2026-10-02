'use client'

import { GridBtn, NoticeBar } from '@/components/kit'
import { draftLabel } from './nhap-an-toan'
import type { useNhapAnToan } from './useNhapAnToan'

/**
 * BANNER BẢN GÕ DỞ — mọi bản tự lưu của khoá này (tối đa 5), mới nhất trước.
 *
 * Banner KHÔNG chặn gì: bỏ qua nó mà gõ đơn mới thì đơn mới vẫn tự lưu thành
 * một bản riêng (bản 1 ngừng tự lưu lúc banner còn hiện — đúng chỗ người dùng
 * mất trắng đơn, 02/10/2026). Khôi phục một bản thì bản đang gõ cũng được giữ.
 */
export function BanNhap({ nhap }: { nhap: ReturnType<typeof useNhapAnToan> }) {
  const [moi, ...cu] = nhap.others
  if (!moi) return null
  const when = (at: string) => new Date(at).toLocaleString('vi-VN')
  return (
    <NoticeBar
      tone="warn"
      tag="Bản nháp"
      action={{ label: 'Khôi phục', onClick: () => nhap.restore(moi) }}
    >
      Có bản gõ dở tự lưu lúc <b className="num">{when(moi.at)}</b> ({draftLabel(moi)}
      ). <GridBtn onClick={() => nhap.discard(moi)}>Bỏ bản này</GridBtn>
      {cu.map((d) => (
        <span key={d.id} className="ml-3 whitespace-nowrap">
          · <span className="num">{when(d.at)}</span> ({draftLabel(d)}){' '}
          <GridBtn onClick={() => nhap.restore(d)}>Khôi phục</GridBtn>{' '}
          <GridBtn onClick={() => nhap.discard(d)}>Bỏ</GridBtn>
        </span>
      ))}
    </NoticeBar>
  )
}
