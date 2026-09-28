'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Crumb,
  Empty,
  Field,
  FieldGrid,
  FilterBar,
  MasterWarn,
  Metric,
  MetricStrip,
  NoticeBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  Sheet,
  SheetActions,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  TextArea,
  TextInput,
  Tick,
  showMoney,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { CARRIER_KIND_LABEL, type CarrierKind } from '@/lib/po-cost'
import type { Carrier } from '@/modules/dept/supply/po-costs.repo'
import { HuyPhiSheet } from '../../../don/[id]/ChiPhiPanel'
import { GhiPhiSheet } from '../../GhiPhiSheet'
import {
  costMoneyState,
  costStateTag,
  daysSince,
  dmy,
  payerLabel,
  sumByCurrency,
  type CostRow,
} from '../../van-chuyen.shared'

type Payer = { id: string; name: string }
const PAY_LABEL: Record<string, string> = { ck: 'Chuyển khoản', tien_mat: 'Tiền mặt' }
const tien = (sum: Record<string, number>) =>
  Object.entries(sum)
    .filter(([, v]) => v > 0)
    .map(
      ([cur, v]) =>
        `${showMoney(v, { digits: cur === 'VND' ? 0 : 2 })} ${cur === 'VND' ? '₫' : cur}`,
    ) // prettier-ignore
    .join(' · ')

/* ══ Sửa hồ sơ ngắn ═════════════════════════════════════════════════════════ */
function SuaDonViSheet({
  c,
  onClose,
  onSaved,
}: {
  c: Carrier
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    name: c.name,
    phone: c.phone ?? '',
    contact_name: c.contact_name ?? '',
    carrier_kind: c.carrier_kind as CarrierKind,
    address: c.address ?? '',
    pay_method: c.pay_method ?? '',
    payment_terms: c.payment_terms ?? '',
    note: c.note ?? '',
    is_active: c.is_active,
  })
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  async function save() {
    setBusy(true)
    try {
      const s = (x: string) => x.trim() || null
      await api(`/api/dept/supply/po-costs/carriers/${c.id}`, {
        method: 'PATCH',
        body: {
          name: f.name.trim(),
          phone: s(f.phone),
          contact_name: s(f.contact_name),
          carrier_kind: f.carrier_kind,
          address: s(f.address),
          pay_method: f.pay_method || null,
          payment_terms: s(f.payment_terms),
          note: s(f.note),
          is_active: f.is_active,
        },
      })
      toast.success('Đã lưu hồ sơ', f.name)
      onClose()
      onSaved()
    } catch (e) {
      toast.error('Lưu không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Sửa hồ sơ đơn vị vận chuyển"
      subtitle={c.name}
      stakes="nhe"
      width={520}
      footer={
        <SheetActions stakes="nhe" busy={busy} disabled={f.name.trim().length < 2} onCancel={onClose} onConfirm={() => void save()} confirmLabel="Lưu hồ sơ" /> // prettier-ignore
      }
    >
      <FieldGrid>
        <Field label="Tên đơn vị">
          <TextInput value={f.name} onCommit={set('name')} label="Tên đơn vị" />
        </Field>
        <Field label="Loại">
          <Pick
            label="Loại đơn vị"
            value={f.carrier_kind}
            onChange={(v) => set('carrier_kind')(v)}
            options={Object.entries(CARRIER_KIND_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Field>
        <Field label="Số điện thoại">
          <TextInput value={f.phone} onCommit={set('phone')} label="Số điện thoại" mono />
        </Field>
        <Field label="Người liên hệ">
          <TextInput
            value={f.contact_name}
            onCommit={set('contact_name')}
            label="Người liên hệ"
          />
        </Field>
        <Field label="Bãi / địa chỉ">
          <TextInput value={f.address} onCommit={set('address')} label="Bãi / địa chỉ" />
        </Field>
        <Field label="Hình thức trả">
          <Pick
            label="Hình thức trả"
            value={f.pay_method}
            onChange={set('pay_method')}
            options={[
              { value: '', label: '— chưa khai —' },
              { value: 'ck', label: 'Chuyển khoản' },
              { value: 'tien_mat', label: 'Tiền mặt' },
            ]}
          />
        </Field>
        <Field label="Điều khoản">
          <TextInput
            value={f.payment_terms}
            onCommit={set('payment_terms')}
            label="Điều khoản"
            placeholder="trống = theo chuyến (mặc định)"
          />
        </Field>
        <Field label="Đang dùng">
          <span className="flex items-center gap-2">
            <Tick
              label="Đơn vị đang dùng"
              checked={f.is_active}
              onChange={(v) => setF((s) => ({ ...s, is_active: v }))}
            />
            <span className="text-k-sm text-[var(--ink-2)]">
              bỏ tick = ngừng dùng, không hiện ở ô chọn trên phiếu
            </span>
          </span>
        </Field>
      </FieldGrid>
      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={f.note}
        onChange={set('note')}
        rows={3}
        placeholder="Điều cần nhớ khi gọi xe"
      />
    </Sheet>
  )
}

/* ══ Hồ sơ ══════════════════════════════════════════════════════════════════ */
export function HoSoDonViScreen({
  carrier: c,
  costs,
  today,
  canRecord,
  me,
  payers,
}: {
  carrier: Carrier
  costs: CostRow[]
  today: string
  canRecord: boolean
  me: Payer
  payers: Payer[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<'phieu' | 'don'>('phieu')
  const [sua, setSua] = useState(false)
  const [ghi, setGhi] = useState(false)
  const [huy, setHuy] = useState<CostRow | null>(null)
  const [busy, setBusy] = useState(false)

  const live = useMemo(() => costs.filter((x) => !x.voided_at), [costs])
  const recent = live.filter((x) => daysSince(x.cost_date, today) <= 30)
  const choTra = live.filter((x) => costMoneyState(x) === 'cho_tra')
  const chiHo = live.filter((x) => costMoneyState(x) === 'chi_ho')
  const oldest = choTra.reduce((m, x) => Math.max(m, daysSince(x.cost_date, today)), 0)
  const total = (x: CostRow) => x.total
  const pos = useMemo(() => {
    const m = new Map<string, { po_id: string; po_code: string | null; supplier: string | null; n: number; last: string }>() // prettier-ignore
    for (const x of live)
      for (const a of x.allocations) {
        const cur = m.get(a.po_id)
        if (cur) {
          cur.n++
          if (x.cost_date > cur.last) cur.last = x.cost_date
        } else m.set(a.po_id, { po_id: a.po_id, po_code: a.po_code, supplier: a.po_supplier_name, n: 1, last: x.cost_date }) // prettier-ignore
      }
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last))
  }, [live])

  async function call(url: string, body: unknown, ok: string): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method: 'POST', body })
      toast.success(ok)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Không ghi được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame>
      <Crumb
        path={['Mua hàng', { label: 'Vận chuyển', href: '/mua-hang/van-chuyen' }, { label: 'Đơn vị', href: '/mua-hang/van-chuyen/don-vi' }, c.name]} // prettier-ignore
      />
      <ScreenHeader
        compact
        eyebrow={[
          'Đơn vị vận chuyển',
          CARRIER_KIND_LABEL[c.carrier_kind].toLowerCase(),
          c.payment_terms ? c.payment_terms : 'trả theo chuyến',
        ].join(' · ')}
        title={
          <span className="flex items-center gap-2">
            {c.name}
            {c.code && (
              <span className="num text-k-label text-[var(--ink-3)]">{c.code}</span>
            )}
            {!c.is_active && <Tag tone="warn">Ngừng dùng</Tag>}
          </span>
        }
        actions={
          <>
            <Btn
              icon="sua"
              onClick={() => setSua(true)}
              blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
            >
              Sửa hồ sơ
            </Btn>
            <Btn icon="tien" blockedBy="Kế toán">
              Trả tiền
            </Btn>
            <Btn
              icon="tien"
              primary
              onClick={() => setGhi(true)}
              blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
            >
              Ghi phiếu phí
            </Btn>
          </>
        }
      />

      <MetricStrip>
        <Metric
          label="Chuyến 30 ngày"
          value={String(recent.length)}
          basis={`${live.length} phiếu còn hiệu lực · chở ${pos.length} đơn`}
        />
        <Metric
          label="Phí 30 ngày"
          value={recent.length ? tien(sumByCurrency(recent, total)) : null}
          basis="gồm VAT · cộng riêng từng loại tiền"
        />
        <Metric
          label="Chờ trả"
          value={choTra.length ? tien(sumByCurrency(choTra, total)) : '0'}
          tone={oldest > 7 ? 'stop' : choTra.length ? 'warn' : undefined}
          basis={choTra.length ? `${choTra.length} phiếu · trả theo chuyến → lâu nhất ${oldest} ngày` : 'không phiếu nào chờ Kế toán'} // prettier-ignore
        />
        <Metric
          label="Trả đúng hẹn"
          value={null}
          basis="tính khi Kế toán ghi phiếu chi cho đơn vị này (bước 2)"
        />
        <Metric
          label="Chi hộ"
          value={String(chiHo.length)}
          basis={
            chiHo.length
              ? `${tien(sumByCurrency(chiHo, total))} chờ Kế toán hoàn`
              : 'chưa ai trả tại chỗ cho đơn vị này'
          }
        />
      </MetricStrip>

      <MasterWarn
        used={
          <>
            <b>{live.length} phiếu phí</b> còn hiệu lực · <b>{pos.length} đơn</b> đã chở
            {live[0] && <> · chuyến gần nhất {dmy(live[0].cost_date)}</>}
          </>
        }
      />

      {choTra.length > 0 && (
        <NoticeBar
          tag={oldest > 7 ? 'Trễ' : 'Đến hạn'}
          tone={oldest > 7 ? 'stop' : 'warn'}
          action={{ label: 'Xem phiếu', onClick: () => setTab('phieu') }}
        >
          {choTra.length} phiếu {tien(sumByCurrency(choTra, total))} chờ Kế toán trả — trả
          theo chuyến nên đến hạn từ ngày chuyến, lâu nhất đã <b>{oldest} ngày</b>. Đơn vị
          vẫn chở chuyến mới; cần trả gấp thì nhắc Kế toán ở Trao đổi của đơn.
        </NoticeBar>
      )}

      <div className="px-[var(--gutter)] pt-2">
        <div className="k-sec">Thanh toán &amp; liên hệ</div>
        <FieldGrid>
          <Field label="Điều khoản">
            <span>
              {c.payment_terms ?? 'Theo chuyến'}{' '}
              <span className="k-t-mut">· mặc định công ty</span>
            </span>
          </Field>
          <Field label="Hình thức trả">
            <span className={c.pay_method ? undefined : 'k-t-mut'}>
              {c.pay_method ? PAY_LABEL[c.pay_method] : 'chưa khai (CK / tiền mặt)'}
            </span>
          </Field>
          <Field label="Người liên hệ">
            <span>
              {c.contact_name ?? '—'}
              {c.phone && (
                <>
                  {' '}
                  · <span className="num">{c.phone}</span>
                </>
              )}
            </span>
          </Field>
          <Field label="Bãi / địa chỉ">
            <span className={c.address ? undefined : 'k-t-mut'}>
              {c.address ?? 'chưa khai'}
            </span>
          </Field>
          <Field label="Loại">
            <span>{CARRIER_KIND_LABEL[c.carrier_kind]}</span>
          </Field>
          <Field label="Ghi chú">
            <span className={c.note ? undefined : 'k-t-mut'}>{c.note ?? '—'}</span>
          </Field>
        </FieldGrid>
      </div>

      <FilterBar>
        <Chip
          icon="tien"
          on={tab === 'phieu'}
          count={costs.length}
          onClick={() => setTab('phieu')}
        >
          Phiếu phí
        </Chip>
        <Chip
          icon="don"
          on={tab === 'don'}
          count={pos.length}
          onClick={() => setTab('don')}
        >
          Đơn đã chở
        </Chip>
      </FilterBar>

      {tab === 'phieu' ? (
        costs.length === 0 ? (
          <Empty
            headline="Chưa ghi phiếu phí nào cho đơn vị này."
            reason="Hồ sơ đã khai nhưng chưa chuyến nào qua hệ thống — bình thường với đơn vị mới hoặc dự phòng, không phải dữ liệu thiếu."
            next={
              <Btn
                icon="tien"
                primary
                onClick={() => setGhi(true)}
                blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
              >
                Ghi phiếu phí đầu tiên
              </Btn>
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Ngày</th>
              <th>Số phiếu</th>
              <th>Chở đơn</th>
              <th style={{ textAlign: 'right' }}>Tiền chưa VAT</th>
              <th style={{ textAlign: 'right' }}>VAT</th>
              <th style={{ textAlign: 'right' }}>Tổng</th>
              <th>Ai trả</th>
              <th>Tiền</th>
              <th style={{ width: 44 }}></th>
            </THead>
            <tbody>
              {costs.map((x) => {
                const st = costStateTag(x, today)
                const p = payerLabel(x)
                return (
                  <Row key={x.id}>
                    <Cell pin>
                      <span className="num">{dmy(x.cost_date)}</span>
                    </Cell>
                    <Cell>
                      <span className="num">{x.doc_no ?? '—'}</span>
                      <span className="text-k-label block text-[var(--ink-3)]">
                        ghi: {x.created_by_name ?? '—'}
                      </span>
                    </Cell>
                    <Cell grow>
                      {x.allocations.map((a, i) => (
                        <span key={a.po_id}>
                          {i > 0 && ' · '}
                          <Code as="a" href={`/mua-hang/don/${a.po_id}`}>
                            {(a.po_code ?? '?').replace(/^PO-\d{4}-/, '')}
                          </Code>
                        </span>
                      ))}
                      <span className="text-k-label block text-[var(--ink-3)]">
                        {[
                          ...new Set(
                            x.allocations.map((a) => a.po_supplier_name).filter(Boolean),
                          ),
                        ].join(', ')}
                        {x.allocations.length > 1
                          ? ` · chia ${x.allocations.map((a) => showMoney(a.amount, { digits: 0 })).join(' · ')}`
                          : ''}
                      </span>
                    </Cell>
                    <Cell num>
                      <Num
                        value={showMoney(x.amount, {
                          digits: x.currency === 'VND' ? 0 : 2,
                        })}
                        muted={!!x.voided_at}
                      />
                    </Cell>
                    <Cell num muted>
                      {x.vat_rate == null || x.vat_rate === 0
                        ? 'không VAT'
                        : `${x.vat_rate}% · ${showMoney(x.vat_amount, { digits: 0 })}`}
                    </Cell>
                    <Cell num>
                      <Num
                        value={showMoney(x.total, {
                          digits: x.currency === 'VND' ? 0 : 2,
                        })}
                        strong={!x.voided_at}
                        muted={!!x.voided_at}
                      />
                    </Cell>
                    <Cell>
                      {p.who}
                      {p.how && (
                        <span className="text-k-label block text-[var(--ink-3)]">
                          {p.how}
                        </span>
                      )}
                    </Cell>
                    <Cell>
                      <Tag tone={st.tone}>{st.label}</Tag>
                      {x.voided_at && (
                        <span className="text-k-label block text-[var(--ink-3)]">
                          “{x.void_reason}”
                        </span>
                      )}
                    </Cell>
                    <Cell>
                      {!x.voided_at && canRecord && (
                        <Btn
                          icon="huy"
                          onClick={() => setHuy(x)}
                          aria-label={`Huỷ phiếu ${x.doc_no ?? dmy(x.cost_date)}`}
                        >
                          Huỷ
                        </Btn>
                      )}
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
            <TFoot
              label={<td colSpan={3}>Cộng {live.length} phiếu còn hiệu lực</td>}
              cells={
                <>
                  <td className="num">{tien(sumByCurrency(live, (x) => x.amount))}</td>
                  <td className="num">
                    {tien(sumByCurrency(live, (x) => x.vat_amount)) || '0'}
                  </td>
                  <td className="num">{tien(sumByCurrency(live, total))}</td>
                </>
              }
              caveatSpan={3}
              caveat="Chưa gồm phiếu huỷ · phiếu nhà xe là chứng từ đòi tiền nên nợ theo tổng gồm VAT · chi hộ không vào nợ đơn vị."
            />
          </Table>
        )
      ) : pos.length === 0 ? (
        <Empty headline="Chưa chở đơn nào" reason="Đơn hiện ở đây khi có phiếu phí gắn nó." next={<Btn icon="tien" onClick={() => setTab('phieu')}>Xem phiếu phí</Btn>} /> // prettier-ignore
      ) : (
        <Table>
          <THead pinFirst>
            <th>Đơn</th>
            <th>NCC</th>
            <th style={{ textAlign: 'right' }}>Số chuyến</th>
            <th>Chuyến gần nhất</th>
          </THead>
          <tbody>
            {pos.map((p) => (
              <Row key={p.po_id}>
                <Cell pin>
                  <Code as="a" href={`/mua-hang/don/${p.po_id}`}>
                    {p.po_code ?? '?'}
                  </Code>
                </Cell>
                <Cell grow muted>
                  {p.supplier ?? '—'}
                </Cell>
                <Cell num>
                  <Num value={String(p.n)} />
                </Cell>
                <Cell muted>
                  <span className="num">{dmy(p.last)}</span>
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={2}>Cộng {pos.length} đơn</td>}
            cells={<td className="num">{pos.reduce((s, p) => s + p.n, 0)}</td>}
            caveatSpan={1}
            caveat="Đếm theo phiếu còn hiệu lực."
          />
        </Table>
      )}

      {sua && (
        <SuaDonViSheet
          c={c}
          onClose={() => setSua(false)}
          onSaved={() => router.refresh()}
        />
      )}
      {ghi && (
        <GhiPhiSheet
          po={null}
          presetCarrierId={c.id}
          me={me}
          payers={payers}
          busy={busy}
          onClose={() => setGhi(false)}
          onSubmit={(body) =>
            call('/api/dept/supply/po-costs', body, 'Đã ghi phiếu chi phí')
          }
        />
      )}
      {
        huy &&
        <HuyPhiSheet cost={huy} busy={busy} onClose={() => setHuy(null)} onSubmit={(reason) => call(`/api/dept/supply/po-costs/${huy.id}/void`, { reason }, 'Đã huỷ phiếu')} /> // prettier-ignore
      }

      <StatusBar
        left={[
          c.phone ? `ĐT ${c.phone}` : 'Chưa có số điện thoại',
          c.address ?? 'Chưa khai bãi',
        ]}
        right={`${live.length} phiếu · ${pos.length} đơn${choTra.length ? ` · chờ trả ${tien(sumByCurrency(choTra, total))}` : ''}`}
      />
    </ScreenFrame>
  )
}
