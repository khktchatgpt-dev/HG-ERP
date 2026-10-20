'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
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
  Num,
  NumInput,
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
  showMoney,
  useToast,
} from '@/components/kit'
import {
  PhapLyNganHang,
  emptyPhapLy,
  phapLyBody,
  type PhapLy,
} from '../phap-ly-ngan-hang'

type Ncc = {
  id: string
  code: string | null
  name: string
  short_name: string | null
  type: string | null
  status: string
  is_active: boolean
  can_order: boolean
  lock_reason: string | null
  tax_no: string | null
  phone: string | null
  email: string | null
  address: string | null
  legal_rep: string | null
  company_name: string | null
  registered_address: string | null
  bank_name: string | null
  bank_account: string | null
  swift_code: string | null
  payment_terms: string | null
  payment_net_days: number | null
  lead_time_days: number | null
  contact_name: string | null
  contact_phone: string | null
  note: string | null
  /** Người phụ trách gán tay (null = chưa gán). */
  buyer_id: string | null
  /** Tên người phụ trách đang áp dụng — gán tay, hoặc suy từ đơn. */
  buyer_name: string | null
  buyer_src: 'gan' | 'suy' | null
}

type Po = {
  id: string
  code: string
  status: string
  currency: string
  created_at: string
  expected_at: string | null
  lsx_code: string | null
  total: number
}

type Gia = {
  material_id: string
  code: string
  name: string
  price: number
  unit: string
  currency: string
  price_unit: string | null
  at: string
  times: number
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const DONE = new Set(['received'])
const MO = new Set(['ordered', 'confirmed', 'in_transit', 'partial'])

/**
 * SỬA HỒ SƠ NGAY TRONG KHU MỚI (17/09/2026).
 *
 * Tới hôm nay, nút "Sửa hồ sơ" và "Thêm / sửa hồ sơ" đều đá người dùng sang
 * `/planning/suppliers` — khu cũ, vỏ khác, từ vựng khác, mất luôn thanh điều
 * hướng của Mua hàng. Đây là hai đường cuối cùng trong khu còn làm vậy trên
 * đường đi hằng ngày.
 *
 * CHỈ MƯỜI BA Ô, KHÔNG PHẢI CẢ HỒ SƠ. Form bên khu cũ có sáu mảng và hơn 40 ô
 * (pháp lý, ngân hàng, đánh giá, incoterms…). Người MUA không khai mấy thứ đó
 * — kế toán và trưởng phòng mới khai, và họ khai một lần lúc lập hồ sơ. Ở đây
 * giữ đúng những ô người mua sửa trong ngày: gọi ai, số nào, địa chỉ nào, trả
 * tiền kiểu gì. Khu cũ đã xoá 29/09/2026, nên pháp lý + ngân hàng nay nằm ở
 * khối GẬP cuối phiếu (`PhapLyNganHang`, dùng chung với panel Thêm NCC).
 *
 * `TextInput` của kit chốt giá trị khi RỜI Ô (`onCommit`), nên state ở đây là
 * bản nháp của cả phiếu; bấm Lưu mới gọi API — không có chuyện gõ nửa chừng đã
 * ghi xuống CSDL.
 */
function SuaHoSo({
  ncc,
  buyers,
  onClose,
  onSaved,
}: {
  ncc: Ncc
  buyers: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    name: ncc.name,
    short_name: ncc.short_name ?? '',
    type: ncc.type ?? '',
    status: ncc.status,
    contact_name: ncc.contact_name ?? '',
    contact_phone: ncc.contact_phone ?? '',
    phone: ncc.phone ?? '',
    email: ncc.email ?? '',
    tax_no: ncc.tax_no ?? '',
    address: ncc.address ?? '',
    payment_terms: ncc.payment_terms ?? '',
    payment_net_days: ncc.payment_net_days == null ? '' : String(ncc.payment_net_days),
    lead_time_days: ncc.lead_time_days == null ? '' : String(ncc.lead_time_days),
    note: ncc.note ?? '',
    buyer_id: ncc.buyer_id ?? '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const [legal, setLegal] = useState<PhapLy>(() => emptyPhapLy(ncc))

  async function save() {
    if (!f.name.trim()) return
    setBusy(true)
    try {
      const s = (x: string) => x.trim() || null
      await api(`/api/dept/supply/suppliers/${ncc.id}`, {
        method: 'PATCH',
        body: {
          name: f.name.trim(),
          short_name: s(f.short_name),
          type: s(f.type),
          status: f.status,
          contact_name: s(f.contact_name),
          contact_phone: s(f.contact_phone),
          phone: s(f.phone),
          email: f.email.trim(),
          tax_no: s(f.tax_no),
          address: s(f.address),
          payment_terms: s(f.payment_terms),
          // Ô số trống = CHƯA KHAI (null), khác hẳn 0 = trả ngay / về trong ngày.
          payment_net_days: f.payment_net_days.trim() === '' ? null : Number(f.payment_net_days), // prettier-ignore
          lead_time_days: f.lead_time_days.trim() === '' ? null : Number(f.lead_time_days), // prettier-ignore
          note: s(f.note),
          buyer_id: f.buyer_id || null,
          ...phapLyBody(legal),
        },
      })
      toast.success('Đã lưu hồ sơ', ncc.name)
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
      title="Sửa hồ sơ nhà cung cấp"
      subtitle={ncc.code ? `${ncc.name} · ${ncc.code}` : ncc.name}
      stakes="nhe"
      width={520}
      footer={
        <SheetActions
          stakes="nhe"
          busy={busy}
          disabled={!f.name.trim()}
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel="Lưu hồ sơ"
        />
      }
    >
      <FieldGrid>
        <Field label="Tên nhà cung cấp">
          <TextInput value={f.name} onCommit={set('name')} label="Tên nhà cung cấp" />
        </Field>
        <Field label="Tên viết tắt">
          <TextInput
            value={f.short_name}
            onCommit={set('short_name')}
            label="Tên viết tắt"
            placeholder="hiện ở ô chọn NCC lúc soạn đơn"
          />
        </Field>
        <Field label="Mặt hàng">
          <TextInput
            value={f.type}
            onCommit={set('type')}
            label="Mặt hàng"
            placeholder="Bao bì, Sơn, Gia công…"
          />
        </Field>
        <Field label="Người phụ trách">
          <Pick
            label="Người phụ trách"
            value={f.buyer_id}
            onChange={set('buyer_id')}
            options={[
              {
                value: '',
                label:
                  ncc.buyer_src === 'suy' && ncc.buyer_name
                    ? `— chưa gán (đang suy: ${ncc.buyer_name})`
                    : '— chưa gán',
              },
              ...buyers.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <Field label="Trạng thái">
          <Pick
            label="Trạng thái"
            value={f.status}
            onChange={set('status')}
            options={[
              { value: 'active', label: 'Đang giao dịch' },
              { value: 'suspended', label: 'Tạm ngưng' },
              { value: 'terminated', label: 'Ngừng hợp tác' },
            ]}
          />
        </Field>
      </FieldGrid>

      <div className="k-sec">Liên hệ</div>
      <FieldGrid>
        <Field label="Người liên hệ">
          <TextInput
            value={f.contact_name}
            onCommit={set('contact_name')}
            label="Người liên hệ"
            placeholder="tên người mình gọi"
          />
        </Field>
        <Field label="Số máy người liên hệ">
          <TextInput
            value={f.contact_phone}
            onCommit={set('contact_phone')}
            label="Số máy người liên hệ"
            mono
          />
        </Field>
        <Field label="Điện thoại công ty">
          <TextInput value={f.phone} onCommit={set('phone')} label="Điện thoại" mono />
        </Field>
        <Field label="Email">
          <TextInput value={f.email} onCommit={set('email')} label="Email" />
        </Field>
        <Field label="Mã số thuế">
          <TextInput value={f.tax_no} onCommit={set('tax_no')} label="Mã số thuế" mono />
        </Field>
        <Field label="Địa chỉ giao dịch">
          <TextInput value={f.address} onCommit={set('address')} label="Địa chỉ" />
        </Field>
      </FieldGrid>

      <div className="k-sec">Thanh toán &amp; giao hàng</div>
      <FieldGrid note="Ba ô này là thứ form soạn đơn đọc để MỒI xuống đơn mới. Bỏ trống thì mỗi lần soạn phải gõ lại từ đầu — đo 17/09/2026: 2/170 NCC có điều khoản, 1/170 có lead time.">
        <Field label="Điều khoản thanh toán">
          <TextInput
            value={f.payment_terms}
            onCommit={set('payment_terms')}
            label="Điều khoản thanh toán"
            placeholder="COD, NET 30, cuối tháng…"
          />
        </Field>
        <Field label="Số ngày công nợ">
          <NumInput
            value={f.payment_net_days}
            onCommit={set('payment_net_days')}
            aria-label="Số ngày công nợ"
          />
        </Field>
        <Field label="Lead time">
          <NumInput
            value={f.lead_time_days}
            onCommit={set('lead_time_days')}
            aria-label="Lead time — số ngày"
          />
        </Field>
      </FieldGrid>

      <div className="mt-3">
        <PhapLyNganHang
          value={legal}
          onChange={(k, v) => setLegal((s) => ({ ...s, [k]: v }))}
        />
      </div>

      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={f.note}
        onChange={set('note')}
        rows={3}
        placeholder="Điều cần nhớ khi làm việc với NCC này"
      />
    </Sheet>
  )
}

export function HoSoNccScreen({
  ncc,
  pos,
  gia,
  canEdit,
  buyers,
}: {
  ncc: Ncc
  pos: Po[]
  gia: Gia[]
  canEdit: boolean
  /** Người mua (thành viên Cung ứng) — lựa chọn cho ô Người phụ trách. */
  buyers: { id: string; name: string }[]
}) {
  const [tab, setTab] = useState<'don' | 'gia'>('don')
  const [sua, setSua] = useState(false)
  const router = useRouter()

  const song = useMemo(() => pos.filter((p) => p.status !== 'cancelled'), [pos])
  const daNhan = song.filter((p) => DONE.has(p.status))
  const dangMo = song.filter((p) => MO.has(p.status))

  /*
    CỐ Ý CHƯA CÓ Ô "GIAO ĐÚNG HẸN".

    Tính đúng hẹn cần NGÀY THỰC NHẬN của từng đơn để so với ngày hẹn, mà bảng
    đơn ở màn này không mang `received_at`. Lấy tạm trạng thái "đã về đủ" rồi
    coi là đúng hẹn thì mọi NCC đều 100% — một con số đẹp và sai. Thà thiếu
    một ô còn hơn thêm một ô nói dối; khi nào nối được ngày thực nhận thì thêm,
    kèm mẫu số "x/y đơn có hẹn ngày" như mẫu ở /design-lab/mau-ho-so-ncc.
  */

  const tien = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of song) m[p.currency] = (m[p.currency] ?? 0) + p.total
    return Object.entries(m)
      .filter(([, v]) => v > 0)
      .map(([c, v]) => `${showMoney(v, { digits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`) // prettier-ignore
  }, [song])

  const ngung = ncc.status !== 'active' || !ncc.is_active
  const donGanNhat = song.length > 0 ? song.map((p) => p.created_at).sort().at(-1) ?? null : null // prettier-ignore

  return (
    <ScreenFrame>
      <Crumb
        path={['Mua hàng', { label: 'Nhà cung cấp', href: '/mua-hang/ncc' }, ncc.short_name ?? ncc.name]} // prettier-ignore
      />
      <ScreenHeader
        compact
        eyebrow={[
          ncc.type ?? 'Nhà cung cấp',
          ncc.buyer_name
            ? `phụ trách: ${ncc.buyer_name}${ncc.buyer_src === 'suy' ? ' (suy từ đơn)' : ''}`
            : 'chưa có người phụ trách',
        ].join(' · ')}
        title={
          <span className="flex items-center gap-2">
            {ncc.name}
            {ncc.code && (
              <span className="num text-k-label text-[var(--ink-3)]">{ncc.code}</span>
            )}
            {ngung && <Tag tone="warn">Ngừng giao dịch</Tag>}
            {!ncc.can_order && <Tag tone="stop">Khoá đặt hàng</Tag>}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Btn icon="don" href={`/mua-hang/don?ncc=${ncc.id}`}>
                Lọc đơn của NCC
              </Btn>
              <Btn icon="sua" onClick={() => setSua(true)}>
                Sửa hồ sơ
              </Btn>
              <Btn primary icon="them" href={`/mua-hang/don/moi?ncc=${ncc.id}`}>
                Soạn đơn
              </Btn>
            </>
          ) : undefined
        }
      />

      {/*
        DẢI HIỆU SUẤT — thay chỗ của ba trục trạng thái ở Khuôn D. Hồ sơ danh
        mục không có vòng đời duyệt, nên thứ người mua cần ở đầu trang là "làm
        ăn ra sao", và MỖI Ô PHẢI KÈM MẪU SỐ (luật 6 của sổ thiết kế).
      */}
      <MetricStrip>
        <Metric
          label="Đã đặt"
          value={String(song.length)}
          basis={`${daNhan.length} đơn đã về đủ${pos.length > song.length ? ` · ${pos.length - song.length} đơn đã huỷ không tính` : ''}`} // prettier-ignore
        />
        <Metric
          label="Đang mở"
          value={String(dangMo.length)}
          basis="đã gửi NCC, chưa về đủ"
          tone={dangMo.length > 0 ? 'warn' : undefined}
        />
        <Metric
          label="Tổng chi"
          value={tien.length > 0 ? tien.join(' · ') : null}
          basis={tien.length > 0 ? `${song.length} đơn, không tính huỷ · cộng riêng từng loại tiền` : 'chưa đơn nào có tiền'} // prettier-ignore
        />
        <Metric
          label="Mã đang mua"
          value={String(gia.length)}
          basis="mã đã từng mua của NCC này, có giá"
        />
        {/*
          Ô KHÔNG ĐO ĐƯỢC — khác hẳn ô bằng 0. Điểm chất lượng là số CHẤM TAY
          và chỉ 1/164 NCC có; hiện "0 điểm" ở đây là vu cho 163 NCC còn lại.
        */}
        <Metric
          label="Điểm chất lượng"
          value={null}
          basis="chưa ai chấm — 1/164 NCC có điểm"
        />
      </MetricStrip>

      {/*
        "DÙNG Ở ĐÂU" — khối riêng của Khuôn E. Chứng từ không có câu hỏi này;
        hồ sơ thì không được khoá hay ngừng giao dịch khi chưa biết mình đang
        đỡ bao nhiêu thứ đang chạy.
      */}
      <MasterWarn
        used={
          <>
            <b>{dangMo.length} đơn đang mở</b>
            {gia.length > 0 && <> · {gia.length} mã vật tư đã mua</>}
            {donGanNhat && <> · đơn gần nhất {ngay(donGanNhat)}</>}
          </>
        }
      />

      {/*
        Hai khung nhìn của hồ sơ dùng `Chip` của kit, không phải `<button>` thô
        — cổng `hg/no-raw-control` chặn đúng chỗ này. Chip lại hợp hơn tab: nó
        mang sẵn SỐ ĐẾM, nên người đọc biết bên kia có gì trước khi bấm sang.
      */}
      <FilterBar>
        <Chip
          icon="don"
          on={tab === 'don'}
          count={pos.length}
          onClick={() => setTab('don')}
        >
          Đơn mua
        </Chip>
        <Chip
          icon="tien"
          on={tab === 'gia'}
          count={gia.length}
          onClick={() => setTab('gia')}
        >
          Giá đã mua
        </Chip>
      </FilterBar>

      {tab === 'don' ? (
        pos.length === 0 ? (
          <Empty
            headline="Chưa đặt đơn nào của nhà cung cấp này"
            reason="Hồ sơ đã khai nhưng chưa có lần mua nào qua hệ thống — đó là chuyện bình thường với NCC mới hoặc NCC dự phòng, không phải dữ liệu thiếu."
            next={
              canEdit ? (
                <Btn icon="them" primary href={`/mua-hang/don/moi?ncc=${ncc.id}`}>
                  Soạn đơn đầu tiên
                </Btn>
              ) : (
                <Btn icon="quayLai" href="/mua-hang/ncc">
                  Về danh sách
                </Btn>
              )
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Đơn</th>
              <th>Lệnh sản xuất</th>
              <th>Trạng thái</th>
              <th>Ngày lập</th>
              <th>Hẹn giao</th>
              <th style={{ textAlign: 'right' }}>Giá trị</th>
            </THead>
            <tbody>
              {[...pos]
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                .map((p) => (
                  <Row key={p.id}>
                    <Cell pin>
                      <Code as="a" href={`/mua-hang/don/${p.id}`}>
                        {p.code}
                      </Code>
                    </Cell>
                    <Cell grow muted>
                      {p.lsx_code ?? 'Ngoài lệnh'}
                    </Cell>
                    <Cell>
                      <Tag
                        tone={
                          p.status === 'cancelled'
                            ? 'neutral'
                            : p.status === 'received'
                              ? 'done'
                              : 'neutral'
                        }
                      >
                        {PO_STATUS_LABEL[p.status as PoStatus] ?? p.status}
                      </Tag>
                    </Cell>
                    <Cell muted>
                      <span className="num">{ngay(p.created_at)}</span>
                    </Cell>
                    <Cell muted>
                      {p.expected_at ? (
                        <span className="num">{ngay(p.expected_at)}</span>
                      ) : (
                        <span className="text-[var(--warn)]">chưa hẹn</span>
                      )}
                    </Cell>
                    <Cell num>
                      <Num
                        value={showMoney(p.total, {
                          digits: p.currency === 'VND' ? 0 : 2,
                        })}
                      />
                    </Cell>
                  </Row>
                ))}
            </tbody>
            {/*
              CỘT CHÂN BẢNG = 6, BẰNG `THead`. Bản cũ cộng ra 7 (4 + 1 +
              caveat 2), và ô số đứng ở cột "Hẹn giao" thay vì "Giá trị".
              Chú thích gộp vào ô nhãn — xem bẫy ở `TFoot`.
            */}
            <TFoot
              label={
                <td colSpan={5}>
                  Cộng {pos.length} đơn
                  <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                    ·{' '}
                    {pos.length > song.length
                      ? `chưa gồm ${pos.length - song.length} đơn đã huỷ; cộng riêng từng loại tiền, KHÔNG quy đổi`
                      : 'cộng riêng từng loại tiền, KHÔNG quy đổi'}
                  </span>
                </td>
              }
              cells={<td className="num">{tien.join(' · ')}</td>}
            />
          </Table>
        )
      ) : gia.length === 0 ? (
        <Empty
          headline="Chưa có giá nào của nhà cung cấp này"
          reason="Giá chỉ tính từ ĐƠN ĐÃ GỬI NCC trở đi — đơn còn nháp hay chờ duyệt thì giá chưa phải giá chốt."
          next={
            <Btn icon="don" onClick={() => setTab('don')}>
              Xem đơn mua
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Mã vật tư</th>
            <th>Tên</th>
            <th style={{ textAlign: 'right' }}>Giá gần nhất</th>
            <th>Mua lần cuối</th>
            <th style={{ textAlign: 'right' }}>Số lần</th>
          </THead>
          <tbody>
            {[...gia]
              .sort((a, b) => (a.at < b.at ? 1 : -1))
              .map((g) => (
                <Row key={g.code}>
                  <Cell pin>
                    <Code
                      as="a"
                      href={`/mua-hang/vat-tu/${g.material_id}`}
                    >
                      {g.code}
                    </Code>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={g.name}>
                      {g.name}
                    </span>
                  </Cell>
                  <Cell num>
                    <span className="flex items-baseline justify-end gap-1">
                      <Num
                        value={showMoney(g.price, {
                          digits: g.currency === 'VND' ? 0 : 2,
                        })}
                        strong
                      />
                      <span className="text-k-label text-[var(--ink-3)]">
                        {g.currency === 'VND' ? '₫' : g.currency}/{g.price_unit ?? g.unit}
                      </span>
                    </span>
                  </Cell>
                  <Cell muted>
                    <span className="num">{ngay(g.at)}</span>
                  </Cell>
                  <Cell num>
                    <Num value={String(g.times)} />
                  </Cell>
                </Row>
              ))}
          </tbody>
          {/* CỘT CHÂN BẢNG = 5, BẰNG `THead` (bản cũ: 4 + caveat 2 = 6). */}
          <TFoot
            label={<td colSpan={2}>Cộng {gia.length} mã đã mua của NCC này</td>}
            cells={null}
            caveatSpan={3}
            caveat="Giá của lần mua gần nhất. So giá giữa các NCC thì mở trang Bảng giá."
          />
        </Table>
      )}

      {sua && (
        <SuaHoSo
          ncc={ncc}
          buyers={buyers}
          onClose={() => setSua(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <StatusBar
        left={[
          ncc.phone ? `ĐT ${ncc.phone}` : 'Chưa có số điện thoại',
          ncc.tax_no ? `MST ${ncc.tax_no}` : 'Chưa có MST',
          ncc.address ?? '',
        ].filter(Boolean)}
        right={`${pos.length} đơn · ${gia.length} mã`}
      />
    </ScreenFrame>
  )
}
