'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { canXuLy, ketQuaPhieu } from '@/lib/da-ve'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  GroupRow,
  NoticeBar,
  Row,
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'
import { XemTheoDoi } from '../xem'
import { KgCanSheet } from './kg-can-sheet'

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const KHOANG = [7, 14, 30] as const

/**
 * THEO DÕI ĐƠN HÀNG › ĐÃ VỀ — "hàng vừa về, ổn không, còn gì phải làm?"
 * (bản vẽ G3). Hai làn: Cần xử lý (thiếu kg cân · còn thiếu · sai quy cách)
 * rồi Còn lại. Việc xử lý làm ở TRANG ĐƠN (mục Giao & nhận đã có giao bù /
 * chốt thiếu); riêng kg cân thiếu thì ghi ngay tại đây (`KgCanSheet`).
 */
export function DaVeScreen({
  rows: allRows,
  today,
  truncatedAt,
  canWrite,
  meId,
  defaultScope,
  urlScope,
}: {
  rows: DaVeRow[]
  today: string
  truncatedAt: number | null
  /** Ghi phiếu kho được (`warehouse.stock.write`) — mới có nút Ghi kg cân. */
  canWrite: boolean
  meId: string
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
}) {
  const [q, setQ] = useState('')
  const [khoang, setKhoang] = useState<(typeof KHOANG)[number]>(14)
  const [kgRow, setKgRow] = useState<DaVeRow | null>(null)
  const [scope, setScope] = useScopePref('da-ve', meId, defaultScope, urlScope)

  const tu = useMemo(
    () =>
      new Date(Date.parse(today + 'T00:00:00Z') - khoang * 86_400_000)
        .toISOString()
        .slice(0, 10),
    [today, khoang],
  )
  const inScope = useMemo(
    () => (scope === 'toi' ? allRows.filter((r) => r.owner_id === meId) : allRows),
    [allRows, scope, meId],
  )
  const inRange = useMemo(
    () => inScope.filter((r) => r.doc_date.slice(0, 10) >= tu),
    [inScope, tu],
  )
  const kept = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return inRange
    return inRange.filter((r) =>
      [r.code, r.po_code, r.supplier_name, r.lsx_code, r.supplier_doc_no]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(n)),
    )
  }, [inRange, q])
  const canXl = kept.filter((r) => canXuLy(r.phieu))
  const conLai = kept.filter((r) => !canXuLy(r.phieu))
  const demCanXl = inRange.filter((r) => canXuLy(r.phieu)).length
  const demKhoang = (d: number) => {
    const t = new Date(Date.parse(today + 'T00:00:00Z') - d * 86_400_000)
      .toISOString()
      .slice(0, 10)
    return inScope.filter((r) => r.doc_date.slice(0, 10) >= t).length
  }

  const dong = (r: DaVeRow) => {
    const kq = ketQuaPhieu(r.phieu)
    const xl = kq.filter((k) => k.can_xu_ly)
    const thieuKg = kq.some((k) => k.kind === 'thieu_kg')
    const motDon = kq.some((k) => k.kind === 'thieu' || k.kind === 'sai_quy_cach')
    return (
      <Row key={r.doc_id}>
        <Cell pin>
          <span className="num">{ngay(r.doc_date)}</span>
        </Cell>
        <Cell>
          <Code as="a" href={`/print/warehouse/${r.doc_id}`}>
            {r.code}
          </Code>
        </Cell>
        <Cell>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Code as="a" href={`/mua-hang/don/${r.po_id}?muc=giao-nhan`}>
              {r.po_code}
            </Code>
            {r.lsx_code && (
              <span className="num text-k-label text-[var(--ink-3)]">{r.lsx_code}</span>
            )}
          </span>
        </Cell>
        <Cell grow>
          <span className="truncate" title={r.supplier_name}>
            {r.supplier_name}
          </span>
        </Cell>
        <Cell muted>{r.nguoi_nhan ?? '—'}</Cell>
        <Cell>
          <span className="flex flex-wrap gap-1">
            {kq.map((k) => (
              <Tag key={k.kind} tone={k.tone}>
                {k.text}
              </Tag>
            ))}
          </span>
        </Cell>
        <Cell muted>
          {(() => {
            // Một dòng, đủ câu ở tooltip — câu việc dài làm bảng tràn ngang ở 1280.
            const viec =
              (xl.length > 0 ? xl : kq)
                .map((k) => k.viec)
                .filter(Boolean)
                .join(' · ') || '—'
            return (
              <span className="text-k-sm block max-w-[240px] truncate" title={viec}>
                {viec}
              </span>
            )
          })()}
        </Cell>
        <Cell>
          <span className="flex items-center justify-end gap-3 whitespace-nowrap">
            {thieuKg && canWrite && (
              <Btn
                primary
                className="text-k-sm h-[24px] px-2"
                onClick={() => setKgRow(r)}
              >
                Ghi kg cân
              </Btn>
            )}
            {motDon && (
              <Link
                href={`/mua-hang/don/${r.po_id}?muc=giao-nhan`}
                className="text-k-sm font-semibold text-[var(--act)] hover:underline"
              >
                Mở đơn để xử lý
              </Link>
            )}
          </span>
        </Cell>
      </Row>
    )
  }

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Theo dõi đơn hàng"
        chain={<XemTheoDoi at="da-ve" />}
        facts={[
          {
            label: 'Cần xử lý',
            value: String(demCanXl),
            tone: demCanXl > 0 ? 'stop' : undefined,
          },
          { label: `Phiếu nhập ${khoang} ngày`, value: String(inRange.length) },
        ]}
        actions={
          <ScopeSwitch
            label="Phạm vi"
            value={scope}
            onChange={setScope}
            options={[
              {
                value: 'toi',
                label: 'Hàng của tôi',
                count: allRows.filter((r) => r.owner_id === meId).length,
                hint: 'Phiếu nhập của đơn tôi phụ trách',
              },
              {
                value: 'phong',
                label: 'Cả phòng',
                count: allRows.length,
                hint: 'Mọi phiếu nhập theo đơn mua',
              },
            ]}
          />
        }
      />

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} phiếu</b> khi nạp — con số trên màn có thể thiếu.
        </NoticeBar>
      )}

      <FilterBar dense label="Tìm và lọc phiếu nhập">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Số PNK, PO, nhà cung cấp, lệnh…"
          width={260}
        />
        {KHOANG.map((d) => (
          <Chip
            key={d}
            on={khoang === d}
            count={demKhoang(d)}
            icon="lich"
            onClick={() => setKhoang(d)}
          >
            {d} ngày
          </Chip>
        ))}
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline={
            inRange.length === 0
              ? `Chưa có hàng về trong ${khoang} ngày`
              : 'Không có phiếu nào khớp'
          }
          reason={
            inRange.length === 0
              ? scope === 'toi'
                ? `Đơn bạn phụ trách chưa có phiếu nhập nào trong ${khoang} ngày qua.`
                : `Chưa có phiếu nhập theo đơn mua nào trong ${khoang} ngày qua.`
              : `Trong ${inRange.length} phiếu, không phiếu nào khớp “${q.trim()}”.`
          }
          next={
            inRange.length === 0 ? (
              khoang < 30 ? (
                <Btn primary icon="lich" onClick={() => setKhoang(30)}>
                  Xem 30 ngày
                </Btn>
              ) : (
                <Btn primary icon="nhanHang" href="/mua-hang/theo-doi">
                  Sang Đang về
                </Btn>
              )
            ) : (
              <Btn primary icon="boLoc" onClick={() => setQ('')}>
                Bỏ từ khoá
              </Btn>
            )
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Ngày về</th>
            <th>Phiếu nhập</th>
            <th>Đơn · lệnh</th>
            <th>Nhà cung cấp</th>
            <th>Người nhận</th>
            <th>Kết quả nhận</th>
            <th>Việc phải làm</th>
            <th aria-label="Thao tác" />
          </THead>
          <tbody>
            {canXl.length > 0 && (
              <Fragment>
                <GroupRow name="Cần xử lý" cols={8} meta={`${canXl.length} phiếu`} />
                {canXl.map(dong)}
              </Fragment>
            )}
            {conLai.length > 0 && (
              <Fragment>
                <GroupRow
                  name="Không phải làm gì thêm"
                  cols={8}
                  meta={`${conLai.length} phiếu`}
                />
                {conLai.map(dong)}
              </Fragment>
            )}
          </tbody>
        </Table>
      )}

      <StatusBar
        left={[
          'Một dòng = một phiếu nhập theo đơn mua (không gồm nhập ngoài đơn, hoàn kho)',
          'Kết quả đọc từ chính phiếu + trạng thái dòng đơn hiện tại',
        ]}
        right={`${kept.length} / ${inRange.length} phiếu`}
      />
      {kgRow && <KgCanSheet row={kgRow} onClose={() => setKgRow(null)} />}
    </ScreenFrame>
  )
}
