'use client'

import { Fragment } from 'react'
import {
  Btn,
  Cell,
  Code,
  Empty,
  GroupRow,
  Num,
  Row,
  TFoot,
  THead,
  Table,
  Tag,
  TextLink,
} from '@/components/kit'
import { chonDuoc, TINH_TRANG_MUA } from '@/lib/lsx-bang-ke-mua'
import { so, so0 } from './bang-ke.shared'
import type { BangKeCtx } from './useBangKe'

const COLS = 8

/**
 * LƯỚI BẢNG KÊ — gom theo loại định mức (cùng `groupForBangKe` với Excel, nên màn
 * và file chia y hệt).
 *
 * TÁM CỘT, KHÔNG CUỘN NGANG trên laptop (08/10/2026, chủ dự án: "tối ưu UI để
 * không phải scroll trái phải, phù hợp nhiều loại màn hình"). Bản đầu 12 cột cần
 * 1.180px; laptop phóng 125% trừ sidebar chỉ còn ~1.000px. Gộp: ĐVT vào ô Cần;
 * "Đã gửi NCC" + "Nháp" thành "Đã đặt" (nháp in nhỏ bên dưới, vẫn đã trừ vào
 * Còn phải đặt); đơn và NCC mua gần nhất xuống dưới tình trạng. Cột vật tư là
 * cột giãn — chữ dài cắt bằng ba chấm, rê chuột đọc đủ.
 */
export function BangKeLuoi({ d }: { d: BangKeCtx }) {
  if (d.soDongHien === 0)
    return (
      <Empty
        headline="Không mã nào khớp bộ lọc"
        reason={`Lệnh có ${d.tatCa.length} mã — bộ lọc hiện tại không để lại dòng nào.`}
        next={
          <Btn
            icon="boLoc"
            onClick={() => {
              d.setLoc(null)
              d.setNhom(null)
              d.setQ('')
            }}
          >
            Bỏ lọc
          </Btn>
        }
      />
    )

  return (
    <Table label="Bảng kê vật tư của lệnh" minWidth={820}>
      <THead pinFirst>
        <th style={{ width: 28 }}>
          <input
            type="checkbox"
            aria-label="Tích mọi dòng đang hiện còn phải đặt"
            checked={d.hetHienDaChon}
            disabled={d.hienChonDuoc === 0}
            onChange={(e) => d.chonHetHien(e.target.checked)}
            className="accent-[var(--act)]"
          />
        </th>
        <th>Mã</th>
        <th>Vật tư · quy cách · vị trí</th>
        <th style={{ textAlign: 'right' }}>Cần</th>
        <th style={{ textAlign: 'right' }}>Tồn</th>
        <th style={{ textAlign: 'right' }}>Đã đặt</th>
        <th style={{ textAlign: 'right' }}>Còn phải đặt</th>
        <th>Tình trạng · đơn</th>
      </THead>
      <tbody>
        {d.hien.map((k) => (
          <Fragment key={k.name}>
            <GroupRow cols={COLS} name={k.name} meta={`${k.rows.length} mã`} />
            {k.subs.map((sub) => (
              <Fragment key={`${k.name}/${sub.name ?? ''}`}>
                {sub.name && (
                  <GroupRow
                    cols={COLS}
                    name={`· ${sub.name}`}
                    meta={`${sub.rows.length} mã`}
                  />
                )}
                {sub.rows.map((r) => {
                  const x = d.byId.get(r.material_id)!
                  const m = x.d
                  const tt = TINH_TRANG_MUA[m.tinhTrang]
                  const tich = chonDuoc(m)
                  const dangChon = d.chon.has(r.material_id)
                  const phu = [r.spec, (r.positions ?? []).join(', ')]
                    .filter(Boolean)
                    .join(' · ')
                  const sp = r.from_products
                    .map(
                      (p) =>
                        `${p.code} × ${p.qty.toLocaleString('vi-VN')}: ${p.per.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} ${r.unit}/SP${p.confirmed ? '' : ' (chưa kiểm)'}`,
                    )
                    .join('\n')
                  const canTitle =
                    m.canLe !== m.can
                      ? `Số lẻ ${m.canLe.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} ${r.unit}, làm tròn lên theo đơn vị mua\n${sp}`
                      : sp
                  const ncc = r.last_price
                    ? `${r.last_price.supplier_name ?? ''} · ${r.last_price.unit_price.toLocaleString('vi-VN')} ${r.last_price.currency}/${r.unit} (${r.last_price.po_code})`
                    : ''
                  return (
                    <Row key={r.material_id} selected={dangChon}>
                      <Cell>
                        {tich ? (
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${r.material_code} để lên đơn`}
                            checked={dangChon}
                            onChange={() => d.toggleChon(r.material_id)}
                            className="accent-[var(--act)]"
                          />
                        ) : (
                          ''
                        )}
                      </Cell>
                      <Cell pin>
                        <Code>{r.material_code}</Code>
                      </Cell>
                      <Cell grow className="min-w-[200px]">
                        <span className="block truncate" title={r.material_name}>
                          {r.material_name}
                        </span>
                        {phu && (
                          <span
                            className="text-k-label block truncate text-[var(--ink-3)]"
                            title={phu}
                          >
                            {phu}
                          </span>
                        )}
                      </Cell>
                      <Cell num title={canTitle}>
                        <Num value={so(m.can)} strong={m.can > 0} />
                        {m.can > 0 && (
                          <span className="text-k-label block text-[var(--ink-3)]">
                            {r.unit}
                          </span>
                        )}
                      </Cell>
                      <Cell
                        num
                        title={`Tồn kho ${so0(r.on_hand)} − giữ cho lệnh khác ${so0(r.reserved_others)}`}
                      >
                        <Num value={so0(m.tonKhaDung)} zero="zero" />
                      </Cell>
                      <Cell
                        num
                        title={
                          m.daGui > 0 || m.nhap > 0
                            ? `Đã gửi NCC ${so(m.daGui)} · nháp/chờ duyệt ${so(m.nhap)} — đều đã trừ vào Còn phải đặt`
                            : undefined
                        }
                      >
                        <Num value={so(m.daGui)} />
                        {m.nhap > 0 && (
                          <span className="text-k-label block text-[var(--ink-3)]">
                            nháp {so(m.nhap)}
                          </span>
                        )}
                      </Cell>
                      <Cell num>
                        <Num value={so(m.conPhaiDat)} strong={m.conPhaiDat > 0} />
                      </Cell>
                      <Cell className="max-w-[220px]">
                        <Tag tone={tt.tone}>{tt.label}</Tag>
                        {(r.pos.length > 0 || ncc) && (
                          <span
                            className="text-k-label block truncate text-[var(--ink-3)]"
                            title={[
                              ...r.pos.map(
                                (p) => `${p.code} · ${so(p.qty_ordered)} ${r.unit}`,
                              ),
                              ncc,
                            ]
                              .filter(Boolean)
                              .join('\n')}
                          >
                            {r.pos.length > 0 ? (
                              <>
                                <TextLink href={`/mua-hang/don/${r.pos[0].id}`}>
                                  {r.pos[0].code}
                                </TextLink>
                                {r.pos.length > 1 ? ` +${r.pos.length - 1}` : ''}
                                {ncc ? ' · ' : ''}
                              </>
                            ) : null}
                            {r.last_price?.supplier_name ?? ''}
                          </span>
                        )}
                      </Cell>
                    </Row>
                  )
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </tbody>
      <TFoot
        label={
          <td colSpan={3}>
            Cộng {d.soDongHien} mã
            {d.daChon.length > 0 ? ` · đã tích ${d.daChon.length} mã để lên đơn` : ''}
          </td>
        }
        cells={null}
        caveatSpan={COLS - 3}
        caveat="Không cộng số lượng giữa các mã. Cần làm tròn LÊN theo đơn vị mua; nháp đã trừ vào Còn phải đặt."
      />
    </Table>
  )
}
