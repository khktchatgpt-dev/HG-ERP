'use client'

import { useMemo, useState } from 'react'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Crumb,
  Empty,
  FilterBar,
  MasterWarn,
  Metric,
  MetricStrip,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
} from '@/components/kit'

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
  payment_terms: string | null
  note: string | null
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

export function HoSoNccScreen({
  ncc,
  pos,
  gia,
  canEdit,
}: {
  ncc: Ncc
  pos: Po[]
  gia: Gia[]
  canEdit: boolean
}) {
  const [tab, setTab] = useState<'don' | 'gia'>('don')

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
        eyebrow={ncc.type ?? 'Nhà cung cấp'}
        title={
          <span className="flex items-center gap-2">
            {ncc.name}
            {ncc.code && (
              <span className="num text-[11px] text-[var(--ink-3)]">{ncc.code}</span>
            )}
            {ngung && <Tag tone="warn">Ngừng giao dịch</Tag>}
            {!ncc.can_order && <Tag tone="stop">Khoá đặt hàng</Tag>}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Btn href={`/mua-hang/don?ncc=${ncc.id}`}>Lọc đơn của NCC</Btn>
              <Btn href={`/planning/suppliers/${ncc.id}`}>Sửa hồ sơ</Btn>
              <Btn primary href={`/mua-hang/don/moi?ncc=${ncc.id}`}>
                + Soạn đơn
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
        <Chip on={tab === 'don'} count={pos.length} onClick={() => setTab('don')}>
          Đơn mua
        </Chip>
        <Chip on={tab === 'gia'} count={gia.length} onClick={() => setTab('gia')}>
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
                <Btn primary href={`/mua-hang/don/moi?ncc=${ncc.id}`}>
                  Soạn đơn đầu tiên
                </Btn>
              ) : (
                <Btn href="/mua-hang/ncc">Về danh sách</Btn>
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
            <TFoot
              label={<td colSpan={4}>Cộng {pos.length} đơn</td>}
              cells={<td className="num">{tien.join(' · ')}</td>}
              caveat={
                pos.length > song.length
                  ? `Chưa gồm ${pos.length - song.length} đơn đã huỷ. Cộng riêng từng loại tiền, KHÔNG quy đổi.`
                  : 'Cộng riêng từng loại tiền, KHÔNG quy đổi.'
              }
            />
          </Table>
        )
      ) : gia.length === 0 ? (
        <Empty
          headline="Chưa có giá nào của nhà cung cấp này"
          reason="Giá chỉ tính từ ĐƠN ĐÃ GỬI NCC trở đi — đơn còn nháp hay chờ duyệt thì giá chưa phải giá chốt."
          next={<Btn onClick={() => setTab('don')}>Xem đơn mua</Btn>}
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
                      href={`/mua-hang/vat-tu?q=${encodeURIComponent(g.code)}`}
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
                      <span className="text-[10.5px] text-[var(--ink-3)]">
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
          <TFoot
            label={<td colSpan={4}>Cộng {gia.length} mã đã mua của NCC này</td>}
            cells={null}
            caveat="Giá của lần mua gần nhất. So giá giữa các NCC thì mở trang Bảng giá."
          />
        </Table>
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
