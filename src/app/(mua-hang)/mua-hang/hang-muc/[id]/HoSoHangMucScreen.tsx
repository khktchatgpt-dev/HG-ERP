'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Code,
  Empty,
  Metric,
  MetricStrip,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Table,
  Tag,
  useKitTable,
  useToast,
  type KitCol,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'

/** Ngày theo giờ Việt Nam của một mốc timestamptz (cắt chuỗi UTC là lệch ngày sau 17h). */
const ngay = (ts: string) => isoToVn(todayVn(new Date(ts)))
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { poStatusLabel, poStatusTone } from '@/lib/po-status'
import { goiYMucDich } from '@/lib/po-muc-dich'
import type { ProjectPo, ProjectRow } from '@/modules/dept/supply/projects.service'
import { HangMucSheet } from '../hang-muc-sheet'
import { tien } from '../hang-muc.shared'

const TONE = {
  gray: 'neutral',
  amber: 'warn',
  blue: 'run',
  green: 'done',
  red: 'stop',
} as const

function cot(cur: string): KitCol<ProjectPo>[] {
  const t = (n: number | null) => (n ? tien(n, cur) : '')
  return [
    {
      id: 'don',
      header: 'Đơn',
      pin: true,
      sort: (r) => r.code,
      cell: (r) => (
        <Code as="a" href={`/mua-hang/don/${r.id}`}>
          {r.code}
        </Code>
      ),
    },
    {
      id: 'ncc',
      header: 'Nhà cung cấp',
      sort: (r) => r.supplier_name,
      cell: (r) => r.supplier_name,
    },
    {
      id: 'vt',
      header: 'Vật tư',
      grow: true,
      muted: true,
      title: (r) => r.materials.join(', '),
      cell: (r) => r.materials.slice(0, 2).join(', ') + (r.materials.length > 2 ? ` +${r.materials.length - 2} mã` : ''), // prettier-ignore
    },
    {
      id: 'tt',
      header: 'Trạng thái',
      sort: (r) => r.status,
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Tag tone={TONE[poStatusTone(r.status) as keyof typeof TONE] ?? 'neutral'}>
            {poStatusLabel(r.status)}
          </Tag>
          {r.overdue && <Tag tone="stop">Quá hẹn</Tag>}
        </span>
      ),
    },
    { id: 'hen', header: 'Hẹn giao', sort: (r) => r.expected_at, cell: (r) => (r.expected_at ? <span className="num">{isoToVn(r.expected_at)}</span> : '') }, // prettier-ignore
    {
      id: 'gt',
      header: 'Giá trị (gồm VAT)',
      num: true,
      sort: (r) => r.gross,
      tone: (r) =>
        r.status === 'draft' || r.status === 'cancelled' ? undefined : undefined,
      cell: (r) => (
        <span
          className={
            r.status === 'draft' || r.status === 'cancelled'
              ? 'text-[var(--ink-3)]'
              : undefined
          }
        >
          {r.currency === cur ? t(r.gross) : tien(r.gross, r.currency)}
        </span>
      ),
    },
    { id: 've', header: 'Đã về', num: true, sort: (r) => r.received_net, title: () => 'Theo phiếu kho, chưa VAT', cell: (r) => t(r.received_net) }, // prettier-ignore
    {
      id: 'tra',
      header: 'Đã trả',
      num: true,
      sort: (r) => r.paid,
      cell: (r) => t(r.paid),
    },
  ]
}

/** Hồ sơ một hạng mục — xem `page.tsx`. */
export function HoSoHangMucScreen({
  project: h,
  pos,
  canManage,
  kinds,
}: {
  project: ProjectRow
  pos: ProjectPo[]
  canManage: boolean
  kinds: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [sua, setSua] = useState(false)
  const [busy, setBusy] = useState(false)
  const so = h.so
  const mo = h.status === 'open'
  const columns = useMemo(() => cot(h.currency), [h.currency])
  const engine = useKitTable({
    rows: pos,
    columns,
    rowKey: (r) => r.id,
    prefsKey: 'mua-hang-hang-muc-don',
    foot: {
      label: `Cộng ${so.n} đơn đã đặt`,
      note: `Đã đặt ${tien(so.ordered, h.currency)} · đã về ${tien(so.received_net, h.currency)} · đã trả ${tien(so.paid, h.currency)} — KHÔNG gồm ${so.nhap ? `${so.nhap} đơn nháp (${tien(so.nhap_gross, h.currency)}), ` : ''}đơn huỷ, phí vận chuyển${so.khac_tien_te ? `, ${so.khac_tien_te} đơn khác tiền tệ` : ''}.`, // prettier-ignore
    },
  })

  async function doiTrangThai() {
    setBusy(true)
    try {
      await api(`/api/dept/supply/projects/${h.id}`, { method: 'PATCH', body: { status: mo ? 'closed' : 'open' } }) // prettier-ignore
      toast.success(mo ? `Đã đóng ${h.code}` : `Đã mở lại ${h.code}`, mo ? 'Không chọn được cho đơn mới; đơn cũ giữ nguyên.' : undefined) // prettier-ignore
      router.refresh()
    } catch (e) {
      toast.error('Không đổi được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const vuot = h.budget != null ? so.ordered - h.budget : 0
  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow={`Hạng mục ngoài sản xuất · ${h.code}`}
        title={h.name}
        status={
          mo ? (
            <Tag tone="run">Đang mở</Tag>
          ) : (
            <Tag>Đã đóng {h.closed_at ? ngay(h.closed_at) : ''}</Tag>
          )
        }
        facts={[
          { label: 'Loại', value: h.kind },
          { label: 'Phụ trách', value: h.owner_name ?? '—' },
          { label: 'Mở từ', value: <span className="num">{ngay(h.created_at)}</span> },
          ...(h.note ? [{ label: 'Ghi chú', value: h.note }] : []),
          ...(h.chu_y.length ? [{ label: 'Cần chú ý', value: h.chu_y.join(' · '), tone: 'warn' as const }] : []), // prettier-ignore
        ]}
        actions={
          <>
            <Btn
              icon="them"
              primary
              blockedBy={!canManage ? 'phòng Cung ứng' : !mo ? 'hạng mục đã đóng — mở lại trước' : undefined} // prettier-ignore
              onClick={() => router.push(`/mua-hang/don/moi?hm=${h.id}`)}
            >
              Đơn mua cho hạng mục
            </Btn>
            <Btn
              icon="sua"
              blockedBy={canManage ? undefined : 'phòng Cung ứng'}
              onClick={() => setSua(true)}
            >
              Sửa
            </Btn>
            <Btn
              busy={busy}
              blockedBy={canManage ? undefined : 'phòng Cung ứng'}
              onClick={() => void doiTrangThai()}
            >
              {mo ? 'Đóng hạng mục' : 'Mở lại'}
            </Btn>
          </>
        }
      />
      <MetricStrip>
        <Metric
          label="Dự toán"
          value={h.budget != null ? tien(h.budget, h.currency) : '—'}
          basis={
            h.budget != null
              ? 'chỉ để theo dõi — không chặn đơn'
              : 'chưa đặt — bấm Sửa để thêm'
          }
        />
        <Metric
          label="Đã đặt"
          value={tien(so.ordered, h.currency)}
          basis={`${so.n} đơn, gồm VAT${so.pct != null ? ` · ${so.pct}% dự toán` : ''}${vuot > 0.005 ? ` · vượt ${tien(vuot, h.currency)}` : ''}`} // prettier-ignore
          tone={so.pct != null && so.pct >= NGUONG_DU_TOAN ? 'warn' : undefined}
        />
        <Metric
          label="Đã về"
          value={so.n ? tien(so.received_net, h.currency) : null}
          basis="theo phiếu kho, chưa VAT"
        />
        <Metric
          label="Đã có hoá đơn"
          value={so.n ? tien(so.invoiced_gross, h.currency) : null}
          basis="gồm VAT, hoá đơn đã ghi sổ"
        />
        <Metric
          label="Đã trả"
          value={so.n ? tien(so.paid, h.currency) : null}
          basis={
            so.owed > 0.005
              ? `còn nợ NCC ${tien(so.owed, h.currency)}`
              : 'không còn nợ trên hoá đơn'
          }
          tone={so.owed > 0.005 ? 'warn' : undefined}
        />
      </MetricStrip>
      {pos.length === 0 ? (
        <Empty
          headline="Hạng mục chưa có đơn mua nào"
          reason="Đơn ngoài lệnh chọn hạng mục ở ô “Cho việc” của màn soạn đơn."
          next={
            mo && canManage ? (
              <Btn
                icon="them"
                primary
                onClick={() => router.push(`/mua-hang/don/moi?hm=${h.id}`)}
              >
                Soạn đơn đầu tiên cho hạng mục
              </Btn>
            ) : (
              'Mở lại hạng mục rồi soạn đơn.'
            )
          }
        />
      ) : (
        <Table engine={engine} />
      )}
      <StatusBar
        left={['Bấm mã đơn để mở đơn mua']}
        right={`${pos.length} đơn · ${so.nhap} nháp`}
      />
      {sua && (
        <HangMucSheet
          ban={{ id: h.id, name: h.name, kind: h.kind, budget: h.budget, note: h.note, currency: h.currency }} // prettier-ignore
          goiYLoai={goiYMucDich(kinds)}
          onClose={() => setSua(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </ScreenFrame>
  )
}
