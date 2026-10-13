'use client'

import { isoToVn } from '@/lib/date-vn'
import { conPhaiNhap } from '@/lib/de-nghi-nhap'
import {
  CellHint,
  Code,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  Tag,
  Th,
} from '@/components/kit'
import type { DongForm } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const R = { textAlign: 'right', whiteSpace: 'normal' } as const

/**
 * TÌNH HÌNH NHẬP của phiếu đề nghị đã duyệt (0238 · Đ4, bản vẽ DN-5). Mỗi dòng
 * nói đã nhập bao nhiêu trên số duyệt, ở phiếu nhập nào (bấm mở PNK). Đếm từ
 * SỔ KHO — đảo một PNK thì số ở đây tự lùi.
 *
 * Khung < 900px: cột Phiếu nhập xuống thành gợi ý dưới Đã nhập.
 */
export function TinhHinhNhap({
  rows,
  hep,
  daChot,
}: {
  rows: DongForm[]
  hep: boolean
  /** Phiếu đã "Chốt xong" (Q14) — dòng thiếu ghi "chốt thiếu". */
  daChot: boolean
}) {
  const muaDong = rows.filter((r) => (r.can ?? 0) > 0)
  const du = muaDong.filter((r) => conPhaiNhap(r.can ?? 0, r.da_nhap ?? 0) <= 0).length
  return (
    <Grid minWidth={hep ? 640 : 900}>
      <GridHead>
        <Th width={30}>#</Th>
        <Th width={hep ? 86 : 100}>Mã</Th>
        <Th>Tên vật tư</Th>
        <Th width={56}>ĐVT</Th>
        <th scope="col" style={{ ...R, width: 84 }}>
          Số duyệt
        </th>
        <th scope="col" style={{ ...R, width: 84 }}>
          Đã nhập
        </th>
        {!hep && <Th width={190}>Phiếu nhập</Th>}
        <Th width={hep ? 110 : 130}>Tình trạng</Th>
      </GridHead>
      <GridBody>
        {rows.map((r, i) => {
          const can = r.can ?? r.approved_qty ?? r.qty ?? 0
          const da = r.da_nhap ?? 0
          const con = conPhaiNhap(can, da)
          const phieu = r.phieu_nhap ?? []
          return (
            <GridRow key={r.key}>
              <td className="k-c-n">{i + 1}</td>
              <td>
                {r.code ? <Code>{r.code}</Code> : <Tag tone="warn">chưa có mã</Tag>}
              </td>
              <td className="max-w-0" title={r.name}>
                <span className="block truncate">{r.name}</span>
              </td>
              <td className="text-[var(--ink-3)]">{r.unit}</td>
              <td className="k-r num">
                <b>{fmt(can)}</b>
                {r.approved_qty != null && r.qty != null && (
                  <CellHint tone="warn">đề nghị {fmt(r.qty)}</CellHint>
                )}
              </td>
              <td className="k-r num">
                {da > 0 ? fmt(da) : <span className="text-[var(--ink-empty)]">0</span>}
                {hep && phieu.length > 0 && (
                  <CellHint tone="neutral">
                    {phieu.map((p) => p.code).join(', ')}
                  </CellHint>
                )}
              </td>
              {!hep && (
                <td>
                  {phieu.length === 0 ? (
                    <span className="text-[var(--ink-empty)]">—</span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {phieu.map((p) => (
                        <span key={p.doc_id} className="flex items-baseline gap-1.5">
                          <Code as="a" href={`/warehouse/phieu/${p.doc_id}`}>
                            {p.code}
                          </Code>
                          <span className="text-k-sm text-[var(--ink-3)]">
                            {isoToVn(p.doc_date)}
                            {phieu.length > 1 && ` · ${fmt(p.qty)}`}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </td>
              )}
              <td>
                {can <= 0 ? (
                  <Tag tone="neutral">không mua</Tag>
                ) : con <= 0 ? (
                  <Tag tone="done">{da > can ? `đủ · vượt ${fmt(da - can)}` : 'đủ'}</Tag>
                ) : daChot ? (
                  <Tag tone="neutral">chốt thiếu {fmt(con)}</Tag>
                ) : (
                  <Tag tone="warn">còn {fmt(con)}</Tag>
                )}
              </td>
            </GridRow>
          )
        })}
      </GridBody>
      <GridFoot>
        <td colSpan={hep ? 7 : 8}>
          Đã nhập đủ {du}/{muaDong.length} dòng
          {rows.length > muaDong.length &&
            ` · ${rows.length - muaDong.length} dòng lãnh đạo duyệt 0 (không mua)`}
          {' · '}số đếm từ sổ kho, đảo phiếu nhập thì tự lùi
        </td>
      </GridFoot>
    </Grid>
  )
}
