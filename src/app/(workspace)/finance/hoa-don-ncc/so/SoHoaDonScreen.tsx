'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  Empty,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  Tag,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export type SoHoaDonRow = {
  id: string
  invoice_no: string
  supplier_name: string | null
  invoice_date: string
  due_date: string | null
  currency: string
  subtotal: number
  vat_amount: number
  total: number
  status: 'draft' | 'posted' | 'cancelled'
  is_overdue: boolean
  note: string | null
}

const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

const STATUS: Record<
  SoHoaDonRow['status'],
  { label: string; tone: 'warn' | 'done' | 'stop' }
> = {
  draft: { label: 'Nháp', tone: 'warn' },
  posted: { label: 'Đã vào sổ', tone: 'done' },
  cancelled: { label: 'Đã huỷ', tone: 'stop' },
}

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'draft', label: 'Nháp — chưa sinh công nợ' },
  { id: 'posted', label: 'Đã vào sổ' },
  { id: 'cancelled', label: 'Đã huỷ' },
] as const

/**
 * SỔ HOÁ ĐƠN NHÀ CUNG CẤP (0188) — chỗ duy nhất thấy được tờ hoá đơn sau khi lập.
 *
 * Vì sao phải có: màn nhập (`/finance/hoa-don-ncc/moi`) lưu ra **nháp**, và nháp
 * thì chưa sinh công nợ. Không có màn này thì tờ vừa lập biến mất — không ai
 * thấy, không ai bấm "Vào sổ" được, và sổ TK 331 vĩnh viễn trống trong khi hoá
 * đơn chất đống trong bảng. Đúng cái bẫy mà `/finance/invoices` (sổ hoá đơn CŨ,
 * bảng khác, `party_name` chữ tự do) không đỡ được: hai bảng khác nhau.
 *
 * ⭐ "VÀO SỔ" LÀ HÀNH ĐỘNG SINH CÔNG NỢ. Nó tách khỏi việc Lưu có chủ ý — lưu là
 * ghi nháp cho mình, vào sổ là nhận nghĩa vụ trả tiền. Gộp hai việc thì mỗi lần
 * gõ dở nửa chừng là công nợ công ty đổi.
 */
export function SoHoaDonScreen({
  rows,
  highlightId,
  canManage,
}: {
  rows: SoHoaDonRow[]
  highlightId: string | null
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const drafts = rows.filter((r) => r.status === 'draft')

  /** Tổng theo TIỀN TỆ — không bao giờ cộng lẫn. Chỉ cộng tờ ĐÃ VÀO SỔ. */
  const byCcy = new Map<string, number>()
  for (const r of shown) {
    if (r.status !== 'posted') continue
    byCcy.set(r.currency, (byCcy.get(r.currency) ?? 0) + r.total)
  }

  async function act(id: string, action: 'post' | 'unpost'): Promise<void> {
    if (busy) return
    setBusy(id)
    try {
      await api(`/api/dept/accounting/supplier-invoices/${id}/post`, {
        method: 'POST',
        body: { action },
      })
      toast.success(
        action === 'post'
          ? 'Đã vào sổ — tờ này giờ nằm trong công nợ TK 331 và bảng tuổi nợ'
          : 'Đã mở lại — tờ này ra khỏi công nợ, sửa được',
      )
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Tài chính · Kế toán"
          title="Sổ hoá đơn nhà cung cấp"
          actions={
            <>
              <Btn href="/finance/hoa-don-ncc">Đối chiếu · lập tờ mới</Btn>
              <Btn href="/finance/so-cong-no">Sổ công nợ TK 331</Btn>
            </>
          }
        />

        {/*
          Nháp KHÔNG nằm trong công nợ. Nói ra ở đầu màn, vì đây đúng là chỗ tờ
          giấy hay mắc kẹt: người lập tưởng lưu xong là xong.
        */}
        {drafts.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Chưa vào sổ"
            action={{ label: 'Lọc nháp', onClick: () => setFilter('draft') }}
          >
            <b>{drafts.length}</b> tờ đang ở dạng nháp — <b>chưa</b> sinh công nợ, chưa
            vào sổ TK 331, chưa có tuổi nợ. Soát xong thì bấm <b>Vào sổ</b> trên từng tờ.
          </NoticeBar>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] px-[var(--gutter)] py-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              on={filter === f.id}
              onClick={() => setFilter(f.id)}
              count={
                f.id === 'all'
                  ? rows.length
                  : rows.filter((r) => r.status === f.id).length
              }
            >
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {shown.length === 0 ? (
            <Empty
              headline={
                rows.length === 0
                  ? 'Chưa có hoá đơn nhà cung cấp nào'
                  : 'Không tờ nào ở trạng thái này'
              }
              reason={
                rows.length === 0
                  ? 'Hoá đơn NCC được lập TỪ đơn mua để đối chiếu ba chiều chạy được. Chọn đơn ở màn đối chiếu rồi bấm "Nhập hoá đơn".'
                  : 'Bộ lọc đang thu hẹp danh sách. Bấm "Tất cả" để xem hết.'
              }
              next={
                rows.length === 0 ? (
                  <Btn primary href="/finance/hoa-don-ncc">
                    Mở màn đối chiếu
                  </Btn>
                ) : (
                  <Btn onClick={() => setFilter('all')}>Xem tất cả</Btn>
                )
              }
            />
          ) : (
            <Grid minWidth={1120}>
              <GridHead>
                <Th>Số hoá đơn</Th>
                <Th>Nhà cung cấp</Th>
                <Th width={96}>Ngày HĐ</Th>
                <Th width={110}>Hạn TT</Th>
                <Th width={56}>TT</Th>
                <Th num>Tiền hàng</Th>
                <Th num>VAT</Th>
                <Th num>Tổng</Th>
                <Th width={96}>Trạng thái</Th>
                <Th width={150} />
              </GridHead>
              <GridBody>
                {shown.map((r) => (
                  <GridRow key={r.id} selected={r.id === highlightId}>
                    <Td>
                      <span className="num k-strong">{r.invoice_no}</span>
                      {r.note && (
                        <div className="max-w-64 truncate text-[11px] text-[var(--ink-3)]">
                          {r.note}
                        </div>
                      )}
                    </Td>
                    <Td>{r.supplier_name ?? '—'}</Td>
                    <Td>
                      <span className="num">{dmy(r.invoice_date)}</span>
                    </Td>
                    {/*
                      Thiếu hạn KHÔNG phải "chưa đến hạn" — nó rơi vào rổ riêng
                      của bảng tuổi nợ và làm mọi rổ quá hạn trông nhỏ đi.
                    */}
                    <Td tone={r.is_overdue ? 'stop' : undefined}>
                      {r.due_date ? (
                        <span className="num">
                          {dmy(r.due_date)}
                          {r.is_overdue && ' · quá hạn'}
                        </span>
                      ) : (
                        <span className="k-t-warn">chưa khai hạn</span>
                      )}
                    </Td>
                    <Td>
                      <span className="num">{r.currency}</span>
                    </Td>
                    <Td num>{money(r.subtotal, r.currency)}</Td>
                    <Td num>{r.vat_amount ? money(r.vat_amount, r.currency) : '—'}</Td>
                    <Td num>
                      <b>{money(r.total, r.currency)}</b>
                    </Td>
                    <Td>
                      <Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag>
                    </Td>
                    <Td>
                      {canManage && r.status === 'draft' && (
                        <GridBtn
                          disabled={busy === r.id}
                          onClick={() => act(r.id, 'post')}
                          title="Vào sổ — tờ này sẽ sinh công nợ TK 331"
                        >
                          {busy === r.id ? 'Đang…' : 'Vào sổ'}
                        </GridBtn>
                      )}
                      {canManage && r.status === 'posted' && (
                        <GridBtn
                          disabled={busy === r.id}
                          onClick={() => act(r.id, 'unpost')}
                          title="Mở lại — tờ này ra khỏi công nợ để sửa"
                        >
                          {busy === r.id ? 'Đang…' : 'Mở lại'}
                        </GridBtn>
                      )}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td colSpan={7}>Cộng các tờ ĐÃ VÀO SỔ trong danh sách đang xem</Td>
                <Td num>
                  {byCcy.size === 0
                    ? '—'
                    : [...byCcy].map(([c, v]) => `${money(v, c)} ${c}`).join(' · ')}
                </Td>
                <Td />
                <Td />
              </GridFoot>
            </Grid>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              'Nháp = đã gõ xong nhưng CHƯA sinh công nợ. Chỉ tờ ĐÃ VÀO SỔ mới vào TK 331, tuổi nợ và đối chiếu ba chiều',
              '"Vào sổ" tách khỏi "Lưu" có chủ ý: lưu là ghi nháp cho mình, vào sổ là nhận nghĩa vụ trả tiền',
              'Mở lại đưa tờ ra khỏi công nợ để sửa — số công nợ sẽ đổi ngay, nên chỉ mở khi thật sự cần',
              'Chân bảng cộng theo TỪNG tiền tệ, chỉ cộng tờ đã vào sổ — nháp không phải nợ',
              'Hoá đơn thiếu hạn thanh toán KHÔNG phải "chưa đến hạn": nó rơi vào rổ riêng của bảng tuổi nợ',
            ]}
            result={
              byCcy.size === 0
                ? 'chưa có tờ nào vào sổ'
                : [...byCcy].map(([c, v]) => `${money(v, c)} ${c}`).join(' · ')
            }
          />
        </div>
      </ScreenFrame>
    </div>
  )
}
