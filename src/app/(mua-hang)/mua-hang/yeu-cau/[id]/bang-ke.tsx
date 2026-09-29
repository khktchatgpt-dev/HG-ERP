'use client'

import { Fragment, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  GroupRow,
  NoticeBar,
  Num,
  Row,
  SearchInput,
  Sheet,
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
  canHien,
  demTinhTrang,
  THU_TU,
  TINH_TRANG,
  tinhTrang,
  type TinhTrang,
} from '@/lib/lsx-bang-ke-gon'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { normalizeSearch } from '@/lib/search-text'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'

const COLS = 10
const so = (x: number) => (x > 0 ? showNum(x) : '—')

/**
 * BẢNG KÊ GỌN — chế độ "Theo vật tư" của màn lệnh (29/09/2026, artboard 18/18b).
 *
 * Gộp mọi dòng đơn mua của lệnh theo MÃ, chia khối theo loại/nhóm (cùng hàm
 * `groupForBangKe` với file Excel — màn và file chia y hệt). Nguồn số là
 * `loadLsxBangKe` có sẵn; tình trạng theo tiến độ đơn (`lsx-bang-ke-gon`).
 * Cột "Cần" chỉ có số khi định mức đã xác nhận — đầu bảng nói thẳng bao nhiêu SP
 * chưa, không để người mua tưởng "Cần trống = không cần".
 */
export function BangKe({ bk, canEdit }: { bk: LsxBangKe; canEdit: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [loc, setLoc] = useState<TinhTrang | null>(null)
  const [q, setQ] = useState('')
  const [xemSp, setXemSp] = useState(false)

  const dem = useMemo(() => demTinhTrang(bk.rows), [bk.rows])
  const rows = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    return bk.rows.filter(
      (r) =>
        (!loc || tinhTrang(r) === loc) &&
        tk.every((t) =>
          normalizeSearch(`${r.material_code} ${r.material_name}`).includes(t),
        ),
    )
  }, [bk.rows, loc, q])
  const khoi = useMemo(() => groupForBangKe(rows, partGroupLabel, partGroupRank), [rows])
  const soDon = new Set(bk.rows.flatMap((r) => r.pos.map((p) => p.id))).size
  const chot = bk.products.filter((p) => p.bom_confirmed).length

  const nhap = (on: boolean) => {
    const p = new URLSearchParams(params.toString())
    if (on) p.set('nhap', '1')
    else p.delete('nhap')
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  if (bk.rows.length === 0)
    return (
      <Empty
        headline="Lệnh này chưa có gì để kê"
        reason={
          bk.include_draft
            ? 'Chưa đơn mua nào của lệnh có dòng hàng, và định mức (kể cả bản nháp) chưa có dòng gắn mã vật tư.'
            : 'Chưa đơn mua nào của lệnh có dòng hàng, và chưa SP nào có định mức đã xác nhận.'
        }
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
      {chot < bk.products.length && (
        <NoticeBar
          tag="Cột Cần"
          action={{
            label: `Xem ${bk.products.length} SP`,
            onClick: () => setXemSp(true),
          }}
        >
          {chot}/{bk.products.length} sản phẩm của lệnh đã xác nhận định mức — số “Cần”
          chỉ tính từ định mức đã xác nhận
          {bk.include_draft ? ', cộng số nháp (in kèm chữ “nháp”)' : ''}. Bảng dưới là{' '}
          {bk.rows.length} mã từ {soDon} đơn mua.
        </NoticeBar>
      )}

      <FilterBar>
        <Chip on={loc === null} count={bk.rows.length} onClick={() => setLoc(null)}>
          Tất cả
        </Chip>
        {THU_TU.filter((t) => dem[t] > 0).map((t) => (
          <Chip
            key={t}
            on={loc === t}
            count={dem[t]}
            onClick={() => setLoc(loc === t ? null : t)}
          >
            {TINH_TRANG[t].label}
          </Chip>
        ))}
        <Chip
          icon="banNhap"
          on={bk.include_draft}
          onClick={() => nhap(!bk.include_draft)}
        >
          Tính cả định mức nháp
        </Chip>
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
          reason={`Lệnh có ${bk.rows.length} mã — bộ lọc hiện tại không để lại dòng nào.`}
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
            <th style={{ textAlign: 'right' }}>Cần</th>
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
                      const can = canHien(r)
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
                            {can ? (
                              <span
                                className={can.nhap ? 'text-[var(--warn)]' : undefined}
                                title={can.nhap ? 'Từ định mức CHƯA xác nhận' : undefined}
                              >
                                {' '}
                                {/* prettier-ignore */}
                                <Num value={showNum(can.qty)} />
                                {can.nhap && (
                                  <span className="text-k-label ml-1">nháp</span>
                                )}
                              </span>
                            ) : (
                              <Num value="—" />
                            )}
                          </Cell>
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
              <td colSpan={4}>
                Cộng {rows.length} mã · {soDon} đơn
              </td>
            }
            cells={null}
            caveatSpan={6}
            caveat="Không cộng số lượng giữa các mã (khác đơn vị). “Đã đặt” = đã gửi NCC, chưa về; không gồm nháp, chờ duyệt."
          />
        </Table>
      )}

      {xemSp && (
        <Sheet
          open
          onClose={() => setXemSp(false)}
          title="Sản phẩm của lệnh và định mức"
          subtitle="Số “Cần” chỉ tính từ định mức đã xác nhận (Kỹ thuật bấm “Đã kiểm tra” hoặc khoá hồ sơ). Đây là việc của Kỹ thuật."
          stakes="nhe"
          width={620}
        >
          {' '}
          {/* prettier-ignore */}
          <Table inline label="Sản phẩm của lệnh">
            <THead>
              <th>SP</th>
              <th>Tên</th>
              <th style={{ textAlign: 'right' }}>SL</th>
              <th>Định mức</th>
            </THead>
            <tbody>
              {bk.products.map((p) => (
                <Row key={p.id}>
                  <Cell>
                    <TextLink href={`/products/${p.id}/dinh-muc`}>{p.code}</TextLink>
                  </Cell>
                  <Cell grow>{p.name}</Cell>
                  <Cell num>
                    <Num value={showNum(p.qty)} />
                  </Cell>
                  <Cell>
                    {p.bom_confirmed ? (
                      <Tag tone="done">Đã xác nhận</Tag>
                    ) : p.coded_parts > 0 ? (
                      <Tag tone="warn">Nháp · {p.coded_parts} dòng có mã</Tag>
                    ) : (
                      <Tag tone="neutral">Chưa có dòng mã</Tag>
                    )}
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
    </>
  )
}
