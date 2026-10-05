'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Btn,
  Chip,
  Combobox,
  Field,
  FieldGrid,
  Hint,
  Loading,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  TextArea,
  TextInput,
  ToneText,
  showMoney,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { fieldsClearedByPayload } from '@/lib/material-group-fields'
import { barLengthFromName, saveBlockReason } from '@/lib/material-edit'
import {
  coreFromMaterial,
  useMaterialCore,
  type MaterialCore,
} from '@/components/warehouse/useMaterialCore'
import type { Material } from '@/modules/dept/warehouse/warehouse.repo'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { VatTuLichSu, type GiaMua, type ThayDoi } from './vat-tu-lich-su'
import { DaiNgungDung, KhoiBoMa, NutBoMa, useMaHienDung, type BoMaCtx } from './bo-ma'

type Nap = { m: Material; gia: GiaMua[] | null; doi: ThayDoi[] | null }

/**
 * SỬA VẬT TƯ TRONG KHU MUA HÀNG (29/09/2026, artboard 16/16b đã duyệt).
 *
 * Thay modal hệ cũ của `/planning/materials` (đã xoá). Một bộ não với form cũ —
 * `useMaterialCore` (đọc kg/m từ tên, cổng barem, ĐVT lạ, dò trùng, ghi null ô
 * ngoài nhóm) — chỉ giao diện dựng lại bằng kit.
 *
 * Chỉ các ô NGƯỜI MUA được sửa (`PURCHASING_EDITABLE_FIELDS` ở service): kệ,
 * ngưỡng tồn, cờ "Chờ Kho rà", ngừng dùng là của Kho — nói ra, không bày ô.
 * VAT không bày: 0/13.316 mã có khai (đo 29/09).
 *
 * DÙNG CHUNG HAI NƠI: danh mục `/mua-hang/vat-tu` (truyền sẵn `tax`, `suppliers`
 * từ server) và màn soạn/sửa đơn (thay modal hệ cũ EditMaterialDialog, 29/09) —
 * ở đó panel tự nạp hai thứ này. `onSaved` trả bản đã lưu để đơn hút lại số mới.
 */
export function SuaVatTuSheet({
  id,
  tax,
  suppliers,
  onClose,
  onSaved,
  boMa,
}: {
  id: string
  /** Danh mục ĐVT/nhóm — bỏ trống thì panel tự nạp. */
  tax?: MaterialTaxonomy
  /** NCC cho ô "NCC mặc định" — bỏ trống thì panel tự nạp. */
  suppliers?: { value: string; label: string }[]
  onClose: () => void
  /** Bản vật tư SAU khi lưu (từ PATCH). */
  onSaved: (m: Material) => void
  /**
   * Ngừng dùng / xoá mã (Bản 11) — chỉ màn danh mục truyền. Ở màn soạn đơn mã
   * đang nằm trên dòng đơn, bỏ mã ở đó là sai chỗ.
   */
  boMa?: BoMaCtx
}) {
  const toast = useToast()
  const [nap, setNap] = useState<Nap | null>(null)
  const [nen, setNen] = useState<{
    tax: MaterialTaxonomy
    suppliers: { value: string; label: string }[]
  } | null>(tax && suppliers ? { tax, suppliers } : null)
  useEffect(() => {
    let live = true
    if (!(tax && suppliers))
      Promise.all([
        tax ?? api<MaterialTaxonomy>('/api/dept/warehouse/material-taxonomy'),
        suppliers ??
          api<{
            rows: {
              id: string
              code: string | null
              name: string
              short_name: string | null
              is_carrier?: boolean
            }[]
          }>('/api/dept/supply/suppliers?page=1&page_size=500').then((r) =>
            r.rows
              .filter((x) => !x.is_carrier)
              .map((x) => ({
                value: x.id,
                label: x.code ? `${x.code} · ${x.short_name ?? x.name}` : x.name,
              })),
          ),
      ])
        .then(([t, sp]) => live && setNen({ tax: t, suppliers: sp }))
        .catch((e) => {
          toast.error('Không nạp được danh mục', apiErrorText(e))
          onClose()
        })
    api<{ material: Material }>(`/api/dept/warehouse/materials/${id}`)
      .then(async ({ material: m }) => {
        if (!live) return
        setNap({ m, gia: null, doi: null })
        // Lịch sử nạp sau, hỏng thì panel sửa vẫn dùng được.
        const [g, d] = await Promise.all([
          api<{ prices: GiaMua[] }>(`/api/dept/supply/materials/${id}/price-history`).then((r) => r.prices).catch(() => []),
          api<{ changes: ThayDoi[] }>(`/api/dept/warehouse/materials/${id}/changes`).then((r) => r.changes).catch(() => []),
        ]) // prettier-ignore
        if (live) setNap({ m, gia: g, doi: d })
      })
      .catch((e) => {
        toast.error('Không mở được vật tư', apiErrorText(e))
        onClose()
      })
    return () => {
      live = false
    }
    // Chỉ nạp theo id — toast/onClose đổi danh tính mỗi render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!nap || !nen)
    return (
      <Sheet open onClose={onClose} title="Sửa vật tư" stakes="nhe" width={720}>
        <Loading rows={8} />
      </Sheet>
    )
  return (
    <Form
      key={nap.m.id}
      nap={nap}
      tax={nen.tax}
      suppliers={nen.suppliers}
      onClose={onClose}
      onSaved={onSaved}
      boMa={boMa}
    />
  )
}

function Form({
  nap: { m, gia, doi },
  tax,
  suppliers,
  onClose,
  onSaved,
  boMa,
}: {
  nap: Nap
  tax: MaterialTaxonomy
  suppliers: { value: string; label: string }[]
  onClose: () => void
  onSaved: (m: Material) => void
  boMa?: BoMaCtx
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const usage = useMaHienDung(m.id, !!boMa?.canRetire)
  const [boMo, setBoMo] = useState(false)
  // Lần ngừng dùng gần nhất — đọc từ sổ vết đã nạp sẵn cho phần Lịch sử.
  const vetNgung = doi?.find((c) => c.field === 'is_active' && c.after_value === 'false')
  const lanNgung = vetNgung
    ? { at: vetNgung.created_at, by: vetNgung.actor_name ?? null, reason: vetNgung.source_ref ?? null }
    : null
  const s = useMaterialCore({ active: true, initial: coreFromMaterial(m), taxonomy: tax, excludeCode: m.code }) // prettier-ignore
  const { f } = s
  const set = (k: keyof MaterialCore) => (v: string) => s.setF((p) => ({ ...p, [k]: v }))
  const [mua, setMua] = useState({
    price: m.last_purchase_price == null ? '' : String(m.last_purchase_price),
    supplier: m.default_supplier_id ?? '',
    tol: String(m.over_tolerance_pct ?? 0),
    note: m.note ?? '',
  })

  const payload = s.corePayload()
  const cleared = useMemo(() => fieldsClearedByPayload(m as unknown as Record<string, unknown>, payload), [m, payload]) // prettier-ignore
  const clearKey = cleared.map((c) => c.field).join(',')
  const [clearOkFor, setClearOkFor] = useState('')
  const barHint = barLengthFromName(f.name)
  const lastBuy = gia?.[0] ?? null
  const units = useMemo(
    () => [...new Set([...tax.units, m.unit].filter(Boolean))],
    [tax.units, m.unit],
  )
  const subs =
    s.subs.includes(f.sub_group) || !f.sub_group ? s.subs : [f.sub_group, ...s.subs]

  const why = saveBlockReason({
    name: f.name,
    unit: f.unit,
    unitUnconfirmed: s.unitWarn != null && !s.unitConfirmed,
    baremUnconfirmed: s.baremBlocked && !s.baremConfirmed,
    kgOffPct: s.kgOff || null,
    clearedUnconfirmed: clearOkFor === clearKey ? [] : cleared.map((c) => c.label),
  })

  async function save() {
    if (why) return
    setBusy(true)
    try {
      const r = await api<{ material: Material }>(
        `/api/dept/warehouse/materials/${m.id}`,
        {
          method: 'PATCH',
          body: {
            ...payload,
            note: mua.note.trim() || null,
            last_purchase_price: mua.price.trim() === '' ? null : Number(mua.price.replace(/\./g, '').replace(',', '.')), // prettier-ignore
            default_supplier_id: mua.supplier || null,
            over_tolerance_pct: Number(mua.tol) || 0,
          },
        },
      )
      toast.success(
        `Đã lưu ${m.code}`,
        'Đơn mua soạn từ giờ dùng thông tin mới; đơn đã gửi không đổi.',
      )
      onSaved(r.material)
    } catch (e) {
      toast.error('Lưu không được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Sửa vật tư ${m.code}`}
      subtitle={`${m.name} · ${m.group_name ?? 'chưa nhóm'} — đổi ở đây là đổi cho mọi đơn mua sau, đơn đã gửi không đổi.`}
      stakes="nhe"
      width={720}
      footer={
        <div className="flex w-full items-center gap-3">
          {boMa?.canRetire && (
            <NutBoMa m={m} usage={usage} open={boMo} onOpen={() => setBoMo(true)} />
          )}
          <span className="text-k-sm flex-1">
            {why && (
              <ToneText tone="stop" strong={false}>
                Chưa lưu được: {why}
              </ToneText>
            )}
          </span>
          <SheetActions
            stakes="nhe"
            busy={busy}
            disabled={!!why}
            onCancel={onClose}
            onConfirm={() => void save()}
            cancelLabel="Thôi"
            confirmLabel="Lưu vật tư"
          />{' '}
          {/* prettier-ignore */}
        </div>
      }
    >
      {boMa && !m.is_active && <DaiNgungDung m={m} lan={lanNgung} ctx={boMa} />}
      {boMa && boMo && usage && (
        <div className="mb-4">
          <KhoiBoMa m={m} usage={usage} ctx={boMa} onCancel={() => setBoMo(false)} />
        </div>
      )}
      {m.needs_review && (
        <div className="mb-3">
          <NoticeBar tag="Chờ Kho rà">
            Mã khai vội lúc lên đơn. Sửa ở đây vẫn giữ cờ — Kho rà xong bấm “Đã rà xong” ở
            màn Vật tư của Kho.
          </NoticeBar>
        </div>
      )}

      <FieldGrid>
        <Field label="Tên vật tư *">
          <TextInput value={f.name} onCommit={set('name')} label="Tên vật tư" />
        </Field>
        <Field label="ĐVT đặt hàng *">
          <Pick
            label="ĐVT đặt hàng"
            value={f.unit}
            onChange={set('unit')}
            options={units.map((u) => ({ value: u, label: u }))}
          />{' '}
          {/* prettier-ignore */}
        </Field>
        <Field label="Quy cách">
          <TextInput
            value={f.spec}
            onCommit={set('spec')}
            label="Quy cách"
            placeholder={s.groupCfg.specPlaceholder}
          />
        </Field>
        <Field label="Nhóm *">
          <Pick
            label="Nhóm"
            value={f.group_name}
            onChange={(v) => s.setF((p) => ({ ...p, group_name: v, sub_group: '' }))}
            options={[
              { value: '', label: '— chưa chọn —' },
              ...tax.groups.map((g) => ({ value: g.name, label: g.name })),
            ]}
          />
        </Field>
        <Field label="Nhóm con">
          <Pick
            label="Nhóm con"
            value={f.sub_group}
            onChange={set('sub_group')}
            options={[
              { value: '', label: '— chưa chọn —' },
              ...subs.map((x) => ({ value: x, label: x })),
            ]}
          />{' '}
          {/* prettier-ignore */}
        </Field>
        <Field label="Vật liệu / màu">
          <TextInput
            value={f.material_grade}
            onCommit={set('material_grade')}
            label="Vật liệu / màu"
            placeholder={s.groupCfg.gradePlaceholder}
          />{' '}
          {/* prettier-ignore */}
        </Field>
        {s.groupCfg.showFinish && (
          <Field label="Màu / bề mặt">
            <TextInput
              value={f.finish}
              onCommit={set('finish')}
              label="Màu / bề mặt"
              placeholder="inox bóng, xi trắng…"
            />
          </Field>
        )}
        {s.groupCfg.showCarton && (
          <>
            <Field label="Cách mở thùng">
              <TextInput
                value={f.open_style}
                onCommit={set('open_style')}
                label="Cách mở thùng"
                placeholder="AD / MR / ĐK"
              />
            </Field>
            <Field label="SP mỗi thùng">
              <NumInput
                value={f.pcs_per_ctn}
                onCommit={set('pcs_per_ctn')}
                aria-label="SP mỗi thùng"
                align="left"
              />
            </Field>
          </>
        )}
      </FieldGrid>
      {s.specSuggest && !f.spec.trim() && (
        <div className="mt-1 flex items-center gap-2">
          <Hint size="sm">Tên có quy cách “{s.specSuggest}”.</Hint>
          <Btn icon="them" onClick={() => set('spec')(s.specSuggest ?? '')}>
            Điền quy cách
          </Btn>
        </div>
      )}
      {s.unitWarn && !s.unitConfirmed && (
        <div className="mt-3">
          <NoticeBar
            tag="ĐVT lạ"
            tone="stop"
            action={{ label: `Đúng là “${f.unit}”`, onClick: s.confirmUnit }}
          >
            {s.unitWarn.kind === 'suggest'
              ? `Danh mục có “${s.unitWarn.suggest}” — nghi gõ nhầm.`
              : 'ĐVT này chưa ai dùng trong danh mục.'}{' '}
            Sai ĐVT là mọi đơn sau đặt sai. {/* prettier-ignore */}
          </NoticeBar>
        </div>
      )}
      {s.similar.length > 0 && (
        <div className="mt-3">
          <NoticeBar tag="Gần trùng">
            Nhóm này đã có {s.similar.map((x) => `${x.code} · ${x.name}`).join('; ')}. Hai
            mã một hàng thì đơn và tồn tách làm hai.
          </NoticeBar>
        </div>
      )}
      {cleared.length > 0 && clearOkFor !== clearKey && (
        <div className="mt-3">
          <NoticeBar
            tag="Lưu sẽ xoá"
            tone="stop"
            action={{
              label: 'Tôi hiểu, xoá khi lưu',
              onClick: () => setClearOkFor(clearKey),
            }}
          >
            Nhóm / hàng mới không dùng:{' '}
            {cleared.map((c) => `${c.label} ${c.oldValue}`).join(' · ')}.
          </NoticeBar>
        </div>
      )}

      {(s.needsBarWeight || (s.needsWeight && s.sheetLike)) && (
        <>
          <div className="k-sec mt-4">
            Barem — mẫu đơn “
            {s.guess.template === 'aluminium' ? 'nhôm cây' : 'sắt theo kg'}”
          </div>
          <FieldGrid note="Số nhân thẳng vào tiền: tiền = số lượng × kg mỗi đơn vị × giá/kg.">
            {s.needsBarWeight ? (
              <>
                <Field label="kg / m">
                  <NumInput
                    value={f.kg_per_m}
                    onCommit={set('kg_per_m')}
                    aria-label="kg trên mét"
                    align="left"
                  />
                </Field>
                <Field label="Dài cây (m)">
                  <NumInput
                    value={f.default_bar_length_m}
                    onCommit={set('default_bar_length_m')}
                    aria-label="Dài cây (m)"
                    align="left"
                  />{' '}
                  {/* prettier-ignore */}
                </Field>
              </>
            ) : (
              <Field label={`kg mỗi ${f.unit || 'đơn vị'}`}>
                <NumInput
                  value={f.kg_per_unit}
                  onCommit={set('kg_per_unit')}
                  aria-label="kg mỗi đơn vị"
                  align="left"
                />
              </Field>
            )}
          </FieldGrid>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {s.derived?.kg != null && (
              <Hint size="sm">
                Máy đọc từ tên:{' '}
                {s.derived.kg.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} kg/m
                {f.kg_per_m.trim()
                  ? s.kgMismatch
                    ? ` — lệch ${Math.round(s.kgOff * 100)}%`
                    : ' — khớp (trong ngưỡng 5%)'
                  : ' — ô trống thì lưu số này'}{' '}
                {/* prettier-ignore */}
              </Hint>
            )}
            {
              s.needsBarWeight && !f.default_bar_length_m.trim() && barHint != null &&
              <Btn icon="them" onClick={() => set('default_bar_length_m')(String(barHint))}>Điền dài cây {barHint} m (đọc từ tên)</Btn> // prettier-ignore
            }
          </div>
          {s.baremBlocked && !s.baremConfirmed && (
            <div className="mt-2">
              <NoticeBar
                tag="Barem lệch"
                tone="stop"
                action={{ label: 'Đúng là số này', onClick: s.confirmBarem }}
              >
                Số gõ lệch quá 5% so với số máy tính — nghi gõ nhầm dấu chấm. Mọi đơn sau
                sẽ điền sẵn số này.
              </NoticeBar>
            </div>
          )}
        </>
      )}

      <div className="k-sec mt-4">Mua</div>
      <FieldGrid>
        <Field label={`Giá tham chiếu (₫/${f.price_unit || f.unit || 'ĐVT'})`}>
          <NumInput
            value={mua.price}
            onCommit={(v) => setMua((x) => ({ ...x, price: v }))}
            aria-label="Giá tham chiếu"
            align="left"
          />{' '}
          {/* prettier-ignore */}
        </Field>
        <Field label="NCC mặc định">
          <Combobox
            label="NCC mặc định"
            value={mua.supplier}
            onChange={(v: string) => setMua((x) => ({ ...x, supplier: v }))}
            options={suppliers}
            emptyLabel="— chưa chọn —"
          />{' '}
          {/* prettier-ignore */}
        </Field>
        <Field label="Nhận vượt tối đa (%)">
          <NumInput
            value={mua.tol}
            onCommit={(v) => setMua((x) => ({ ...x, tol: v }))}
            aria-label="Nhận vượt tối đa (%)"
            align="left"
          />{' '}
          {/* prettier-ignore */}
        </Field>
      </FieldGrid>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Hint size="sm">Tính giá theo:</Hint>
        {['', 'kg', 'm', 'm2'].map((u) => (
          <Chip
            key={u || 'dvt'}
            on={f.price_unit === u}
            onClick={() => set('price_unit')(u)}
          >
            {u || `${f.unit || 'ĐVT'} (ĐVT đặt)`}
          </Chip>
        ))}
        {s.dual && (
          <span className="flex items-center gap-2">
            <Hint size="sm">1 {f.unit || 'ĐVT'} ≈</Hint>
            <NumInput
              value={f.unit2_factor}
              onCommit={set('unit2_factor')}
              aria-label="Hệ số quy đổi giá"
              align="left"
            />
            <Hint size="sm">{f.price_unit}</Hint>
          </span>
        )}
      </div>
      {lastBuy && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Hint size="sm">
            Lần mua gần nhất: {showMoney(lastBuy.unit_price)} {lastBuy.currency} —{' '}
            {lastBuy.po_code}
            {lastBuy.supplier_name ? `, ${lastBuy.supplier_name}` : ''}
          </Hint>
          {String(lastBuy.unit_price) !== mua.price && (
            <Btn
              onClick={() => setMua((x) => ({ ...x, price: String(lastBuy.unit_price) }))}
            >
              Lấy giá này
            </Btn>
          )}
        </div>
      )}

      <div className="mt-3">
        <VatTuLichSu gia={gia} doi={doi} />
      </div>

      <p className="text-k-sm mt-3 text-[var(--ink-3)]">
        Kho giữ: kệ · ngưỡng tồn · cờ “Chờ Kho rà” — sửa ở màn Vật tư của Kho.
      </p>

      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={mua.note}
        onChange={(v) => setMua((x) => ({ ...x, note: v }))}
        rows={3}
        placeholder="Điều cần nhớ khi mua mã này"
      />
    </Sheet>
  )
}
