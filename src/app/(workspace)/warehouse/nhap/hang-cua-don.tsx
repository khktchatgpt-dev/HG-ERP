'use client'

import {
  Btn,
  Cell,
  Code,
  NoticeBar,
  Row,
  Sheet,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { ngay } from '@/lib/kho-hang-ve'
import type { HangCuaDonData } from './tai-hang-cua-don'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

const TRANG_THAI_DOT: Record<
  string,
  { label: string; tone: 'neutral' | 'warn' | 'done' }
> = {
  planned: { label: 'chưa tới', tone: 'neutral' },
  arrived: { label: 'NCC báo đã tới', tone: 'warn' },
  received: { label: 'đã nhận', tone: 'done' },
}

const LOAI_PHIEU: Record<string, string> = {
  receipt: 'Phiếu nhập',
  return: 'Trả NCC',
  reversal: 'Phiếu đảo',
  adjustment: 'Điều chỉnh',
}

/**
 * HỘP "HÀNG CỦA ĐƠN" — bản vẽ B1-3 (duyệt 12/10/2026). Thủ kho bấm mã đơn ở
 * Hàng về thì thấy đơn chở gì, đã về bao nhiêu, đợt nào sắp tới — mà không rời
 * khu Kho (NV Kho không vào được khu Mua hàng).
 *
 * CHỈ XEM. Việc với NCC (hẹn/dời đợt, chốt thiếu, đòi giao bù) là của Cung ứng —
 * hộp nói rõ ai giữ việc đó thay vì bày nút khoá.
 *
 * "Đợt đã nhập trước" (đợt mở mà mọi dòng đã hết phần chờ) được NÓI RA ở đầu
 * hộp: PO-2026-0100 đợt 1 hẹn 12/10 mà cả 6 dòng đã vào PNK-2026-0099 ngày 06/10.
 */
export function HangCuaDonSheet({
  data,
  today,
  canEdit,
  onClose,
}: {
  data: HangCuaDonData
  today: string
  canEdit: boolean
  onClose: () => void
}) {
  const { po, lines, shipments, docs, free_lines } = data
  const open = new Map(lines.map((l) => [l.id, l.open]))
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const xongDot = (s: (typeof shipments)[number]) =>
    s.lines.length > 0 && s.lines.every((l) => (open.get(l.po_line_id) ?? 1) <= 0)
  const mo = shipments
    .filter((s) => s.status === 'planned' || s.status === 'arrived')
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq))
  const daNhapTruoc = mo.filter(xongDot)
  const keTiep = mo.find((s) => !xongDot(s)) ?? null
  const conCho = lines.filter((l) => l.open > 0)
  const done = lines.filter((l) => l.open <= 0).length
  const phieuNhap = docs.filter((d) => d.kind === 'receipt' && !d.reversed_by)
  const tuDo = lines.length === 0

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Hàng của đơn ${po.code}`}
      subtitle={po.supplier_name}
      stakes="nhe"
      width={680}
      footer={
        <span className="flex w-full items-center gap-3">
          <span className="text-k-sm text-[var(--ink-3)]">
            {keTiep
              ? `Đợt kế tiếp: đợt ${keTiep.seq} · ${ngay(keTiep.date, today)}`
              : conCho.length > 0
                ? `Còn chờ ${conCho.length} dòng, chưa hẹn đợt`
                : 'Không còn dòng nào chờ về'}
          </span>
          <span className="ml-auto flex gap-2">
            <Btn onClick={onClose}>Đóng</Btn>
            {!tuDo && (
              <Btn
                icon="nhanHang"
                primary={canEdit}
                blockedBy={canEdit ? undefined : 'Kho'}
                href={`/warehouse/nhap/${po.id}${keTiep ? `?dot=${keTiep.id}` : ''}`}
              >
                Nhận hàng
              </Btn>
            )}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <dl className="text-k-sm grid grid-cols-4 gap-x-4 gap-y-0.5">
          <dt className="text-k-label text-[var(--ink-3)] uppercase">Lệnh SX</dt>
          <dt className="text-k-label text-[var(--ink-3)] uppercase">Hẹn giao (đơn)</dt>
          <dt className="text-k-label text-[var(--ink-3)] uppercase">Phụ trách</dt>
          <dt className="text-k-label text-[var(--ink-3)] uppercase">Về kho</dt>
          <dd className="num m-0 font-semibold">
            {po.lsx_code ?? '— ngoài lệnh'}
            {po.extra_lsx.length > 0 && (
              <span className="text-k-label ml-1 font-normal text-[var(--ink-3)]">
                + {po.extra_lsx.join(', ')}
              </span>
            )}
          </dd>
          <dd className="num m-0 font-semibold">
            {po.expected_at ? ngay(po.expected_at, today) : 'chưa hẹn'}
          </dd>
          <dd className="m-0 font-semibold">{po.assignee_name ?? '—'}</dd>
          <dd className="num m-0 font-semibold">
            {tuDo ? '—' : `${done}/${lines.length} dòng`}
          </dd>
        </dl>

        {daNhapTruoc.length > 0 && (
          <NoticeBar tone="warn" tag="Đã nhập trước">
            {daNhapTruoc.map((s) => `Đợt ${s.seq} hẹn ${ngay(s.date, today)}`).join(', ')}{' '}
            nhưng hàng của {daNhapTruoc.length > 1 ? 'các đợt này' : 'đợt này'} đã nhập đủ
            trước hạn — không phải chờ xe.{' '}
            {keTiep
              ? `Còn lại thuộc đợt ${keTiep.seq}, hẹn ${ngay(keTiep.date, today)}.`
              : conCho.length > 0
                ? `Còn ${conCho.length} dòng chờ, chưa hẹn đợt.`
                : 'Đơn không còn dòng nào chờ.'}
          </NoticeBar>
        )}

        {tuDo ? (
          <NoticeBar tone="neutral" tag="Không vào sổ kho">
            Đơn chỉ có {free_lines} dòng theo mã SP (gỗ…): không vào tồn kho, Cung ứng
            nghiệm thu ngoài sổ. Thủ kho chỉ cần biết có xe tới.
          </NoticeBar>
        ) : (
          <section aria-label="Dòng hàng">
            <h3 className="text-k-label mb-1 font-semibold text-[var(--ink-3)] uppercase">
              Dòng hàng
            </h3>
            <Table>
              <THead>
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                <th style={{ textAlign: 'right' }}>Đặt</th>
                <th style={{ textAlign: 'right' }}>Đã về</th>
                <th style={{ textAlign: 'right' }}>Còn chờ</th>
                <th>Đợt</th>
              </THead>
              <tbody>
                {lines.map((l) => (
                  <Row key={l.id}>
                    <Cell>
                      <span className="num">{l.code ?? '—'}</span>
                    </Cell>
                    <Cell grow title={l.name}>
                      <span className="truncate">{l.name}</span>
                    </Cell>
                    <Cell muted>{l.unit}</Cell>
                    <Cell num>{so(l.ordered)}</Cell>
                    <Cell num>{so(l.received)}</Cell>
                    <Cell num>
                      {l.closed_short ? (
                        <Tag tone="neutral">chốt thiếu</Tag>
                      ) : l.open > 0 ? (
                        <span className="font-semibold text-[var(--warn)]">
                          {so(l.open)}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-3)]">0</span>
                      )}
                    </Cell>
                    <Cell muted>
                      <span className="num">
                        {l.dots.length ? l.dots.map((d) => `Đợt ${d}`).join(', ') : '—'}
                      </span>
                    </Cell>
                  </Row>
                ))}
              </tbody>
              <TFoot
                label={
                  <td colSpan={3}>
                    Còn chờ {conCho.length} dòng
                    {free_lines > 0 ? ` · ${free_lines} dòng tự do ngoài sổ kho` : ''}
                  </td>
                }
                cells={null}
                caveatSpan={4}
                caveat="“Đã về” lấy từ sổ kho (phiếu nhập đã ghi), không lấy từ lời báo của NCC."
              />
            </Table>
          </section>
        )}

        <section aria-label="Đợt giao">
          <h3 className="text-k-label mb-1 font-semibold text-[var(--ink-3)] uppercase">
            Đợt giao (Cung ứng hẹn với NCC)
          </h3>
          {shipments.length === 0 ? (
            <p className="text-k-sm m-0 text-[var(--ink-3)]">
              Đơn chưa chia đợt — NCC giao theo hẹn giao của đơn.
            </p>
          ) : (
            <Table>
              <THead>
                <th>Đợt</th>
                <th>Hẹn</th>
                <th>Tình trạng</th>
                <th>Chở</th>
              </THead>
              <tbody>
                {shipments.map((s) => {
                  const xong =
                    (s.status === 'planned' || s.status === 'arrived') && xongDot(s)
                  const tt = TRANG_THAI_DOT[s.status] ?? { label: s.status, tone: 'neutral' as const } // prettier-ignore
                  const ma = s.lines
                    .map((l) => lineById.get(l.po_line_id))
                    .filter((l): l is NonNullable<typeof l> => !!l)
                  return (
                    <Row key={s.seq}>
                      <Cell>
                        <span className="num">Đợt {s.seq}</span>
                      </Cell>
                      <Cell>
                        <span className="num">{ngay(s.date, today)}</span>
                      </Cell>
                      <Cell>
                        {xong ? (
                          <Tag tone="done">đã nhập đủ trước hạn</Tag>
                        ) : (
                          <Tag tone={tt.tone}>{tt.label}</Tag>
                        )}
                      </Cell>
                      <Cell grow title={ma.map((l) => l.code ?? l.name).join(', ')}>
                        <span className="truncate">
                          {ma.length === 1
                            ? `${ma[0].code ?? ma[0].name} · ${so(s.lines[0].qty)} ${ma[0].unit}`
                            : `${s.lines.length} dòng`}
                        </span>
                      </Cell>
                    </Row>
                  )
                })}
              </tbody>
            </Table>
          )}
        </section>

        <section aria-label="Phiếu nhập của đơn">
          <h3 className="text-k-label mb-1 font-semibold text-[var(--ink-3)] uppercase">
            Phiếu của đơn
          </h3>
          {docs.length === 0 ? (
            <p className="text-k-sm m-0 text-[var(--ink-3)]">Chưa có phiếu nhập nào.</p>
          ) : (
            <Table>
              <THead>
                <th>Phiếu</th>
                <th>Loại</th>
                <th>Ngày</th>
                <th style={{ textAlign: 'right' }}>Số lượng</th>
              </THead>
              <tbody>
                {docs.map((d) => (
                  <Row key={d.doc_id}>
                    <Cell>
                      <Code as="a" href={`/warehouse/phieu/${d.doc_id}`}>
                        {d.code}
                      </Code>
                    </Cell>
                    <Cell muted>
                      {LOAI_PHIEU[d.kind] ?? d.kind}
                      {d.reversed_by && (
                        <span className="ml-1 text-[var(--ink-3)]">
                          · đã đảo ({d.reversed_by})
                        </span>
                      )}
                    </Cell>
                    <Cell>
                      <span className="num">{ngay(d.at, today)}</span>
                    </Cell>
                    <Cell num>{so(d.qty_total)}</Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
          {phieuNhap.length === 0 && docs.length > 0 && (
            <p className="text-k-sm m-0 mt-1 text-[var(--ink-3)]">
              Không còn phiếu nhập nào hiệu lực.
            </p>
          )}
        </section>

        <NoticeBar tone="neutral" tag="Chỉ xem">
          Hẹn hay dời đợt, chốt thiếu, đòi NCC giao bù là việc của Cung ứng
          {po.assignee_name ? ` (${po.assignee_name})` : ''}. Hàng về sai hay thiếu thì
          báo người phụ trách.
        </NoticeBar>
      </div>
    </Sheet>
  )
}
