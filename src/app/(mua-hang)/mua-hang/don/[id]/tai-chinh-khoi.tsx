'use client'

import {
  FastTab,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  Td,
  Th,
} from '@/components/kit'
import { ChiPhiGrid } from './ChiPhiPanel'
import { dmyAt, fmtNum, money, signed } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/** Khối `blkPhatSinh` của màn chứng từ đơn mua. */
export function PhatSinh({ d }: { d: DonCtx }) {
  const { editing, po, adjustments, viewMode } = d
  return (
    <>
      {/* ══ 1c. TIỀN CỦA ĐƠN — bản duyệt + phát sinh sau duyệt (0210) ══════
            Chỉ có khi đơn từng được điều chỉnh. Kế toán đối chiếu hoá đơn theo
            tổng HIỆN HÀNH; các khoản phát sinh nói tiền tăng/giảm từ đâu — vì
            giá hay vì lượng — và đã tới NCC chưa. */}
      {!editing && po && adjustments.length > 0 && (
        <FastTab
          fixed={viewMode}
          id="phat-sinh"
          title="Tiền của đơn · bản duyệt và phát sinh"
          flush
          defaultOpen
          summary={[
            ['Lần điều chỉnh', <span key="a" className="num">{adjustments.length}</span>], // prettier-ignore
            ['Phát sinh', <span key="b" className="num">{signed(adjustments.at(-1)!.total_after - adjustments[0].total_before, po.currency)}</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={700}>
            <GridHead>
              <Th width={120}>Khoản</Th>
              <Th width={170}>Ngày · người</Th>
              <Th num>Tiền hàng</Th>
              <Th num>VAT</Th>
              <Th num>Tổng thanh toán</Th>
              <Th>Lý do · gửi NCC</Th>
            </GridHead>
            <GridBody>
              <GridRow>
                <Td>
                  <b>Bản duyệt</b>
                </Td>
                <Td>
                  {dmyAt(po.approved_at) || '—'} · {po.approver_name ?? '—'}
                </Td>
                <Td num>{money(adjustments[0].subtotal_before, po.currency)}</Td>
                <Td num>{money(adjustments[0].vat_before, po.currency)}</Td>
                <Td num>{money(adjustments[0].total_before, po.currency)}</Td>
                <Td>Tiền đã ký duyệt</Td>
              </GridRow>
              {adjustments.map((a) => (
                <GridRow key={a.seq}>
                  <Td>
                    <b>Phát sinh lần {a.seq}</b>
                  </Td>
                  <Td>
                    {dmyAt(a.created_at)} · {a.created_by_name ?? '—'}
                  </Td>
                  <Td num>{signed(a.subtotal_after - a.subtotal_before, a.currency)}</Td>
                  <Td num>{signed(a.vat_after - a.vat_before, a.currency)}</Td>
                  <Td num>{signed(a.total_after - a.total_before, a.currency)}</Td>
                  <Td>
                    {a.reason} ·{' '}
                    {a.sent_at ? (
                      `đã gửi NCC ${dmyAt(a.sent_at)}`
                    ) : (
                      <span className="k-t-warn">chưa gửi NCC</span>
                    )}
                  </Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={2}>Hiện hành — đối chiếu hoá đơn NCC theo dòng này</Td>
              <Td num>{money(adjustments.at(-1)!.subtotal_after, po.currency)}</Td>
              <Td num>{money(adjustments.at(-1)!.vat_after, po.currency)}</Td>
              <Td num>{money(adjustments.at(-1)!.total_after, po.currency)}</Td>
              <Td />
            </GridFoot>
          </Grid>
          <div className="px-[var(--gutter)] pt-3">
            <h3 className="k-fgrp-h">
              Chi tiết phát sinh theo dòng · tách vì giá và vì lượng
            </h3>
          </div>
          <Grid minWidth={720}>
            <GridHead>
              <Th width={44} num>
                Lần
              </Th>
              <Th>Mã · tên vật tư</Th>
              <Th width={90}>Loại</Th>
              <Th num>Cũ</Th>
              <Th num>Mới</Th>
              <Th num>Vì giá</Th>
              <Th num>Vì lượng</Th>
              <Th num>Cộng</Th>
            </GridHead>
            <GridBody>
              {adjustments.flatMap((a) =>
                a.lines.map((c, k) => (
                  <GridRow key={`${a.seq}-${k}`}>
                    <Td num>{a.seq}</Td>
                    <Td>
                      <span className="num k-strong">{c.code}</span>
                      {c.code ? ' · ' : ''}
                      {c.name}
                    </Td>
                    <Td>
                      {c.kind === 'added'
                        ? 'Dòng mới'
                        : c.kind === 'removed'
                          ? 'Bỏ dòng'
                          : c.by_price !== 0 && c.by_qty !== 0
                            ? 'Giá + lượng'
                            : c.by_price !== 0
                              ? 'Giá'
                              : c.by_qty !== 0
                                ? 'Lượng'
                                : 'Thông số'}{' '}
                      {/* prettier-ignore */}
                    </Td>
                    <Td num>
                      {c.qty_before == null
                        ? '—'
                        : `${fmtNum(c.qty_before)} × ${fmtNum(c.price_before ?? 0)}`}
                    </Td>
                    <Td num>
                      {c.qty_after == null
                        ? '—'
                        : `${fmtNum(c.qty_after)} × ${fmtNum(c.price_after ?? 0)}`}
                    </Td>
                    <Td num>{c.by_price ? signed(c.by_price, a.currency) : '—'}</Td>
                    <Td num>{c.by_qty ? signed(c.by_qty, a.currency) : '—'}</Td>
                    <Td num>{signed(c.amount_after - c.amount_before, a.currency)}</Td>
                  </GridRow>
                )),
              )}
            </GridBody>
            <GridFoot>
              <Td colSpan={5}>Cộng phát sinh tiền hàng (chưa VAT)</Td>
              <Td num>
                {signed(
                  adjustments.reduce((t, a) => t + a.delta_by_price, 0),
                  po.currency,
                )}
              </Td>
              <Td num>
                {signed(
                  adjustments.reduce((t, a) => t + a.delta_by_qty, 0),
                  po.currency,
                )}
              </Td>
              <Td num>
                {signed(
                  adjustments.reduce(
                    (t, a) => t + a.subtotal_after - a.subtotal_before,
                    0,
                  ),
                  po.currency,
                )}
              </Td>
            </GridFoot>
          </Grid>
        </FastTab>
      )}
    </>
  )
}

/** Khối `blkChiPhi` của màn chứng từ đơn mua. */
export function ChiPhi({ d }: { d: DonCtx }) {
  const {
    po,
    editing,
    costs,
    viewMode,
    costShare,
    busy,
    costWhy,
    setPhiOpen,
    setPhiVoid,
    router,
  } = d
  return (
    <>
      {/* ══ 1c. CHI PHÍ MUA HÀNG (0211) — phí vận chuyển / bốc xếp của đơn.
            Artboard 11a: sau Giao & nhận, vì phí phát sinh lúc hàng về. */}
      {po && !editing && (
        <FastTab
          // Phiếu đầu tiên vừa ghi thì mở khối ra — defaultOpen chỉ đọc lúc dựng.
          key={costs.length > 0 ? 'chi-phi-co' : 'chi-phi-rong'}
          fixed={viewMode}
          id="chi-phi"
          title="Chi phí mua hàng"
          flush
          defaultOpen={viewMode || costs.length > 0}
          summary={[
            [
              'Phiếu',
              <span key="a" className="num">
                {costs.length}
              </span>,
            ],
            ['Phần của đơn · chưa VAT', <span key="b" className="num">{money(costShare, po.currency)}</span>], // prettier-ignore
          ]}
          actions={
            <GridBtn
              disabled={busy || !!costWhy}
              title={costWhy ?? 'Ghi phí vận chuyển / bốc xếp cho đơn này'}
              onClick={() => setPhiOpen(true)}
            >
              + Ghi phí
            </GridBtn>
          }
        >
          <ChiPhiGrid
            costs={costs}
            poId={po.id}
            currency={po.currency}
            canRecord={!costWhy}
            onRecord={() => setPhiOpen(true)}
            onVoid={(c) => setPhiVoid(c)}
            onOpenPo={(id) => router.push(`/mua-hang/don/${id}`)}
          />
        </FastTab>
      )}
    </>
  )
}
