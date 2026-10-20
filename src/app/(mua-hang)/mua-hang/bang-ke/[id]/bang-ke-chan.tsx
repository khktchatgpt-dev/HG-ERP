'use client'

import { Btn, Code, Empty, TextLink } from '@/components/kit'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import type { BangKeCtx } from './useBangKe'

/**
 * KHỐI "CHƯA QUY ĐỔI ĐƯỢC" — cuối trang (Q6): dòng định mức có mã nhưng không
 * đổi được sang đơn vị mua (thiếu dài cây, lệch ĐVT, thiếu khối lượng…). Số của
 * chúng KHÔNG nằm trong bảng trên, nên phải nói ra kèm ai gỡ và gỡ ở đâu. Gập
 * mặc định; ô đếm ở đầu trang bấm là mở và cuộn tới.
 */
export function BangKeChan({ d }: { d: BangKeCtx }) {
  const { blocked, products } = d.bk
  if (blocked.length === 0) return null
  const spId = new Map(products.map((p) => [p.code, p.id]))
  return (
    <section
      id="bk-chan"
      className="shrink-0 border-t-2 border-[var(--warn)] bg-[var(--surface-card)]"
    >
      <button
        type="button"
        aria-expanded={d.moChan}
        onClick={() => d.setMoChan(!d.moChan)}
        className="text-k-body flex w-full items-center gap-2 px-[var(--gutter)] py-1.5 text-left font-semibold hover:bg-[var(--surface-hover)]"
      >
        <span aria-hidden="true">{d.moChan ? '▾' : '▸'}</span>
        {blocked.length} dòng định mức chưa quy đổi được sang đơn vị mua — số của chúng
        CHƯA vào bảng trên
      </button>
      {d.moChan && (
        <div className="max-h-[260px] overflow-auto px-[var(--gutter)] pb-2">
          <p className="text-k-sm mb-1.5 text-[var(--ink-2)]">
            Mỗi dòng nói rõ vướng gì và ai gỡ. Gỡ xong, tải lại trang là số tự vào bảng.
          </p>
          <table className="text-k-sm w-full border-collapse">
            <thead>
              <tr className="text-k-label text-left text-[var(--ink-3)] uppercase">
                <th className="py-1 pr-3 font-semibold">SP</th>
                <th className="py-1 pr-3 font-semibold">Chi tiết</th>
                <th className="py-1 pr-3 font-semibold">Mã VT</th>
                <th className="py-1 pr-3 font-semibold">Vướng gì</th>
                <th className="py-1 font-semibold">Ai gỡ · ở đâu</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((b, i) => {
                const pid = spId.get(b.product_code)
                const viCungUng = /dài một|chiều dài/i.test(b.reason)
                return (
                  <tr key={i} className="border-t border-[var(--line-faint)] align-top">
                    <td className="py-1 pr-3">
                      <Code>{b.product_code}</Code>
                    </td>
                    <td className="py-1 pr-3">{b.part_name}</td>
                    <td className="py-1 pr-3">
                      <Code>{b.material_code}</Code>{' '}
                      <span className="text-[var(--ink-3)]">{b.material_name}</span>
                    </td>
                    <td className="py-1 pr-3 text-[var(--ink-2)]">{b.reason}</td>
                    <td className="py-1 whitespace-nowrap">
                      {viCungUng ? (
                        <>
                          Cung ứng ·{' '}
                          <TextLink href={`/mua-hang/vat-tu/${b.material_id}`}>
                            Hồ sơ vật tư
                          </TextLink>
                        </>
                      ) : pid ? (
                        <>
                          Kỹ thuật ·{' '}
                          <TextLink href={`/products/${pid}/dinh-muc`}>Hồ sơ SP</TextLink>
                        </>
                      ) : (
                        'Kỹ thuật · hồ sơ SP'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * RỖNG — lệnh chưa có định mức gắn mã (13/14 lệnh lúc dựng). Nói vì sao và
 * đường đi: gắn mã ở hồ sơ SP. Mã đang có trên đơn vẫn xem được ở chế độ "Đơn
 * mua" của màn lệnh.
 */
export function BangKeRong({ bk }: { bk: LsxBangKe }) {
  const chuaMa = bk.products.filter((p) => p.coded_parts === 0)
  const tenSp = chuaMa.map((p) => p.code).join(', ')
  return (
    <Empty
      level={2}
      headline="Chưa tính được bảng kê cho lệnh này"
      reason={
        bk.products.length === 0
          ? 'Lệnh chưa có dòng sản phẩm nào.'
          : `Hồ sơ SP ${tenSp || bk.products.map((p) => p.code).join(', ')} chưa có dòng định mức gắn mã vật tư, nên chưa biết cần mua gì. ${bk.rows.length > 0 ? `${bk.rows.length} mã đang có trên đơn mua xem ở chế độ "Đơn mua" của màn lệnh.` : ''}`
      }
      next={
        <>
          {bk.products.slice(0, 3).map((p) => (
            <Btn key={p.id} icon="dinhHinh" primary href={`/products/${p.id}/dinh-muc`}>
              Gắn mã ở hồ sơ {p.code}
            </Btn>
          ))}
          <Btn icon="quayLai" href={`/mua-hang/yeu-cau/${bk.lsx.id}`}>
            Về màn lệnh
          </Btn>
        </>
      }
    />
  )
}
