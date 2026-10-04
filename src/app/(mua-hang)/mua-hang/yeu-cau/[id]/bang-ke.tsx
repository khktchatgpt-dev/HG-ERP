'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  GroupRow,
  Num,
  Row,
  SearchInput,
  Btn,
  TFoot,
  THead,
  Table,
  Tag,
  TextLink,
  showNum,
} from '@/components/kit'
import { groupForBangKe } from '@/lib/lsx-bang-ke'
import {
  demTinhTrang,
  THU_TU,
  TINH_TRANG,
  tinhTrang,
  type TinhTrang,
} from '@/lib/lsx-bang-ke-gon'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { normalizeSearch } from '@/lib/search-text'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'

const COLS = 9
const so = (x: number) => (x > 0 ? showNum(x) : '—')

/**
 * BẢNG KÊ GỌN — chế độ "Theo vật tư" của màn lệnh (29/09/2026, artboard 18/18b).
 *
 * Gộp mọi dòng đơn mua của lệnh theo MÃ, chia khối theo loại/nhóm (cùng hàm
 * `groupForBangKe` với file Excel — màn và file chia y hệt). Nguồn số là
 * `loadLsxBangKe` có sẵn; tình trạng theo tiến độ đơn (`lsx-bang-ke-gon`).
 *
 * TẠM BỎ PHẦN "CẦN / THIẾU / ĐỦ" (03/10/2026, user chốt): chưa xác định ai chốt
 * đủ vật tư, định mức chưa có SP nào xác nhận. Bảng kê chỉ còn các mã ĐÃ CÓ đơn
 * mua và đơn đó đi tới đâu — bỏ cột "Cần", bỏ chip "Tính cả định mức nháp", bỏ
 * dòng chỉ đến từ định mức (chúng chỉ để báo "Chưa đặt" = thiếu). Bật lại khi
 * bảng kê có nhu cầu đáng tin.
 */
/** Số ĐƠN theo trạng thái, lấy từ đầu màn lệnh — chip đếm đơn, nhãn nói số mã. */
export type DonTheoTrangThai = {
  nhap: number
  cho_duyet: number
  dang_ve: number
  da_ve: number
  tong: number
}

export function BangKe({
  bk,
  canEdit,
  donTheo,
}: {
  bk: LsxBangKe
  canEdit: boolean
  donTheo: DonTheoTrangThai
}) {
  const [loc, setLoc] = useState<TinhTrang | null>(null)
  const [q, setQ] = useState('')

  // Chỉ mã đã có đơn mua — xem chú thích đầu hàm.
  const coDon = useMemo(() => bk.rows.filter((r) => r.pos.length > 0), [bk.rows])
  const dem = useMemo(() => demTinhTrang(coDon), [coDon])
  const rows = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    return coDon.filter(
      (r) =>
        (!loc || tinhTrang(r) === loc) &&
        tk.every((t) =>
          normalizeSearch(`${r.material_code} ${r.material_name}`).includes(t),
        ),
    )
  }, [coDon, loc, q])
  const khoi = useMemo(() => groupForBangKe(rows, partGroupLabel, partGroupRank), [rows])

  if (coDon.length === 0)
    return (
      <Empty
        headline="Lệnh này chưa có gì để kê"
        reason="Chưa đơn mua nào của lệnh có dòng hàng."
        next={
          canEdit ? (
            <Btn icon="them" primary href={`/mua-hang/don/moi?lsx=${bk.lsx.id}`}>
              Đặt thêm cho lệnh
            </Btn>
          ) : (
            <Btn icon="quayLai" href="/mua-hang/yeu-cau">
              Về danh sách lệnh
            </Btn>
          )
        }
      />
    )

  return (
    <>
      <FilterBar>
        <Chip on={loc === null} count={donTheo.tong} onClick={() => setLoc(null)}>
          Tất cả · {coDon.length} mã
        </Chip>
        {THU_TU.filter((t) => dem[t] > 0 || (t !== 'chua_dat' && donTheo[t] > 0)).map(
          (t) => (
            <Chip
              key={t}
              on={loc === t}
              count={t === 'chua_dat' ? dem[t] : donTheo[t]}
              onClick={() => setLoc(loc === t ? null : t)}
            >
              {TINH_TRANG[t].label} · {dem[t]} mã
            </Chip>
          ),
        )}
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã, tên vật tư…"
          width={240}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          headline="Không mã nào khớp bộ lọc"
          reason={`Lệnh có ${coDon.length} mã — bộ lọc hiện tại không để lại dòng nào.`}
          next={
            <Btn
              icon="boLoc"
              onClick={() => {
                setLoc(null)
                setQ('')
              }}
            >
              {' '}
              {/* prettier-ignore */}
              Bỏ lọc
            </Btn>
          }
        />
      ) : (
        <Table label="Bảng kê vật tư của lệnh">
          <THead pinFirst>
            <th>Mã</th>
            <th>Vật tư</th>
            <th>ĐVT</th>
            <th style={{ textAlign: 'right' }}>Đã đặt</th>
            <th style={{ textAlign: 'right' }}>Chờ duyệt · nháp</th>
            <th style={{ textAlign: 'right' }}>Đã về</th>
            <th>Đơn</th>
            <th>NCC</th>
            <th>Tình trạng</th>
          </THead>
          <tbody>
            {khoi.map((k) => (
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
                      const t = tinhTrang(r)
                      const ncc = [
                        ...new Set(r.pos.map((p) => p.supplier_name).filter(Boolean)),
                      ]
                      const cho = r.pending + r.draft
                      return (
                        <Row key={r.material_id ?? r.material_code}>
                          <Cell pin>
                            <Code>{r.material_code}</Code>
                          </Cell>
                          <Cell grow className="min-w-[240px]">
                            <span className="block truncate" title={r.material_name}>
                              {r.material_name}
                            </span>
                            {r.spec && (
                              <span className="text-k-label block text-[var(--ink-3)]">
                                {r.spec}
                              </span>
                            )}
                          </Cell>
                          <Cell muted>{r.unit}</Cell>
                          <Cell num>
                            <Num value={so(r.ordered)} strong={r.ordered > 0} />
                          </Cell>
                          <Cell num>
                            <Num
                              value={
                                cho > 0
                                  ? `${showNum(cho)}${r.pending === 0 ? ' nháp' : ''}`
                                  : '—'
                              }
                            />
                          </Cell>
                          <Cell num>
                            <Num value={so(r.received)} />
                          </Cell>
                          <Cell>
                            {r.pos.length > 0 ? (
                              <span
                                title={r.pos
                                  .map(
                                    (p) =>
                                      `${p.code} · ${showNum(p.qty_ordered)} ${r.unit}`,
                                  )
                                  .join('\n')}
                              >
                                {' '}
                                {/* prettier-ignore */}
                                <TextLink href={`/mua-hang/don/${r.pos[0].id}`}>{r.pos[0].code}</TextLink>
                                {r.pos.length > 1 && (
                                  <span className="text-k-label ml-1 text-[var(--ink-3)]">
                                    +{r.pos.length - 1} đơn
                                  </span>
                                )}{' '}
                                {/* prettier-ignore */}
                              </span>
                            ) : (
                              '—'
                            )}
                          </Cell>
                          <Cell muted className="max-w-[180px]" title={ncc.join(', ')}>
                            {ncc[0] ?? '—'}
                            {ncc.length > 1 ? ` +${ncc.length - 1}` : ''}
                          </Cell>
                          <Cell>
                            <Tag tone={TINH_TRANG[t].tone}>{TINH_TRANG[t].label}</Tag>
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
                Cộng {rows.length} mã · {donTheo.tong} đơn của lệnh
              </td>
            }
            cells={null}
            caveatSpan={6}
            caveat="Không cộng số lượng giữa các mã (khác đơn vị). “Đã đặt” = đã gửi NCC, chưa về; không gồm nháp, chờ duyệt."
          />
        </Table>
      )}
    </>
  )
}
