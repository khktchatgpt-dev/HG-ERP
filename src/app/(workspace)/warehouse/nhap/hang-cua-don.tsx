'use client'

import Link from 'next/link'
import { ngay, TU_CHOI_NHAN } from '@/lib/kho-hang-ve'
import { ISSUE_KIND_LABEL, type IssueKind } from '@/lib/po-tracking'
import { todayVn } from '@/lib/date-vn'
import { HopThoai } from '../_erp/o-nhap'
import type { HangCuaDonData } from './tai-hang-cua-don'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

const TRANG_THAI_DOT: Record<string, { label: string; cls: string }> = {
  planned: { label: 'chưa tới', cls: 'kh-tag' },
  arrived: { label: 'NCC báo đã tới', cls: 'kh-tag warn' },
  received: { label: 'đã nhận', cls: 'kh-tag done' },
}

const LOAI_PHIEU: Record<string, string> = {
  receipt: 'Phiếu nhập',
  return: 'Trả NCC',
  reversal: 'Phiếu đảo',
  adjustment: 'Điều chỉnh',
}

/** Tiêu đề một mục trong hộp. */
const Muc = ({ children }: { children: React.ReactNode }) => (
  <h3
    className="kh-mut"
    style={{
      margin: '0 0 4px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.05em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </h3>
)

/**
 * HỘP "HÀNG CỦA ĐƠN" — bản vẽ B1-3 (duyệt 12/10/2026), viết lại không kit (Kho
 * lối ERP · B6). Thủ kho bấm mã đơn ở Hàng về thì thấy đơn chở gì, đã về bao
 * nhiêu, đợt nào sắp tới — mà không rời khu Kho (NV Kho không vào khu Mua hàng).
 *
 * CHỈ XEM. Việc với NCC (hẹn/dời đợt, chốt thiếu, đòi giao bù) là của Cung ứng —
 * hộp nói rõ ai giữ việc đó thay vì bày nút khoá. "Đợt đã nhập trước" (đợt mở mà
 * mọi dòng đã hết phần chờ) được NÓI RA ở đầu hộp.
 */
export function HangCuaDonSheet({
  data,
  today,
  canEdit,
  onClose,
  onBaoSuCo,
}: {
  data: HangCuaDonData
  today: string
  canEdit: boolean
  onClose: () => void
  /** Mở hộp Báo sự cố của đơn này. Không có = không có quyền ghi kho. */
  onBaoSuCo?: () => void
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
    <HopThoai
      title={`Hàng của đơn ${po.code}`}
      subtitle={po.supplier_name}
      onClose={onClose}
      width={760}
      footer={
        <>
          <span
            className="kh-mut"
            style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12 }}
          >
            {keTiep
              ? `Đợt kế tiếp: đợt ${keTiep.seq} · ${ngay(keTiep.date, today)}`
              : conCho.length > 0
                ? `Còn chờ ${conCho.length} dòng, chưa hẹn đợt`
                : 'Không còn dòng nào chờ về'}
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Đóng
          </button>
          {onBaoSuCo ? (
            <button type="button" className="kh-btn" onClick={onBaoSuCo}>
              Báo sự cố
            </button>
          ) : (
            <span
              className="kh-btn"
              aria-disabled="true"
              title="Chỉ phòng Kho báo sự cố giao hàng"
            >
              Báo sự cố
            </span>
          )}
          {!tuDo &&
            (canEdit ? (
              <Link
                href={`/warehouse/nhap/${po.id}${keTiep ? `?dot=${keTiep.id}` : ''}`}
                className="kh-btn p"
              >
                Nhận hàng
              </Link>
            ) : (
              <span
                className="kh-btn p"
                aria-disabled="true"
                title="Chỉ phòng Kho ghi phiếu nhập"
              >
                Nhận hàng
              </span>
            ))}
        </>
      }
    >
      <div className="kh-hc" style={{ border: '1px solid var(--kh-line)' }}>
        <div>
          <span className="k">Lệnh SX</span>
          <span className="v kh-num">
            {po.lsx_code ?? '— ngoài lệnh'}
            {po.extra_lsx.length > 0 && (
              <span className="kh-mut" style={{ fontWeight: 400 }}>
                {' '}
                + {po.extra_lsx.join(', ')}
              </span>
            )}
          </span>
        </div>
        <div>
          <span className="k">Hẹn giao (đơn)</span>
          <span className="v kh-num">
            {po.expected_at ? ngay(po.expected_at, today) : 'chưa hẹn'}
          </span>
        </div>
        <div>
          <span className="k">Phụ trách</span>
          <span className="v">{po.assignee_name ?? '—'}</span>
        </div>
        <div>
          <span className="k">Về kho</span>
          <span className="v kh-num">{tuDo ? '—' : `${done}/${lines.length} dòng`}</span>
        </div>
      </div>

      {daNhapTruoc.length > 0 && (
        <div className="kh-hau">
          <b>Đã nhập trước · </b>
          {daNhapTruoc
            .map((s) => `Đợt ${s.seq} hẹn ${ngay(s.date, today)}`)
            .join(', ')}{' '}
          nhưng hàng của {daNhapTruoc.length > 1 ? 'các đợt này' : 'đợt này'} đã nhập đủ
          trước hạn — không phải chờ xe.{' '}
          {keTiep
            ? `Còn lại thuộc đợt ${keTiep.seq}, hẹn ${ngay(keTiep.date, today)}.`
            : conCho.length > 0
              ? `Còn ${conCho.length} dòng chờ, chưa hẹn đợt.`
              : 'Đơn không còn dòng nào chờ.'}
        </div>
      )}

      {tuDo ? (
        <div
          className="kh-hau"
          style={{ borderLeftColor: 'var(--kh-ink3)', background: 'var(--kh-raised)' }}
        >
          Đơn chỉ có {free_lines} dòng theo mã SP (gỗ…): không vào tồn kho, Cung ứng
          nghiệm thu ngoài sổ. Thủ kho chỉ cần biết có xe tới.
        </div>
      ) : (
        <section aria-label="Dòng hàng">
          <Muc>Dòng hàng</Muc>
          <table className="kh-in">
            <colgroup>
              <col style={{ width: 96 }} />
              <col />
              <col style={{ width: 56 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                <th className="r">Đặt</th>
                <th className="r">Đã về</th>
                <th className="r">Còn chờ</th>
                <th>Đợt</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="kh-ma">{l.code ?? '—'}</td>
                  <td title={l.name}>{l.name}</td>
                  <td className="kh-mut">{l.unit}</td>
                  <td className="r kh-num">{so(l.ordered)}</td>
                  <td className="r kh-num">{so(l.received)}</td>
                  <td className="r kh-num">
                    {l.closed_short ? (
                      <span className="kh-tag">chốt thiếu</span>
                    ) : l.open > 0 ? (
                      <span className="kh-warn">{so(l.open)}</span>
                    ) : (
                      <span className="kh-mut">0</span>
                    )}
                  </td>
                  <td className="kh-mut kh-num">
                    {l.dots.length ? l.dots.map((d) => `Đợt ${d}`).join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="kh-mut" style={{ fontSize: 12, marginTop: 4 }}>
            Còn chờ {conCho.length} dòng
            {free_lines > 0 ? ` · ${free_lines} dòng tự do ngoài sổ kho` : ''} · “Đã về”
            lấy từ sổ kho (phiếu nhập đã ghi), không lấy từ lời báo của NCC.
          </p>
        </section>
      )}

      <section aria-label="Đợt giao">
        <Muc>Đợt giao (Cung ứng hẹn với NCC)</Muc>
        {shipments.length === 0 ? (
          <p className="kh-mut">Đơn chưa chia đợt — NCC giao theo hẹn giao của đơn.</p>
        ) : (
          <table className="kh-in">
            <colgroup>
              <col style={{ width: 70 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 170 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Đợt</th>
                <th>Hẹn</th>
                <th>Tình trạng</th>
                <th>Chở</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const xong =
                  (s.status === 'planned' || s.status === 'arrived') && xongDot(s)
                const tt = TRANG_THAI_DOT[s.status] ?? { label: s.status, cls: 'kh-tag' }
                const ma = s.lines
                  .map((l) => lineById.get(l.po_line_id))
                  .filter((l): l is NonNullable<typeof l> => !!l)
                return (
                  <tr key={s.seq}>
                    <td className="kh-num">Đợt {s.seq}</td>
                    <td className="kh-num">{ngay(s.date, today)}</td>
                    <td>
                      {xong ? (
                        <span className="kh-tag done">đã nhập đủ trước hạn</span>
                      ) : (
                        <span className={tt.cls}>{tt.label}</span>
                      )}
                    </td>
                    <td title={ma.map((l) => l.code ?? l.name).join(', ')}>
                      {ma.length === 1
                        ? `${ma[0].code ?? ma[0].name} · ${so(s.lines[0].qty)} ${ma[0].unit}`
                        : `${s.lines.length} dòng`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Sự cố giao hàng">
        <Muc>
          Sự cố giao hàng
          {data.issues.length > 0 &&
            ` · ${data.issues.filter((i) => i.status === 'mo').length} đang mở / ${data.issues.length}`}
        </Muc>
        {data.issues.length === 0 ? (
          <p className="kh-mut">
            Chưa có sự cố nào. Hàng tới sai, hỏng, thiếu — hoặc không nhận lô — thì bấm
            “Báo sự cố”: người phụ trách đơn bên Cung ứng nhận thông báo.
          </p>
        ) : (
          <table className="kh-in">
            <colgroup>
              <col style={{ width: 64 }} />
              <col style={{ width: 120 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Mô tả</th>
                <th>Người báo</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {data.issues.map((i) => {
                const tuChoi = i.description.startsWith(TU_CHOI_NHAN)
                const moTa = tuChoi
                  ? i.description.slice(TU_CHOI_NHAN.length).trim()
                  : i.description
                return (
                  <tr key={i.id}>
                    <td className="kh-num">
                      {ngay(todayVn(new Date(i.created_at)), today)}
                    </td>
                    <td>{ISSUE_KIND_LABEL[i.kind as IssueKind] ?? i.kind}</td>
                    <td
                      title={[
                        i.description,
                        i.resolution && `Cách xử lý: ${i.resolution}`,
                      ]
                        .filter(Boolean)
                        .join(' — ')}
                    >
                      {tuChoi && <span className="kh-tag warn">từ chối nhận</span>}
                      {i.qty != null ? `${so(i.qty)} · ` : ''}
                      {moTa}
                    </td>
                    <td className="kh-mut">{i.created_by_name ?? '—'}</td>
                    <td>
                      {i.status === 'mo' ? (
                        <span className="kh-tag warn">đang mở</span>
                      ) : (
                        <span className="kh-tag done">đã xử lý</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Phiếu nhập của đơn">
        <Muc>Phiếu của đơn</Muc>
        {docs.length === 0 ? (
          <p className="kh-mut">Chưa có phiếu nhập nào.</p>
        ) : (
          <table className="kh-in">
            <colgroup>
              <col style={{ width: 160 }} />
              <col />
              <col style={{ width: 70 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Phiếu</th>
                <th>Loại</th>
                <th>Ngày</th>
                <th className="r">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.doc_id}>
                  <td>
                    <Link href={`/warehouse/phieu/${d.doc_id}`} className="kh-lnk">
                      {d.code}
                    </Link>
                  </td>
                  <td className="kh-mut">
                    {LOAI_PHIEU[d.kind] ?? d.kind}
                    {d.reversed_by && ` · đã đảo (${d.reversed_by})`}
                  </td>
                  <td className="kh-num">{ngay(d.at, today)}</td>
                  <td className="r kh-num">{so(d.qty_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {phieuNhap.length === 0 && docs.length > 0 && (
          <p className="kh-mut" style={{ marginTop: 4 }}>
            Không còn phiếu nhập nào hiệu lực.
          </p>
        )}
      </section>

      <div
        className="kh-hau"
        style={{ borderLeftColor: 'var(--kh-ink3)', background: 'var(--kh-raised)' }}
      >
        <b>Chỉ xem · </b>Hẹn hay dời đợt, chốt thiếu, đòi NCC giao bù là việc của Cung ứng
        {po.assignee_name ? ` (${po.assignee_name})` : ''}. Hàng về sai hay thiếu thì báo
        người phụ trách.
      </div>
    </HopThoai>
  )
}
