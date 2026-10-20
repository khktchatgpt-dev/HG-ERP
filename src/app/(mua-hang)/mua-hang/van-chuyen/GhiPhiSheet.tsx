'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Btn,
  Combobox,
  DateInput,
  Field,
  FieldGroup,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  NumInput,
  Pick,
  ScopeSwitch,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  TextInput,
  Th,
  Tick,
  WhyBox,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import {
  allocateCost,
  costMoney,
  PAID_METHOD_LABEL,
  TRANSPORT_MODE_LABEL,
  type PaidMethod,
  type TransportMode,
} from '@/lib/po-cost'
import { fmtMoney } from '@/lib/po-line'
import type { Carrier } from '@/modules/dept/supply/po-costs.repo'
import type { CostCandidate } from '@/modules/dept/supply/po-costs.service'

/**
 * HỘP GHI PHIẾU CHI PHÍ VẬN CHUYỂN (0211 + 0215, artboard 13d — duyệt 28/09/2026).
 *
 * Một phiếu = một chuyến. Ba câu hỏi theo thứ tự người ghi trả lời:
 *   1. Chuyến — hình thức (nhà xe · chành / ship lẻ / NCC tự giao), ai thu,
 *      ngày, tiền. Ship lẻ gõ tay tên + SĐT, không cần hồ sơ.
 *   2. Ai trả — chưa trả (Kế toán trả theo chuyến, vào công nợ đơn vị) hay đã
 *      trả tại chỗ (chi hộ → Kế toán hoàn cho người trả, KHÔNG vào công nợ).
 *   3. Chở đơn nào — gợi ý cùng bãi, máy chia phí theo tiền hàng.
 *
 * Mở được từ HAI chỗ: trên đơn (đơn đang mở khoá sẵn trong chuyến) và từ sổ
 * chuyến (chọn đơn bằng ô tìm). Không sửa, không xoá: sai thì huỷ kèm lý do.
 */

type Payer = { id: string; name: string }
type PayMode = 'ke_toan' | 'tai_cho'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const m = (v: number, cur: string) => fmtMoney(v, cur)

export function GhiPhiSheet({
  po,
  presetCarrierId,
  me,
  payers,
  busy,
  onClose,
  onSubmit,
}: {
  /** Đơn đang mở — khoá sẵn trong chuyến. Bỏ trống khi ghi từ sổ chuyến. */
  po?: { id: string; code: string; supplierId: string; supplierName: string } | null
  /** Ghi từ hồ sơ một đơn vị — chọn sẵn đơn vị đó. */
  presetCarrierId?: string
  me: Payer
  /** Người có thể đã trả tại chỗ — mọi người dùng đang hoạt động; `me` đứng đầu. */
  payers: Payer[]
  busy: boolean
  onClose: () => void
  onSubmit: (body: unknown) => Promise<boolean>
}) {
  const [mode, setMode] = useState<TransportMode>('nha_xe')
  const [carrierId, setCarrierId] = useState(presetCarrierId ?? '')
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addErr, setAddErr] = useState<string | null>(null)
  const [payeeName, setPayeeName] = useState('')
  const [payeePhone, setPayeePhone] = useState('')
  const [saveToCatalog, setSaveToCatalog] = useState(false)
  const [date, setDate] = useState(() => todayVn())
  const [docNo, setDocNo] = useState('')
  const [amount, setAmount] = useState('')
  const [vat, setVat] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<PayMode>('ke_toan')
  const [paidBy, setPaidBy] = useState(me.id)
  const [paidMethod, setPaidMethod] = useState<PaidMethod>('tien_mat')
  const [paidOn, setPaidOn] = useState(() => todayVn())
  const [mine, setMine] = useState<CostCandidate | null>(null)
  const [suggested, setSuggested] = useState<CostCandidate[]>([])
  const [found, setFound] = useState<CostCandidate[]>([])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Map<string, CostCandidate>>(new Map())
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      api<{ po: CostCandidate | null; suggested: CostCandidate[] }>(
        `/api/dept/supply/po-costs/candidates${po ? `?po_id=${po.id}` : ''}`,
      ),
      api<{ carriers: Carrier[] }>('/api/dept/supply/po-costs/carriers'),
    ])
      .then(([c, k]) => {
        if (!live) return
        setMine(c.po)
        setSuggested(c.suggested)
        setCarriers(k.carriers)
      })
      .catch((e) => live && setLoadErr(apiErrorText(e)))
    return () => {
      live = false
    }
  }, [po])

  // Ship lẻ hầu như luôn trả tại chỗ; nhà xe / NCC thì Kế toán trả — mồi theo
  // hình thức, người dùng vẫn đổi được.
  function changeMode(v: TransportMode) {
    setMode(v)
    setPay(v === 'ship_le' ? 'tai_cho' : 'ke_toan')
  }

  async function search(v: string) {
    setQ(v)
    if (!v.trim()) return setFound([])
    try {
      const r = await api<{ found: CostCandidate[] }>(
        `/api/dept/supply/po-costs/candidates?${po ? `po_id=${po.id}&` : ''}q=${encodeURIComponent(v.trim())}`,
      )
      setFound(r.found)
    } catch (e) {
      setLoadErr(apiErrorText(e))
    }
  }

  async function addCarrier() {
    setAddErr(null)
    try {
      const r = await api<{ carrier: Carrier }>('/api/dept/supply/po-costs/carriers', {
        method: 'POST',
        body: { name: newName, phone: newPhone || null, carrier_kind: 'nha_xe' },
      })
      setCarriers((cs) =>
        cs.some((c) => c.id === r.carrier.id) ? cs : [...cs, r.carrier],
      )
      setCarrierId(r.carrier.id)
      setAdding(false)
      setNewName('')
      setNewPhone('')
    } catch (e) {
      setAddErr(apiErrorText(e))
    }
  }

  const toggle = (c: CostCandidate, on: boolean) =>
    setPicked((s) => {
      const n = new Map(s)
      if (on) n.set(c.id, c)
      else n.delete(c.id)
      return n
    })

  const trip = useMemo(() => (mine ? [mine, ...picked.values()] : [...picked.values()]), [mine, picked]) // prettier-ignore
  const currency = trip[0]?.currency ?? 'VND'
  const amt = Number(amount) || 0
  const money = costMoney(amt, vat === '' ? null : Number(vat), currency)
  const alloc = useMemo(
    () => allocateCost(money.amount, trip.map((t) => ({ po_id: t.id, base: t.base })), currency), // prettier-ignore
    [money.amount, trip, currency],
  )
  const sumBase = trip.reduce((s, t) => s + t.base, 0)
  const mineAlloc = alloc[0]

  const payeeId =
    mode === 'nha_xe' ? carrierId : mode === 'ncc' ? (po?.supplierId ?? '') : ''
  const payeeText = mode === 'ship_le' ? payeeName.trim() : ''

  const problems = [
    mode === 'nha_xe' && !carrierId && 'chưa chọn nhà xe / chành',
    mode === 'ship_le' && !payeeText && 'chưa ghi người / đơn vị ship',
    mode === 'ncc' && !po && 'NCC tự giao thì ghi từ đơn của NCC đó',
    !(amt > 0) && 'chưa ghi tiền phí',
    !date && 'chưa ghi ngày chuyến',
    trip.length === 0 && 'chưa chọn đơn nào',
    trip.some((t) => t.currency !== currency) && 'có đơn khác tiền tệ — tách phiếu riêng',
    pay === 'tai_cho' && !paidBy && 'chưa chọn người trả',
    pay === 'tai_cho' && !paidOn && 'chưa ghi ngày trả',
    mode === 'ship_le' &&
      pay === 'ke_toan' &&
      !saveToCatalog &&
      'chưa trả thì tick "Lưu vào danh mục" để Kế toán biết trả ai',
  ].filter(Boolean) as string[]
  const canSend = !busy && problems.length === 0

  const payerOptions = [
    { value: me.id, label: `${me.name} (tôi)` },
    ...payers.filter((p) => p.id !== me.id).map((p) => ({ value: p.id, label: p.name })),
  ]

  const cand = (c: CostCandidate, checked: boolean, locked = false) => {
    const other = c.currency !== currency
    return (
      <GridRow key={c.id}>
        <Td>
          <Tick
            label={`Chọn ${c.code}`}
            checked={checked}
            disabled={locked || other}
            onChange={(v) => toggle(c, v)}
          />
        </Td>
        <Td>
          <span className="num k-strong">{c.code}</span>
        </Td>
        <Td>
          {c.supplier_name ?? '—'}
          {other && (
            <span className="text-k-sm k-t-mut">
              · khác tiền tệ ({c.currency}) — ghi phiếu riêng
            </span>
          )}
        </Td>
        <Td num>{m(c.base, c.currency)}</Td>
        <Td num>
          {c.received_on ? `nhập ${dmy(c.received_on).slice(0, 5)}` : 'chưa nhập'}
        </Td>
      </GridRow>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width={700}
      title={
        po ? `Ghi phiếu chi phí vận chuyển · ${po.code}` : 'Ghi phiếu chi phí vận chuyển'
      }
      subtitle="Một phiếu = một chuyến. Trả theo chuyến: ghi xong là đến hạn. Không sửa được — sai thì huỷ kèm lý do rồi ghi lại. Phí chưa cộng vào giá nhập kho."
      footer={
        <SheetActions
          busy={busy}
          disabled={!canSend}
          onCancel={onClose}
          cancelLabel="Thôi"
          onConfirm={() => {
            if (!canSend) return
            void onSubmit({
              transport_mode: mode,
              payee_supplier_id: payeeId || null,
              payee_name: payeeText || null,
              payee_phone: mode === 'ship_le' ? payeePhone.trim() || null : null,
              save_to_catalog: mode === 'ship_le' && saveToCatalog,
              kind: 'van_chuyen',
              cost_date: date,
              doc_no: docNo.trim() || null,
              amount: money.amount,
              vat_rate: vat === '' ? null : Number(vat),
              note: note.trim() || null,
              paid:
                pay === 'tai_cho' ? { by: paidBy, on: paidOn, method: paidMethod } : null,
              po_ids: trip.map((t) => t.id),
            }).then((ok) => ok && onClose())
          }}
          confirmLabel="Ghi phiếu"
        />
      }
    >
      {loadErr && (
        <NoticeBar tone="stop" tag="Lỗi tải">
          {loadErr}
        </NoticeBar>
      )}

      <FieldGroup title="Chuyến">
        <Field label="Hình thức">
          <ScopeSwitch
            label="Hình thức"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'nha_xe', label: TRANSPORT_MODE_LABEL.nha_xe },
              { value: 'ship_le', label: TRANSPORT_MODE_LABEL.ship_le },
              ...(po
                ? [
                    {
                      value: 'ncc' as const,
                      label: `${TRANSPORT_MODE_LABEL.ncc} (phí trên HĐ NCC)`,
                    },
                  ]
                : []),
            ]}
          />
        </Field>
        {mode === 'nha_xe' && (
          <Field label="Nhà xe · chành">
            <span className="flex flex-wrap items-center gap-2">
              <Combobox
                label="Nhà xe"
                value={carrierId}
                onChange={setCarrierId}
                emptyLabel={
                  carriers.length ? '— chọn đơn vị —' : 'chưa có đơn vị nào — thêm mới'
                }
                placeholder="Gõ tên nhà xe…"
                options={carriers.map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined }))} // prettier-ignore
              />
              {!adding && (
                <Btn icon="them" onClick={() => setAdding(true)}>
                  Thêm đơn vị mới
                </Btn>
              )}
            </span>
          </Field>
        )}
        {mode === 'nha_xe' && adding && (
          <Field label="Đơn vị mới">
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                label="Tên nhà xe"
                value={newName}
                onCommit={setNewName}
                placeholder="Nhà xe Hùng Vịnh"
              />
              <TextInput
                label="Số điện thoại"
                value={newPhone}
                onCommit={setNewPhone}
                placeholder="SĐT"
                mono
              />
              <Btn
                icon="them"
                primary
                disabled={newName.trim().length < 2}
                onClick={() => void addCarrier()}
              >
                {' '}
                {/* prettier-ignore */}
                Thêm
              </Btn>
              <Btn onClick={() => setAdding(false)}>Thôi</Btn>
              {addErr && <span className="text-k-sm k-t-stop">{addErr}</span>}
            </span>
          </Field>
        )}
        {mode === 'ship_le' && (
          <Field label="Người / đơn vị ship">
            <span className="flex flex-wrap items-center gap-2">
              <TextInput
                label="Tên người hoặc đơn vị ship"
                value={payeeName}
                onCommit={setPayeeName}
                placeholder="Grab — anh Tuấn"
              />
              <TextInput
                label="Số điện thoại"
                value={payeePhone}
                onCommit={setPayeePhone}
                placeholder="SĐT"
                mono
              />
              <span className="text-k-sm flex items-center gap-1.5">
                <Tick
                  label="Lưu vào danh mục đơn vị vận chuyển"
                  checked={saveToCatalog}
                  onChange={setSaveToCatalog}
                />{' '}
                {/* prettier-ignore */}
                Lưu vào danh mục
              </span>
            </span>
          </Field>
        )}
        {mode === 'ncc' && po && (
          <Field label="Người thu">
            <span>
              {po.supplierName}{' '}
              <span className="k-t-mut">· phí sẽ lên hoá đơn NCC, Kế toán nhập sau</span>
            </span>
          </Field>
        )}
        <Field label="Ngày chuyến">
          <DateInput label="Ngày chuyến" value={date} onChange={setDate} />
        </Field>
        <Field label="Số phiếu / biên nhận">
          <TextInput
            label="Số hoá đơn / phiếu / biên nhận"
            value={docNo}
            onCommit={setDocNo}
            mono
            placeholder={mode === 'ship_le' ? 'để trống được' : ''}
          />
        </Field>
        <Field label={`Tiền chưa VAT (${currency})`}>
          <NumInput aria-label="Tiền chưa VAT" value={amount} onCommit={setAmount} />
        </Field>
        <Field label="VAT %">
          <span className="flex items-center gap-2">
            <NumInput aria-label="Thuế suất VAT của phí" value={vat} onCommit={setVat} />
            <span className="text-k-sm text-[var(--ink-2)]">
              {vat === ''
                ? 'để trống = không hoá đơn VAT'
                : `VAT ${m(money.vat_amount, currency)} · tổng ${m(money.total, currency)}`}
            </span>
          </span>
        </Field>
      </FieldGroup>

      <FieldGroup title="Ai trả tiền">
        <Field label="Trả">
          <ScopeSwitch
            label="Ai trả"
            value={pay}
            onChange={setPay}
            options={[
              { value: 'ke_toan', label: 'Chưa trả — Kế toán trả theo chuyến' },
              { value: 'tai_cho', label: 'Đã trả tại chỗ' },
            ]}
          />
        </Field>
        {pay === 'tai_cho' ? (
          <>
            <Field label="Người trả">
              <Pick
                label="Người trả"
                value={paidBy}
                onChange={setPaidBy}
                options={payerOptions}
                width={260}
              />
            </Field>
            <Field label="Bằng">
              <ScopeSwitch
                label="Bằng"
                value={paidMethod}
                onChange={setPaidMethod}
                options={[
                  { value: 'tien_mat', label: PAID_METHOD_LABEL.tien_mat },
                  { value: 'ck_ca_nhan', label: PAID_METHOD_LABEL.ck_ca_nhan },
                ]}
              />
            </Field>
            <Field label="Ngày trả">
              <DateInput label="Ngày trả" value={paidOn} onChange={setPaidOn} />
            </Field>
            <WhyBox
              lines={[
                'Phiếu vào dải CHI HỘ CHỜ HOÀN của Kế toán — không vào công nợ đơn vị vận chuyển',
                'Kế toán bấm "Đã hoàn" khi trả lại tiền cho người đã ứng',
              ]}
              result={`hoàn cho ${payerOptions.find((p) => p.value === paidBy)?.label ?? '—'}`}
            />
          </>
        ) : (
          <WhyBox
            lines={[
              mode === 'ncc'
                ? 'Phí nằm trên hoá đơn NCC — Kế toán nhập hoá đơn thì phần này được mồi thành một dòng'
                : 'Phiếu vào công nợ của đơn vị vận chuyển, đến hạn ngay ngày chuyến (trả theo chuyến)',
            ]}
            result={mode === 'ncc' ? 'chờ hoá đơn NCC' : 'Kế toán trả'}
          />
        )}
      </FieldGroup>

      <FieldGroup title="Chuyến này chở hàng của đơn nào?">
        <Grid minWidth={560}>
          <GridHead>
            <Th width={36} />
            <Th width={120}>Đơn</Th>
            <Th>NCC</Th>
            <Th num width={130}>
              Tiền hàng
            </Th>
            <Th num width={90}>
              Nhập kho
            </Th>
          </GridHead>
          <GridBody>
            {mine && cand(mine, true, true)}
            {suggested.length > 0 && (
              <GridRow>
                <Td colSpan={5}>
                  <span className="text-k-sm k-t-mut">
                    Gợi ý — cùng nơi giao{mine?.place ? ` “${mine.place}”` : ''}, nhập kho
                    trong ±3 ngày · không tick sẵn, chọn đơn đi chung chuyến
                  </span>
                </Td>
              </GridRow>
            )}
            {suggested.map((c) => cand(c, picked.has(c.id)))}
            {found
              .filter((c) => !suggested.some((s) => s.id === c.id) && c.id !== mine?.id)
              .map((c) => cand(c, picked.has(c.id)))}
            {!mine && picked.size === 0 && found.length === 0 && (
              <GridRow>
                <Td colSpan={5}>
                  <span className="text-k-sm k-t-mut">
                    Gõ mã đơn hoặc tên NCC ở ô dưới để chọn đơn của chuyến này.
                  </span>
                </Td>
              </GridRow>
            )}
          </GridBody>
        </Grid>
        <div className="mt-2 flex items-center gap-2">
          <TextInput
            label="Tìm đơn khác"
            value={q}
            onCommit={(v) => void search(v)}
            placeholder="Gõ mã đơn hoặc tên NCC rồi Enter"
          />
          <span className="text-k-sm k-t-mut">đơn nháp / chờ duyệt / huỷ không hiện</span>
        </div>
      </FieldGroup>

      {amt > 0 && trip.length > 0 && (
        <FieldGroup title="Chia theo tiền hàng mỗi đơn (chưa VAT)">
          <Grid minWidth={480}>
            <GridHead>
              <Th>Đơn</Th>
              <Th num>Tiền hàng</Th>
              <Th num>Tỷ lệ</Th>
              <Th num>Phần phí</Th>
            </GridHead>
            <GridBody>
              {alloc.map((a, i) => (
                <GridRow key={a.po_id}>
                  <Td>
                    <span className="num">{trip[i].code}</span>
                    {i === 0 && mine && <Tag>đơn đang mở</Tag>}
                  </Td>
                  <Td num>{m(a.base, currency)}</Td>
                  <Td num>
                    {sumBase > 0
                      ? `${((a.base / sumBase) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
                      : 'chia đều'}
                  </Td>
                  <Td num>
                    <span className="k-strong">{m(a.amount, currency)}</span>
                  </Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td>Cộng {trip.length} đơn</Td>
              <Td num>{m(sumBase, currency)}</Td>
              <Td num>100%</Td>
              <Td num>{m(money.amount, currency)}</Td>
            </GridFoot>
          </Grid>
          {mineAlloc && trip.length > 1 && sumBase > 0 && (
            <WhyBox
              lines={[
                `${m(money.amount, currency)} × ${m(trip[0].base, currency)} (tiền hàng ${trip[0].code})`,
                `÷ ${m(sumBase, currency)} (tổng tiền hàng ${trip.length} đơn)`,
                'làm tròn về đồng; đồng lẻ còn lệch dồn vào đơn tiền hàng lớn nhất',
              ]}
              result={`${m(mineAlloc.amount, currency)} ${currency}`}
            />
          )}
        </FieldGroup>
      )}

      <FieldGroup title="Ghi chú">
        <TextArea
          value={note}
          onChange={setNote}
          rows={2}
          placeholder="Ví dụ: xe 5 tấn, 1 chuyến bãi Q12 → xưởng"
        />
      </FieldGroup>

      {problems.length > 0 && (
        <p className="text-k-sm k-t-stop mt-2">Chưa ghi được: {problems.join(' · ')}.</p>
      )}
    </Sheet>
  )
}
