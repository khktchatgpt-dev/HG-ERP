'use client'

import { useRouter } from 'next/navigation'
import { Btn, Empty, Pick, ScreenFrame, ScreenHeader } from '@/components/kit'
import type { MatchRow, MatchVerdict } from '@/lib/three-way-match'
import { DoiChieuTable } from './DoiChieuTable'

type PoOption = {
  id: string
  code: string
  supplier_name: string
  status: string
  currency: string
}

type Match = {
  rows: MatchRow[]
  summary: {
    total: number
    byVerdict: Record<MatchVerdict, number>
    amount_cho_hoa_don: number
    amount_doi_truoc: number
    amount_lech_gia: number
  }
  unlinked_amount: number
  currency: string
}

/**
 * Khung màn đối chiếu. `ScreenFrame` chứ không phải `min-h-screen`: bảng phải
 * cuộn TRONG khung thì tiêu đề cột dính và chân tổng dính mới có tác dụng —
 * đặt `min-h-screen` ở cha là vô hiệu cả hai (luật kiểm mục 05 của sổ).
 */
export function HoaDonNccScreen({
  pos,
  selectedId,
  match,
  canManage,
}: {
  pos: PoOption[]
  selectedId: string | null
  match: Match | null
  canManage: boolean
}) {
  const router = useRouter()
  const current = pos.find((p) => p.id === selectedId) ?? null

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          eyebrow="Tài chính"
          title="Đối chiếu hoá đơn nhà cung cấp"
          actions={
            <>
              <Btn href="/finance/hoa-don-ncc/so">Sổ hoá đơn NCC</Btn>
              {canManage && current && (
                <Btn primary href={`/finance/hoa-don-ncc/moi?don=${current.id}`}>
                  Nhập hoá đơn cho {current.code}
                </Btn>
              )}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] px-[var(--gutter)] py-2 text-[var(--fs-sm)]">
          <span className="text-[var(--ink-3)]">Đơn mua đã gửi NCC</span>
          <Pick
            label="Chọn đơn mua để đối chiếu"
            width={360}
            value={selectedId ?? ''}
            onChange={(v) =>
              router.push(v ? `/finance/hoa-don-ncc?don=${v}` : '/finance/hoa-don-ncc')
            }
            options={[
              { value: '', label: '— chọn đơn —' },
              ...pos.map((p) => ({
                value: p.id,
                label: `${p.code} · ${p.supplier_name}`,
              })),
            ]}
          />
          {current && (
            <a
              className="text-[var(--act)] underline"
              href={`/mua-hang/don/${current.id}`}
            >
              mở đơn mua
            </a>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {pos.length === 0 ? (
            /*
            Trạng thái rỗng phải nói LÝ DO và VIỆC TIẾP THEO. Ở đây lý do là thật
            và đáng nói thẳng: chưa đơn nào đi quá bước duyệt, nên chưa có gì để
            đối chiếu — đó là việc của phòng Cung ứng, không phải lỗi của trang.
          */
            <Empty
              headline="Chưa có đơn nào để đối chiếu"
              reason="Đối chiếu cần đơn ĐÃ GỬI nhà cung cấp. Hiện mọi đơn còn ở nháp hoặc chờ duyệt, nên chưa có hàng về và cũng chưa có hoá đơn nào."
              next={
                <>
                  <Btn primary href="/mua-hang/don">
                    Mở danh sách đơn mua
                  </Btn>
                  <Btn href="/finance/cong-no-ncc">Xem công nợ hiện tại</Btn>
                </>
              }
            />
          ) : !match || !current ? (
            <Empty
              headline="Chọn một đơn mua"
              reason={`Có ${pos.length} đơn đã gửi nhà cung cấp. Đối chiếu làm theo TỪNG ĐƠN vì tờ hoá đơn NCC đưa cũng thuộc về một đơn.`}
              next={<span className="text-[var(--ink-3)]">Chọn đơn ở ô trên.</span>}
            />
          ) : (
            <DoiChieuTable
              rows={match.rows}
              summary={match.summary}
              unlinkedAmount={match.unlinked_amount}
              currency={match.currency}
            />
          )}
        </div>
      </ScreenFrame>
    </div>
  )
}
