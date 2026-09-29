'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  Code,
  Empty,
  FilterBar,
  Menu,
  Num,
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  Table,
  TableSettings,
  Tag,
  showMoney,
  useKitTable,
  useToast,
  type KitCol,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { HuyPhiSheet } from '../don/[id]/ChiPhiPanel'
import { GhiPhiSheet } from './GhiPhiSheet'
import {
  costMoneyState,
  costStateTag,
  daysSince,
  dmy,
  modeLabel,
  payerLabel,
  sumByCurrency,
  type CostMoneyState,
  type CostRow,
} from './van-chuyen.shared'

type Payer = { id: string; name: string }

/** ["5.330.000 ₫", "120 USD"] — mỗi loại tiền một cụm, không quy đổi. */
function tienTheoLoai(sum: Record<string, number>): string {
  const parts = Object.entries(sum)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => `${showMoney(v, { digits: cur === 'VND' ? 0 : 2 })} ${cur === 'VND' ? '₫' : cur}`) // prettier-ignore
  return parts.join(' · ')
}

/** Chip = một CÂU HỎI của người cầm sổ, đếm bằng đúng hàm lọc của bảng. */
const CHIPS: { id: 'all' | CostMoneyState; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'cho_tra', label: 'Chờ Kế toán trả' },
  { id: 'chi_ho', label: 'Chi hộ chờ hoàn' },
  { id: 'cho_hd_ncc', label: 'Chờ HĐ NCC' },
  { id: 'da_hoan', label: 'Đã hoàn' },
  { id: 'huy', label: 'Đã huỷ' },
]

export function SoChuyenScreen({
  rows: all,
  today,
  canRecord,
  me,
  payers,
}: {
  rows: CostRow[]
  today: string
  canRecord: boolean
  me: Payer
  payers: Payer[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [chip, setChip] = useState<'all' | CostMoneyState>('all')
  const [ghi, setGhi] = useState(false)
  const [huy, setHuy] = useState<CostRow | null>(null)
  const [busy, setBusy] = useState(false)

  const kept = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter(
      (c) =>
        (chip === 'all' || costMoneyState(c) === chip) &&
        (!needle ||
          [c.doc_no, c.payee_name, c.payee_phone, c.note, ...c.allocations.map((a) => a.po_code), ...c.allocations.map((a) => a.po_supplier_name)] // prettier-ignore
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle))),
    )
  }, [all, q, chip])

  const live = all.filter((c) => !c.voided_at)
  const recent = live.filter((c) => daysSince(c.cost_date, today) <= 30)
  const choTra = live.filter((c) => costMoneyState(c) === 'cho_tra')
  const chiHo = live.filter((c) => costMoneyState(c) === 'chi_ho')
  const total = (c: CostRow) => c.total

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

  const columns = useMemo((): KitCol<CostRow>[] => {
    return [
      {
        id: 'ngay',
        header: 'Ngày',
        pin: true,
        rowHeader: true,
        sort: (c) => c.cost_date,
        cell: (c) => <span className="num">{dmy(c.cost_date)}</span>,
      },
      { id: 'hinhThuc', header: 'Hình thức', sort: (c) => c.transport_mode, cell: (c) => modeLabel(c.transport_mode) }, // prettier-ignore
      {
        id: 'thu',
        header: 'Đơn vị / người thu',
        grow: true,
        sort: (c) => c.payee_name,
        cell: (c) => (
          <span className="flex flex-col leading-tight">
            {c.payee_supplier_id ? (
              <Code as="a" href={`/mua-hang/van-chuyen/don-vi/${c.payee_supplier_id}`}>
                {c.payee_name}
              </Code>
            ) : (
              <span>{c.payee_name ?? '—'}</span>
            )}
            <span className="text-k-label text-[var(--ink-3)]">
              {c.payee_supplier_id
                ? 'trong danh mục'
                : `gõ tay${c.payee_phone ? ` · ${c.payee_phone}` : ''}`}
            </span>
          </span>
        ),
      },
      { id: 'so', header: 'Số phiếu', muted: true, cell: (c) => <span className="num">{c.doc_no ?? '—'}</span> }, // prettier-ignore
      {
        id: 'don',
        header: 'Chở đơn',
        cell: (c) => (
          <span className="flex flex-col leading-tight">
            <span>
              {/* Một chuyến 13 đơn không được nở cột — bẫy 7: cắt 3, số đơn ở dòng phụ. */}
              {c.allocations.slice(0, 3).map((a, i) => (
                <span key={a.po_id}>
                  {i > 0 && ' · '}
                  <Code as="a" href={`/mua-hang/don/${a.po_id}`}>
                    {(a.po_code ?? '?').replace(/^PO-\d{4}-/, '')}
                  </Code>
                </span>
              ))}
            </span>
            <span className="text-k-label text-[var(--ink-3)]">
              {[
                ...new Set(c.allocations.map((a) => a.po_supplier_name).filter(Boolean)),
              ].join(', ')}
              {c.allocations.length > 1
                ? ` · ${c.allocations.length} đơn một chuyến`
                : ''}
            </span>
          </span>
        ),
      },
      {
        id: 'tien',
        header: 'Tiền · gồm VAT',
        num: true,
        sort: (c) => c.total,
        foot: tienTheoLoai(sumByCurrency(kept, total)) || '',
        cell: (c) =>
          <Num value={showMoney(c.total, { digits: c.currency === 'VND' ? 0 : 2 })} strong={!c.voided_at} muted={!!c.voided_at} />, // prettier-ignore
      },
      {
        id: 'aiTra',
        header: 'Ai trả',
        cell: (c) => {
          const p = payerLabel(c)
          return (
            <span className="flex flex-col leading-tight">
              <span>{p.who}</span>
              {p.how && (
                <span className="text-k-label text-[var(--ink-3)]">
                  {p.how}
                  {c.paid_on ? ` · ${dmy(c.paid_on)}` : ''}
                </span>
              )}
            </span>
          )
        },
      },
      {
        id: 'trangThai',
        header: 'Tiền',
        cell: (c) => {
          const t = costStateTag(c, today)
          return <Tag tone={t.tone}>{t.label}</Tag>
        },
      },
      {
        id: 'viec',
        header: '',
        label: 'Việc',
        hideable: false,
        cell: (c) =>
          !c.voided_at && canRecord ? (
            <Menu
              ariaLabel={`Việc với phiếu ${c.doc_no ?? dmy(c.cost_date)}`}
              items={[{ label: 'Huỷ phiếu', danger: true, onClick: () => setHuy(c) }]}
            />
          ) : null,
      },
    ]
  }, [kept, today, canRecord])

  const engine = useKitTable({
    rows: kept,
    columns,
    rowKey: (c) => c.id,
    prefsKey: 'mua-hang-van-chuyen',
    foot: {
      label: `Cộng ${kept.length} chuyến đang hiện`,
      note: `Gồm VAT của phiếu (nhà xe không HĐ = 0). Chờ Kế toán trả ${tienTheoLoai(sumByCurrency(choTra, total)) || '0'} · chi hộ chờ hoàn ${tienTheoLoai(sumByCurrency(chiHo, total)) || '0'}. Không gồm phiếu huỷ.`,
    },
  })

  const count = (id: 'all' | CostMoneyState) =>
    id === 'all' ? all.length : all.filter((c) => costMoneyState(c) === id).length

  return (
    <ScreenFrame tableMin={1100}>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Vận chuyển"
        facts={[
          { label: `Phí 30 ngày · ${recent.length} chuyến`, value: tienTheoLoai(sumByCurrency(recent, total)) || '0' }, // prettier-ignore
          { label: 'Chờ Kế toán trả', value: tienTheoLoai(sumByCurrency(choTra, total)) || '0', tone: choTra.length ? 'warn' : 'neutral' }, // prettier-ignore
          { label: 'Chi hộ chờ hoàn', value: tienTheoLoai(sumByCurrency(chiHo, total)) || '0', tone: chiHo.length ? 'warn' : 'neutral' }, // prettier-ignore
        ]}
        actions={
          <>
            <ScopeSwitch
              label="Xem"
              value="chuyen"
              onChange={() => router.push('/mua-hang/van-chuyen/don-vi')}
              options={[
                { value: 'chuyen', label: 'Chuyến' },
                { value: 'don_vi', label: 'Đơn vị' },
              ]}
            />
            <Btn icon="them" href="/mua-hang/van-chuyen/don-vi?them=1">
              Thêm đơn vị
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

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm số phiếu, đơn vị, mã đơn, NCC…"
          width={300}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={count(c.id)}
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
          headline={all.length === 0 ? 'Chưa ghi chuyến nào' : 'Không có chuyến nào khớp'}
          reason={
            all.length === 0
              ? 'Phiếu phí ghi khi hàng về hoặc khi có biên nhận nhà xe / shipper. Đơn giao ra bãi xe (Hùng Vịnh…) thường có phí; NCC giao tận xưởng thì không.'
              : `Bộ lọc “${CHIPS.find((c) => c.id === chip)?.label}”${q.trim() ? ` cộng từ khoá “${q.trim()}”` : ''} không còn dòng nào.`
          }
          next={
            all.length === 0 ? (
              <Btn
                icon="tien"
                primary
                onClick={() => setGhi(true)}
                blockedBy={canRecord ? undefined : 'Cung ứng / Kế toán'}
              >
                Ghi phiếu đầu tiên
              </Btn>
            ) : (
              <Btn
                icon="boLoc"
                onClick={() => {
                  setQ('')
                  setChip('all')
                }}
              >
                Bỏ lọc, xem cả {all.length} chuyến
              </Btn>
            )
          }
        />
      ) : (
        <Table engine={engine} />
      )}

      {ghi && (
        <GhiPhiSheet
          po={null}
          me={me}
          payers={payers}
          busy={busy}
          onClose={() => setGhi(false)}
          onSubmit={(body) =>
            call('/api/dept/supply/po-costs', body, 'Đã ghi phiếu chi phí')
          }
        />
      )}
      {huy && (
        <HuyPhiSheet
          cost={huy}
          busy={busy}
          onClose={() => setHuy(null)}
          onSubmit={(reason) => call(`/api/dept/supply/po-costs/${huy.id}/void`, { reason }, 'Đã huỷ phiếu')} // prettier-ignore
        />
      )}

      <StatusBar
        left={[
          chip === 'all' && !q.trim() ? 'Khung nhìn: mọi chuyến' : 'Khung nhìn: đang lọc',
          'Trả theo chuyến — mỗi phiếu là một khoản, đến hạn ngay khi ghi',
        ]}
        right={`${kept.length} / ${all.length} chuyến`}
      />
    </ScreenFrame>
  )
}
