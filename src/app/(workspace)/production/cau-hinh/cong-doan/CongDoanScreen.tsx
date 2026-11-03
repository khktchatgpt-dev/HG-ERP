'use client'

import type { KeyboardEvent } from 'react'
import type { StageConfigPayload } from '@/modules/dept/production/stage-config.service'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import { ApNhom, ApNut, DauTrang, SxKhung, ThanhTT } from '../../_erp/khung'
import { useCongDoan } from './useCongDoan'
import { BangCauHinh } from './bang-cau-hinh'

/**
 * CẤU HÌNH CÔNG ĐOẠN — màn C1 của bản vẽ 03/11/2026 (không kit).
 *
 * Trái: lưới 12 công đoạn (mã · tên · đếm bằng · tổ · số ô riêng · số mã lỗi ·
 * ghi chú suy ra). Phải: bảng cấu hình của công đoạn đang chọn. Lưu ở Action
 * Pane góc phải; bị chặn thì nói vì sao ngay cạnh nút.
 */
export function CongDoanScreen({ data }: { data: StageConfigPayload }) {
  const d = useCongDoan(data)
  const { stages, chon, nhap, dirty, busy, loi, thongBao, them } = d
  const teamName = new Map(d.data.teams.map((t) => [t.id, t.name]))
  const { counting } = d.data
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  const active = stages.filter((s) => s.is_active)
  const coTo = active.filter((s) => s.team_ids.length > 0)
  const chuaTo = active.filter((s) => s.team_ids.length === 0)
  const soORieng = active.reduce((n, s) => n + s.fields.length, 0)
  const soMaLoi = active.reduce((n, s) => n + s.defect_codes.length, 0)

  const luuWhy = !nhap
    ? 'Chọn một công đoạn'
    : !dirty
      ? 'Chưa đổi gì'
      : nhap.label.trim() === ''
        ? 'Tên công đoạn đang trống'
        : nhap.fields.some((f) => !f.field_key || !f.label)
          ? 'Có ô riêng chưa có khoá hoặc tên'
          : nhap.defect_codes.some((x) => !x.code || !x.label)
            ? 'Có mã lỗi chưa có mã hoặc tên'
            : null

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, code: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      d.chonCongDoan(code)
    }
  }

  const ghiChu = (code: string): string => {
    if (code === counting.join) return 'công đoạn ghép — đổi đơn vị: chi tiết → cụm'
    if (counting.finish[0] === code) return 'bắt đầu chặng thành phẩm — đếm theo bộ'
    if (counting.finish.includes(code)) return 'chặng thành phẩm'
    return ''
  }

  return (
    <SxKhung label="Cấu hình công đoạn">
      <DauTrang
        crumb="Cấu hình"
        title="Công đoạn"
        ctx={
          <>
            danh mục dùng chung mọi SP · <b>{active.length}</b> mã
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut onClick={d.moThem} why={them ? 'Đang thêm' : null}>
                ＋ Thêm công đoạn
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut onClick={d.huy} why={dirty ? null : 'Chưa đổi gì'}>
                Huỷ
              </ApNut>
              <ApNut primary onClick={d.luu} why={luuWhy} busy={busy}>
                Lưu {nhap ? nhap.label : ''}
              </ApNut>
            </ApNhom>
          </>
        }
      />
      {loi && (
        <div className="sx-note stop" role="alert">
          <b>Chưa lưu được:</b> {loi}
        </div>
      )}
      {!loi && thongBao && (
        <div className="sx-note ok" role="status">
          {thongBao}
        </div>
      )}
      <div className="sx-two">
        <div className="sx-grid">
          <table className="sx-tb" aria-label="Danh mục công đoạn">
            <colgroup>
              <col style={{ width: 30 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 66 }} />
              <col style={{ width: 168 }} />
              <col style={{ width: 54 }} />
              <col style={{ width: 54 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="r">#</th>
                <th>Mã</th>
                <th>Tên</th>
                <th>Đếm bằng</th>
                <th>Tổ phụ trách</th>
                <th className="r">Ô riêng</th>
                <th className="r">Mã lỗi</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => {
                const on = s.code === chon?.code
                const tos = s.team_ids.map((id) => teamName.get(id) ?? '?')
                return (
                  <tr
                    key={s.code}
                    className={`d${on ? 'on' : ''}${s.is_active ? '' : 'off'}`}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => d.chonCongDoan(s.code)}
                    onKeyDown={(e) => onRowKey(e, s.code)}
                  >
                    <td className="r num">{i + 1}</td>
                    <td className="ma">{s.code}</td>
                    <td title={s.label}>{s.label}</td>
                    <td>{COUNT_LEVEL_LABEL[s.meta.count_level].replace(' (cái)', '')}</td>
                    <td
                      className={s.is_active && tos.length === 0 ? 'warn' : undefined}
                      title={tos.join(' · ')}
                    >
                      {tos.length
                        ? tos.join(' · ')
                        : s.is_active
                          ? 'chưa tổ nào nhận'
                          : '—'}
                    </td>
                    <td className={`r num${s.fields.length ? '' : 'empty'}`}>
                      {s.fields.length}
                    </td>
                    <td className={`r num${s.defect_codes.length ? '' : 'empty'}`}>
                      {s.defect_codes.length}
                    </td>
                    <td
                      className="mut"
                      title={s.is_active ? ghiChu(s.code) : 'đã ngừng dùng'}
                    >
                      {s.is_active ? ghiChu(s.code) : 'đã ngừng dùng'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  {active.length} công đoạn · {coTo.length} có tổ
                </td>
                <td className={chuaTo.length ? 'warn' : undefined}>
                  {chuaTo.length ? `${chuaTo.length} chưa tổ nào nhận` : 'tổ đủ'}
                </td>
                <td className="r num">{soORieng}</td>
                <td className="r num">{soMaLoi}</td>
                <td className="mut">
                  +{d.data.shared_defect_codes.length} mã lỗi dùng chung
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <BangCauHinh d={d} />
        </div>
      </div>
      <ThanhTT
        left={
          <>
            Ghép ở <b>{counting.join ? labelOf(counting.join) : '—'}</b> · thành phẩm:{' '}
            <b>
              {counting.finish.length ? counting.finish.map(labelOf).join(' → ') : '—'}
            </b>
          </>
        }
        right={
          dirty ? (
            <span className="warn">Đang sửa {nhap?.label} — chưa lưu</span>
          ) : (
            'catalog production_stage · meta'
          )
        }
      />
    </SxKhung>
  )
}
