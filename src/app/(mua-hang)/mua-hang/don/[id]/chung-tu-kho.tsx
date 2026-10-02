'use client'

import Link from 'next/link'
import { Grid, GridBody, GridHead, GridRow, Tag, Td, Th } from '@/components/kit'
import type { Props } from './don-chung-tu.shared'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const LINK = 'font-semibold text-[var(--act)] hover:underline'

type Doc = Props['warehouseDocs'][number]

const LOAI: Record<string, { label: string; tone: 'done' | 'stop' | 'neutral' }> = {
  receipt: { label: 'Phiếu nhập kho', tone: 'done' },
  return: { label: 'Xuất trả NCC', tone: 'stop' },
  reversal: { label: 'Phiếu đảo', tone: 'neutral' },
  adjustment: { label: 'Điều chỉnh', tone: 'neutral' },
}

/** Câu tình trạng của một phiếu — đảo / sửa lại / điều chỉnh / còn hiệu lực. */
function tinhTrang(d: Doc, dieuChinh: string[]): { text: string; dead: boolean } {
  if (d.reversed_by) return { text: `Đã đảo bởi ${d.reversed_by} — số không còn tính`, dead: true } // prettier-ignore
  if (d.kind === 'reversal') return { text: d.reversal_of ? `Đảo ${d.reversal_of}` : 'Đảo phiếu khác', dead: false } // prettier-ignore
  if (d.kind === 'adjustment') return { text: `Chênh lệch của ${d.adjust_of ?? 'phiếu khác'}`, dead: false } // prettier-ignore
  const them = [
    d.fix_of ? `lập lại thay ${d.fix_of}` : null,
    dieuChinh.length ? `đã điều chỉnh bởi ${dieuChinh.join(', ')}` : null,
  ].filter(Boolean)
  return { text: ['Còn hiệu lực', ...them].join(' · '), dead: false }
}

/**
 * CHỨNG TỪ KHO CỦA ĐƠN (dọn 02/10/2026). Mỗi phiếu nói TÌNH TRẠNG của nó — phiếu
 * đã đảo vẫn nằm đây (vết), nhưng gạch đi và chỉ ra phiếu đảo; phiếu đảo không còn
 * bị gọi nhầm là "Xuất trả NCC" (cùng chiều xuất nhưng khác nghiệp vụ).
 *
 * Mỗi phiếu có Xem · In (bản in) và — với phiếu nhập còn hiệu lực — Sửa: mở đúng
 * hộp Sửa phiếu ở Đã về (một hộp, một đường; server quyết ai sửa được).
 */
export function ChungTuKhoGrid({ docs, coSua = true }: { docs: Doc[]; coSua?: boolean }) {
  return (
    <Grid minWidth={720}>
      <GridHead>
        <Th width={124}>Phiếu</Th>
        <Th width={120}>Loại</Th>
        <Th>Tình trạng</Th>
        <Th num width={110}>
          Tổng số lượng
        </Th>
        <Th num width={96}>
          Ngày chứng từ
        </Th>
        <Th width={110}>Thao tác</Th>
      </GridHead>
      <GridBody>
        {docs.map((d) => {
          const loai = LOAI[d.kind] ?? LOAI.return
          const tt = tinhTrang(
            d,
            docs
              .filter((x) => x.adjust_of === d.code && !x.reversed_by)
              .map((x) => x.code),
          )
          const suaDuoc = coSua && d.kind === 'receipt' && !d.reversed_by
          return (
            <GridRow key={d.doc_id}>
              <Td>
                <span
                  className={`num k-strong ${tt.dead ? 'text-[var(--ink-3)] line-through' : ''}`}
                >
                  {d.code}
                </span>
              </Td>
              <Td>
                <Tag tone={loai.tone}>{loai.label}</Tag>
              </Td>
              <Td>
                <span
                  className={`text-k-sm ${tt.dead ? 'text-[var(--warn)]' : 'text-[var(--ink-2)]'}`}
                >
                  {tt.text}
                </span>
              </Td>
              <Td num>
                <span
                  className={tt.dead ? 'text-[var(--ink-3)] line-through' : undefined}
                >
                  {d.kind === 'adjustment' && d.qty_total > 0 ? '+' : ''}
                  {num(d.qty_total)}
                </span>
              </Td>
              <Td num>{dmy(d.at.slice(0, 10))}</Td>
              <Td>
                <span className="text-k-sm flex gap-3">
                  <Link href={`/print/warehouse/${d.doc_id}`} className={LINK}>
                    Xem · In
                  </Link>
                  {suaDuoc && (
                    <Link
                      href={`/mua-hang/theo-doi/da-ve?sua=${d.doc_id}`}
                      className={LINK}
                    >
                      Sửa
                    </Link>
                  )}
                </span>
              </Td>
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}
