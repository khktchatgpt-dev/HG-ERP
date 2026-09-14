'use client'

import type { LsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import {
  Btn,
  Cell,
  Code,
  CoverageBar,
  Crumb,
  Empty,
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
  showNum,
} from '@/components/kit'

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const conLai = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

export function LenhScreen({
  lsx,
  today,
  canEdit,
}: {
  lsx: LsxSupplyDetail
  today: string
  canEdit: boolean
}) {
  const { coverage: cv } = lsx
  const moc = lsx.materials_due_at ?? lsx.ship_date
  const con = conLai(moc, today)

  const tien: Record<string, number> = {}
  for (const p of lsx.pos) {
    if (p.status === 'cancelled') continue
    tien[p.currency] = (tien[p.currency] ?? 0) + (p.amount ?? 0)
  }
  const tienText = Object.entries(tien)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `${showMoney(v, { digits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`) // prettier-ignore

  const chuaGui = lsx.pos.filter((p) => p.status === 'draft' || p.status === 'pending_approval').length // prettier-ignore
  const tre = lsx.pos.filter((p) => p.late).length

  return (
    <ScreenFrame>
      <Crumb
        path={[
          'Mua hàng',
          { label: 'Vật tư theo lệnh', href: '/mua-hang/yeu-cau' },
          lsx.code,
        ]}
      />
      <ScreenHeader
        compact
        eyebrow={lsx.customer_name}
        title={lsx.code}
        facts={[
          { label: 'Sản phẩm', value: String(lsx.products.length) },
          {
            label: 'Mã còn hụt',
            value: String(cv.missing),
            tone: cv.missing > 0 ? 'stop' : 'done',
          },
          {
            label: 'Mốc vật tư',
            value: moc ? ngay(moc) : 'chưa có',
            tone: moc ? (con != null && con < 0 ? 'stop' : 'neutral') : 'warn',
          },
          { label: 'Đơn mua', value: String(lsx.pos.length) },
        ]}
        actions={
          <>
            {/*
              BÁO CÁO CỦA RIÊNG LỆNH NÀY — `lsx-report` đã có sẵn 6 sheet (Lệnh ·
              Cần mua · Đặt cho ai · Kỹ thuật cần xử lý · Phân bổ theo SP · Đơn
              mua) cộng một sheet mỗi đơn. Khu mới trước nay không có nút nào
              dẫn tới, nên phần công phu nhất của phòng nằm ngoài tầm với.
            */}
            <Btn href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=lsx`}>
              Báo cáo lệnh
            </Btn>
            <Btn href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=bangke`}>
              Bảng kê vật tư
            </Btn>
            {canEdit && (
              <>
                <Btn href={`/mua-hang/don?lsx=${lsx.id}`}>Lọc đơn của lệnh</Btn>
                <Btn primary href={`/mua-hang/don/moi?lsx=${lsx.id}`}>
                  + Đặt thêm
                </Btn>
              </>
            )}
          </>
        }
      />

      {/*
        DẢI ĐỘ PHỦ — câu hỏi số một của người mua khi mở một lệnh: còn thiếu
        mấy mã. Mỗi ô kèm MẪU SỐ (luật 6 của sổ thiết kế): "12 / 37 mã" nói
        được điều mà "12" một mình không nói.
      */}
      <MetricStrip>
        <Metric
          label="Đã đủ"
          value={`${cv.covered}/${cv.needed}`}
          basis="tồn khả dụng + đã đặt ≥ còn cần"
          tone={cv.missing === 0 ? 'done' : undefined}
        />
        <Metric
          label="Còn phải đặt"
          value={String(cv.missing)}
          basis={`trên ${cv.needed} mã lệnh cần`}
          tone={cv.missing > 0 ? 'stop' : 'done'}
        />
        <Metric
          label="Đơn chưa gửi NCC"
          value={String(chuaGui)}
          basis={`trên ${lsx.pos.length} đơn của lệnh`}
          tone={chuaGui > 0 ? 'warn' : undefined}
        />
        <Metric
          label="NCC trễ hẹn"
          value={String(tre)}
          basis="đã gửi, qua hẹn chưa về đủ"
          tone={tre > 0 ? 'stop' : undefined}
        />
      </MetricStrip>

      {cv.missing > 0 && cv.missing_top.length > 0 && (
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px] text-[var(--fs-sm)]">
          <b className="text-[var(--ink)]">Còn phải đặt:</b>{' '}
          {cv.missing_top.map((m, i) => (
            <span key={m.code}>
              {i > 0 && ' · '}
              <span className="num text-[var(--act)]">{m.code}</span>{' '}
              <span className="text-[var(--ink-2)]">{m.name}</span>{' '}
              <span className="num text-[var(--ink-3)]">
                {showNum(m.qty)} {m.unit}
              </span>
            </span>
          ))}
          {cv.missing > cv.missing_top.length && (
            <span className="text-[var(--ink-3)]">
              {' '}
              · và {cv.missing - cv.missing_top.length} mã nữa
            </span>
          )}
        </div>
      )}

      {lsx.pos.length === 0 ? (
        <Empty
          headline="Lệnh này chưa có đơn mua nào"
          reason={
            cv.missing > 0
              ? `Lệnh còn ${cv.missing} mã chưa đủ — chúng chưa nằm trên đơn nào, nên chưa ai đang lo mua.`
              : 'Tồn kho và các đơn hiện có đã phủ đủ nhu cầu của lệnh, nên chưa cần đặt thêm.'
          }
          next={
            canEdit ? (
              <Btn primary href={`/mua-hang/don/moi?lsx=${lsx.id}`}>
                Soạn đơn cho lệnh này
              </Btn>
            ) : (
              <Btn href="/mua-hang/yeu-cau">Về danh sách lệnh</Btn>
            )
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Đơn</th>
            <th>Nhà cung cấp</th>
            <th>Trạng thái</th>
            <th>Hẹn giao</th>
            <th>Về kho</th>
            <th>Phụ trách</th>
            <th style={{ textAlign: 'right' }}>Giá trị</th>
          </THead>
          <tbody>
            {lsx.pos.map((p) => {
              const conP = conLai(p.expected_at, today)
              return (
                <Row key={p.id}>
                  <Cell pin>
                    <span className="flex items-center gap-2">
                      <Code as="a" href={`/mua-hang/don/${p.id}`}>
                        {p.code}
                      </Code>
                      {/*
                        ĐƠN MUA CHUNG của lệnh khác (0125) phải nói ra: nó nằm
                        đây vì có mua hộ lệnh này, nhưng tiền và tiến độ của nó
                        không thuộc riêng lệnh này.
                      */}
                      {p.shared && (
                        <Tag tone="neutral">
                          mua chung
                          {p.shared_with.length > 0
                            ? ` · ${p.shared_with.join(', ')}`
                            : ''}
                        </Tag>
                      )}
                    </span>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={p.supplier_name}>
                      {p.supplier_name}
                    </span>
                  </Cell>
                  <Cell>
                    <Tag
                      tone={
                        p.status === 'cancelled'
                          ? 'neutral'
                          : p.status === 'received'
                            ? 'done'
                            : p.late
                              ? 'stop'
                              : 'neutral'
                      }
                    >
                      {PO_STATUS_LABEL[p.status as PoStatus] ?? p.status}
                    </Tag>
                  </Cell>
                  <Cell muted>
                    {p.expected_at ? (
                      <span className="flex items-baseline gap-2">
                        <span className="num">{ngay(p.expected_at)}</span>
                        {conP != null && conP < 0 && p.status !== 'received' && (
                          <span className="text-[var(--stop)]">quá {-conP} ngày</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa hẹn</span>
                    )}
                  </Cell>
                  <Cell>
                    {p.line_count > 0 ? (
                      <CoverageBar
                        ratio={(p.line_count - p.lines_missing) / p.line_count}
                        label={`${p.line_count - p.lines_missing}/${p.line_count}`}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  <Cell muted>{p.assignee_name ?? '—'}</Cell>
                  <Cell num>
                    <span className="flex items-baseline justify-end gap-1">
                      <Num
                        value={showMoney(p.amount, {
                          digits: p.currency === 'VND' ? 0 : 2,
                        })}
                      />
                      {/*
                        DÒNG CHƯA CÓ GIÁ làm con số trên thành số DƯỚI thực tế.
                        Nói ngay cạnh nó, không để người đọc mang đi cộng.
                      */}
                      {p.unpriced_lines > 0 && (
                        <span className="text-[10.5px] text-[var(--warn)]">
                          {p.unpriced_lines} dòng chưa giá
                        </span>
                      )}
                    </span>
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={<td colSpan={5}>Cộng {lsx.pos.length} đơn của lệnh</td>}
            cells={<td className="num">{tienText.join(' · ')}</td>}
            caveat={
              lsx.pos.some((p) => p.unpriced_lines > 0)
                ? 'Chưa gồm dòng chưa có giá và đơn đã huỷ — con số trên là TẠM TÍNH, đừng dùng để duyệt chi.'
                : 'Cộng riêng từng loại tiền, KHÔNG quy đổi. Chưa gồm đơn đã huỷ.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          lsx.order_codes.length > 0 ? `Đơn hàng: ${lsx.order_codes.join(', ')}` : 'Không gắn đơn hàng', // prettier-ignore
          moc ? `Mốc vật tư ${ngay(moc)}${lsx.materials_due_at ? '' : ' (theo ngày xuất)'}` : 'Chưa đặt mốc vật tư', // prettier-ignore
        ]}
        right={`${lsx.pos.length} đơn · ${cv.missing} mã còn hụt`}
      />
    </ScreenFrame>
  )
}
