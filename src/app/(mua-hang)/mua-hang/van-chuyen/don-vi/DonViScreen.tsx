'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  Code,
  Empty,
  Field,
  FieldGrid,
  FilterBar,
  Num,
  Pick,
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Sheet,
  SheetActions,
  StatusBar,
  Table,
  TableSettings,
  Tag,
  TextArea,
  TextInput,
  showMoney,
  useKitTable,
  useToast,
  type KitCol,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { CARRIER_KIND_LABEL, type CarrierKind } from '@/lib/po-cost'
import type { Carrier } from '@/modules/dept/supply/po-costs.repo'
import { dmy } from '../van-chuyen.shared'
import { searchMatcher } from '@/lib/search-text'

export type CarrierRow = Carrier & {
  trips_30d: number
  trips_total: number
  /** Chờ Kế toán trả, theo loại tiền — gồm VAT. */
  owed: Record<string, number>
  last_trip: { date: string; doc_no: string | null } | null
}

const tien = (sum: Record<string, number>) =>
  Object.entries(sum)
    .filter(([, v]) => v > 0)
    .map(
      ([cur, v]) =>
        `${showMoney(v, { digits: cur === 'VND' ? 0 : 2 })} ${cur === 'VND' ? '₫' : cur}`,
    ) // prettier-ignore
    .join(' · ')

const PAY_LABEL: Record<string, string> = { ck: 'CK', tien_mat: 'tiền mặt' }

const CHIPS: { id: string; label: string; test: (r: CarrierRow) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'no', label: 'Còn nợ', test: (r) => Object.values(r.owed).some((v) => v > 0) },
  { id: 'never', label: 'Chưa chuyến nào', test: (r) => r.trips_total === 0 },
  { id: 'off', label: 'Ngừng dùng', test: (r) => !r.is_active },
]

/* ══ Thêm đơn vị — 7 ô, không phải form NCC 40 ô ═══════════════════════════ */
export function ThemDonViSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (c: Carrier) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    name: '',
    phone: '',
    contact_name: '',
    carrier_kind: 'nha_xe' as CarrierKind,
    address: '',
    pay_method: '',
    note: '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const ok = f.name.trim().length >= 2

  async function save() {
    if (!ok) return
    setBusy(true)
    try {
      const s = (x: string) => x.trim() || null
      const r = await api<{ carrier: Carrier }>('/api/dept/supply/po-costs/carriers', {
        method: 'POST',
        body: {
          name: f.name.trim(),
          phone: s(f.phone),
          contact_name: s(f.contact_name),
          carrier_kind: f.carrier_kind,
          address: s(f.address),
          pay_method: f.pay_method || null,
          note: s(f.note),
        },
      })
      toast.success('Đã thêm đơn vị vận chuyển', r.carrier.name)
      onSaved(r.carrier)
      onClose()
    } catch (e) {
      toast.error('Thêm không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Thêm đơn vị vận chuyển"
      subtitle="Nhà xe, chành, hay tài xế lẻ dùng lặp. Tên + SĐT là đủ, phần còn lại khai dần ở hồ sơ. Trùng tên thì dùng lại đơn vị có sẵn."
      stakes="nhe"
      width={520}
      footer={
        <SheetActions stakes="nhe" busy={busy} disabled={!ok} onCancel={onClose} onConfirm={() => void save()} confirmLabel="Thêm đơn vị" /> // prettier-ignore
      }
    >
      <FieldGrid>
        <Field label="Tên đơn vị">
          <TextInput
            value={f.name}
            onCommit={set('name')}
            label="Tên đơn vị"
            placeholder="Nhà xe Hùng Vịnh"
          />
        </Field>
        <Field label="Loại">
          <Pick
            label="Loại đơn vị"
            value={f.carrier_kind}
            onChange={(v) => set('carrier_kind')(v)}
            options={Object.entries(CARRIER_KIND_LABEL).map(([value, label]) => ({ value, label }))} // prettier-ignore
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
            placeholder="tên người mình gọi"
          />
        </Field>
        <Field label="Bãi / địa chỉ">
          <TextInput
            value={f.address}
            onCommit={set('address')}
            label="Bãi / địa chỉ"
            placeholder="QL 1A, Q12, Bãi xe miền Nam"
          />
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
      </FieldGrid>
      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={f.note}
        onChange={set('note')}
        rows={2}
        placeholder="Điều cần nhớ khi gọi xe"
      />
      <p className="text-k-sm mt-3 text-[var(--ink-3)]">
        Điều khoản: trả theo chuyến (mặc định công ty) — đến hạn ngay ngày chuyến.
      </p>
    </Sheet>
  )
}

/* ══ Danh mục ═══════════════════════════════════════════════════════════════ */
export function DonViScreen({
  rows: all,
  canRecord,
  openAdd,
}: {
  rows: CarrierRow[]
  canRecord: boolean
  openAdd: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')
  const [them, setThem] = useState(openAdd)

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    const tim = searchMatcher(q)
    return all
      .filter((r) => test(r) && tim([r.name, r.phone, r.contact_name, r.address, r.code]))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [all, q, chip])

  const owedAll: Record<string, number> = {}
  for (const r of kept)
    for (const [c, v] of Object.entries(r.owed)) owedAll[c] = (owedAll[c] ?? 0) + v

  const columns = useMemo((): KitCol<CarrierRow>[] => {
    return [
      {
        id: 'ten',
        header: 'Đơn vị',
        pin: true,
        rowHeader: true,
        grow: true,
        sort: (r) => r.name,
        cell: (r) => (
          <span className="flex items-center gap-2">
            <Code as="a" href={`/mua-hang/van-chuyen/don-vi/${r.id}`} title={r.name}>
              {r.name}
            </Code>
            {!r.is_active && <Tag tone="warn">Ngừng dùng</Tag>}
          </span>
        ),
      },
      { id: 'loai', header: 'Loại', muted: true, sort: (r) => r.carrier_kind, cell: (r) => CARRIER_KIND_LABEL[r.carrier_kind] }, // prettier-ignore
      {
        id: 'lienHe',
        header: 'Liên hệ',
        cell: (r) => (
          <span>
            {r.contact_name ?? ''}
            {r.contact_name && r.phone ? ' · ' : ''}
            {r.phone && <span className="num">{r.phone}</span>}
          </span>
        ),
      },
      { id: 'bai', header: 'Bãi / địa chỉ', muted: true, cell: (r) => r.address ?? '' },
      {
        id: 'dieuKhoan',
        header: 'Điều khoản',
        muted: true,
        cell: (r) => `Theo chuyến${r.pay_method ? ` · ${PAY_LABEL[r.pay_method]}` : ''}${r.payment_terms ? ` · ${r.payment_terms}` : ''}`, // prettier-ignore
      },
      {
        id: 'chuyen',
        header: 'Chuyến 30 ngày',
        num: true,
        sort: (r) => r.trips_30d,
        foot: kept.reduce((s, r) => s + r.trips_30d, 0) || '',
        cell: (r) => <Num value={String(r.trips_30d || '')} zero={r.trips_total > 0 ? 'zero' : 'dash'} />, // prettier-ignore
      },
      {
        id: 'no',
        header: 'Nợ còn',
        num: true,
        foot: tien(owedAll) || '',
        cell: (r) => {
          const t = tien(r.owed)
          return t ? <span className="num k-strong k-t-stop">{t}</span> : <Num value="" />
        },
      },
      {
        id: 'ganNhat',
        header: 'Chuyến gần nhất',
        muted: true,
        sort: (r) => r.last_trip?.date,
        cell: (r) =>
          r.last_trip ? (
            <span className="flex flex-col leading-tight">
              <span className="num">{r.last_trip.doc_no ?? dmy(r.last_trip.date)}</span>
              {r.last_trip.doc_no && (
                <span className="text-k-label text-[var(--ink-3)]">
                  {dmy(r.last_trip.date)}
                </span>
              )}
            </span>
          ) : (
            'chưa chuyến nào'
          ),
      },
    ]
  }, [kept, owedAll])

  const engine = useKitTable({
    rows: kept,
    columns,
    rowKey: (r) => r.id,
    prefsKey: 'mua-hang-van-chuyen-don-vi',
    foot: {
      label: `Cộng ${kept.length} đơn vị`,
      note: 'Nợ = phiếu chưa trả (Kế toán trả theo chuyến), gồm VAT — không gồm chi hộ chờ hoàn, không gồm phiếu huỷ.',
    },
  })

  return (
    <ScreenFrame tableMin={1000}>
      <ScreenHeader
        compact
        eyebrow="Mua hàng · Vận chuyển"
        title="Đơn vị vận chuyển"
        facts={[
          { label: 'Đơn vị', value: String(all.length) },
          { label: 'Có chuyến 30 ngày', value: String(all.filter((r) => r.trips_30d > 0).length) }, // prettier-ignore
          { label: 'Nợ còn', value: tien(owedAll) || '0', tone: tien(owedAll) ? 'warn' : 'neutral' }, // prettier-ignore
        ]}
        actions={
          <>
            <ScopeSwitch
              label="Xem"
              value="don_vi"
              onChange={() => router.push('/mua-hang/van-chuyen')}
              options={[
                { value: 'chuyen', label: 'Chuyến' },
                { value: 'don_vi', label: 'Đơn vị' },
              ]}
            />
            <Btn
              icon="them"
              primary
              onClick={() => setThem(true)}
              blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
            >
              Thêm đơn vị
            </Btn>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm tên, SĐT, bãi…"
          width={300}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={all.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </Chip>
        ))}
        <span className="ml-auto">
          <TableSettings engine={engine} />
        </span>
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline={
            all.length === 0
              ? 'Chưa có đơn vị vận chuyển nào'
              : 'Không có đơn vị nào khớp'
          }
          reason={
            all.length === 0
              ? 'Danh mục này chỉ giữ nhà xe / chành / tài xế dùng lặp. Ship lẻ (Grab, Ahamove…) gõ thẳng trên phiếu, không cần khai ở đây.'
              : `Bộ lọc “${CHIPS.find((c) => c.id === chip)?.label}”${q.trim() ? ` cộng từ khoá “${q.trim()}”` : ''} không còn dòng nào.`
          }
          next={
            all.length === 0 ? (
              <Btn
                icon="them"
                primary
                onClick={() => setThem(true)}
                blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
              >
                Thêm đơn vị đầu tiên
              </Btn>
            ) : (
              <Btn
                icon="boLoc"
                onClick={() => {
                  setQ('')
                  setChip('all')
                }}
              >
                Bỏ lọc, xem cả {all.length} đơn vị
              </Btn>
            )
          }
        />
      ) : (
        <Table engine={engine} />
      )}

      {them && (
        <ThemDonViSheet
          onClose={() => setThem(false)}
          onSaved={(c) => router.push(`/mua-hang/van-chuyen/don-vi/${c.id}`)}
        />
      )}

      <StatusBar
        left={[
          'Danh mục riêng — không xuất hiện trong sổ Nhà cung cấp, không chọn được khi soạn đơn',
          'Ship lẻ gõ thẳng trên phiếu; chỉ đơn vị dùng lặp mới lưu ở đây',
        ]}
        right={`${kept.length} / ${all.length} đơn vị`}
      />
    </ScreenFrame>
  )
}
