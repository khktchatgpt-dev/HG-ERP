'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { canXuLy, ketQuaPhieu } from '@/lib/da-ve'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import {
  MOI,
  NGOAI_LENH,
  chiaTrang,
  demTheo,
  khoangDong,
  khopLenh,
  tenNccGon,
  type Nhom,
} from '@/lib/theo-doi-loc'
import {
  Btn,
  Cell,
  Code,
  Combobox,
  Empty,
  FilterBar,
  GroupRow,
  NoticeBar,
  Row,
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
import { SuaPhieuSheet } from './sua-phieu'
import { GiaoNhanSheet } from '../giao-nhan/GiaoNhanSheet'
import type { GiaoNhanData } from '../giao-nhan/tai-giao-nhan'
import { PhanTrang, useSucChua } from '../trang'
import { PickVua } from '../DangVeScreen'

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const KHOANG = ['7', '14', '30'] as const
const ngan = (name: string | null) => (name ? name.split(' ').slice(-2).join(' ') : '—')

/**
 * THEO DÕI ĐƠN HÀNG › ĐÃ VỀ — "hàng vừa về, ổn không, còn gì phải làm?"
 * (bản vẽ G3). Hai làn: Cần xử lý (thiếu kg cân · còn thiếu · sai quy cách)
 * rồi Còn lại. Việc xử lý làm ở HỘP GIAO NHẬN; kg cân thiếu ghi ngay tại đây.
 *
 * 02/10/2026 (bản vẽ Bản 6): cùng hàng lọc với Đang về — Lệnh · NCC · Phụ
 * trách · Ngày nhận; cột Phụ trách luôn hiện; vừa một màn, có phân trang.
 */
export function DaVeScreen({
  rows: allRows,
  today,
  truncatedAt,
  canWrite,
  meId,
  defaultScope,
  urlScope,
  giaoNhan,
  initialSua = null,
}: {
  /** `?sua=` — mở sẵn hộp Sửa phiếu của phiếu này (link từ hộp Giao nhận). */
  initialSua?: string | null
  /** Hộp Giao nhận đang mở (`?don=`). */
  giaoNhan: GiaoNhanData | null
  rows: DaVeRow[]
  today: string
  truncatedAt: number | null
  /** Ghi phiếu kho được (`warehouse.stock.write`) — mới có nút Ghi kg cân. */
  canWrite: boolean
  meId: string
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const dongHop = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('don')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const hop = (poId: string) => `/mua-hang/theo-doi/da-ve?don=${poId}`
  const [q, setQ] = useState('')
  const [khoang, setKhoang] = useState<(typeof KHOANG)[number]>('14')
  const [lsx, setLsx] = useState<string>(MOI)
  const [ncc, setNcc] = useState('')
  const [nguoiId, setNguoiId] = useState<string | null>(null)
  const [trang, setTrang] = useState(0)
  const [suaRow, setSuaRow] = useState<DaVeRow | null>(
    () => allRows.find((r) => r.doc_id === initialSua && !r.phieu.reversed) ?? null,
  )
  const [scope, setScope] = useScopePref('da-ve', meId, defaultScope, urlScope)
  const doi =
    <T,>(f: (v: T) => void) =>
    (v: T) => {
      f(v)
      setTrang(0)
    }

  const tu = useMemo(
    () => new Date(Date.parse(today + 'T00:00:00Z') - Number(khoang) * 86_400_000).toISOString().slice(0, 10), // prettier-ignore
    [today, khoang],
  )
  const inScope = useMemo(
    () =>
      nguoiId
        ? allRows.filter((r) => r.owner_id === nguoiId)
        : scope === 'toi'
          ? allRows.filter((r) => r.owner_id === meId)
          : allRows,
    [allRows, scope, meId, nguoiId],
  )
  const inRange = useMemo(() => inScope.filter((r) => r.doc_date.slice(0, 10) >= tu), [inScope, tu]) // prettier-ignore
  const khop = (r: DaVeRow, bo?: 'lsx' | 'ncc') => {
    if (bo !== 'lsx' && !khopLenh(r.lsx_code, lsx)) return false
    if (bo !== 'ncc' && ncc && r.supplier_name !== ncc) return false
    const n = q.trim().toLowerCase()
    if (!n) return true
    return [r.code, r.po_code, r.supplier_name, r.lsx_code, r.supplier_doc_no]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(n))
  }
  const kept = inRange.filter((r) => khop(r))
  const demCanXl = kept.filter((r) => canXuLy(r.phieu)).length
  const demKhoang = (d: string) => {
    const t = new Date(Date.parse(today + 'T00:00:00Z') - Number(d) * 86_400_000).toISOString().slice(0, 10) // prettier-ignore
    return inScope.filter((r) => r.doc_date.slice(0, 10) >= t).length
  }
  const lenh = demTheo(
    inRange.filter((r) => khop(r, 'lsx')),
    (r) => r.lsx_code,
  )
  const ngoaiLenh = inRange.filter((r) => khop(r, 'lsx') && r.lsx_code == null).length
  const nccs = demTheo(
    inRange.filter((r) => khop(r, 'ncc')),
    (r) => r.supplier_name,
  )
  const nguoi = demTheo(allRows, (r) => (r.owner_id ? `${r.owner_id}|${r.owner_name ?? '—'}` : null)) // prettier-ignore
  const dangLoc = !!q.trim() || lsx !== MOI || !!ncc
  const boLoc = () => {
    setQ('')
    setLsx(MOI)
    setNcc('')
    setTrang(0)
  }

  const nhom: Nhom<DaVeRow>[] = useMemo(
    () =>
      [
        { key: 'xl', ten: 'Cần xử lý', rows: kept.filter((r) => canXuLy(r.phieu)) },
        {
          key: 'ok',
          ten: 'Không phải làm gì thêm',
          rows: kept.filter((r) => !canXuLy(r.phieu)),
        },
      ]
        .filter((g) => g.rows.length > 0)
        .map((g) => ({ ...g, meta: `${g.rows.length} phiếu` })),
    [kept],
  )
  const vung = useRef<HTMLDivElement>(null)
  const { cap } = useSucChua(vung)
  const trangs = useMemo(() => chiaTrang(nhom, cap), [nhom, cap])
  const tr = Math.min(trang, Math.max(0, trangs.length - 1))
  const kh = khoangDong(trangs, tr)
  const hienLenh = lsx === MOI

  const dong = (r: DaVeRow) => {
    const kq = ketQuaPhieu(r.phieu)
    const xl = kq.filter((k) => k.can_xu_ly)
    const motDon = kq.some((k) => k.kind === 'thieu' || k.kind === 'sai_quy_cach')
    const viec = (xl.length > 0 ? xl : kq).map((k) => k.viec).filter(Boolean).join(' · ') || '—' // prettier-ignore
    return (
      <Row key={r.doc_id}>
        <Cell pin>
          <span className="num">{ngay(r.doc_date)}</span>
        </Cell>
        <Cell title={r.nguoi_nhan ? `Người nhận: ${r.nguoi_nhan}` : undefined}>
          <Code as="a" href={`/print/warehouse/${r.doc_id}`}>
            {r.code}
          </Code>
          {(r.sua_lai_tu || r.thay_boi) && (
            <span className="text-k-label ml-1 text-[var(--ink-3)]">
              {r.sua_lai_tu ? `sửa của ${r.sua_lai_tu}` : `→ ${r.thay_boi}`}
            </span>
          )}
          {(r.dieu_chinh?.length ?? 0) > 0 && (
            <span
              className="text-k-label ml-1 text-[var(--ink-3)]"
              title="Số trên phiếu đã được điều chỉnh chênh lệch bằng các phiếu này"
            >
              đ/c {r.dieu_chinh.join(', ')}
            </span>
          )}
        </Cell>
        <Cell>
          <Code as="a" href={hop(r.po_id)}>
            {r.po_code}
          </Code>
        </Cell>
        {hienLenh && (
          <Cell muted>
            <span className="num">{r.lsx_code ?? '— ngoài lệnh'}</span>
          </Cell>
        )}
        <Cell grow title={r.supplier_name}>
          <span className="truncate">{tenNccGon(r.supplier_name)}</span>
        </Cell>
        <Cell muted title={r.owner_name ?? undefined}>
          {ngan(r.owner_name)}
        </Cell>
        <Cell>
          <span className="flex flex-nowrap gap-1 overflow-hidden">
            {kq.map((k) => (
              <Tag key={k.kind} tone={k.tone}>
                {k.text}
              </Tag>
            ))}
          </span>
        </Cell>
        <Cell muted title={viec}>
          <span className="text-k-sm block max-w-[220px] truncate">{viec}</span>
        </Cell>
        <Cell>
          <span className="flex items-center justify-end gap-3 whitespace-nowrap">
            {r.phieu.cho_lap_lai && canWrite && (
              <Btn
                primary
                className="text-k-sm h-[24px] px-2"
                href={`/mua-hang/don/${r.po_id}/nhan?sua=${r.doc_id}`}
              >
                Lập lại phiếu
              </Btn>
            )}
            {!r.phieu.reversed && canWrite && (
              <button
                type="button"
                className="text-k-sm font-semibold text-[var(--act)] hover:underline"
                onClick={() => setSuaRow(r)}
              >
                Sửa phiếu
              </button>
            )}
            {motDon && (
              <Link
                href={hop(r.po_id)}
                className="text-k-sm font-semibold text-[var(--act)] hover:underline"
              >
                Xử lý giao nhận
              </Link>
            )}
          </span>
        </Cell>
      </Row>
    )
  }
  const soCot = hienLenh ? 9 : 8

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
          { label: `Phiếu nhập ${khoang} ngày`, value: dangLoc ? `${kept.length}/${inRange.length}` : String(inRange.length) }, // prettier-ignore
        ]}
      />

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} phiếu</b> khi nạp — con số trên màn có thể thiếu.
        </NoticeBar>
      )}

      <FilterBar dense label="Tìm và lọc phiếu nhập">
        <SearchInput
          value={q}
          onChange={doi(setQ)}
          placeholder="Số PNK, PO, NCC…"
          width={150}
        />
        <PickVua
          label="Lệnh sản xuất"
          value={lsx}
          onChange={doi(setLsx)}
          options={[
            {
              value: MOI,
              label: `Mọi lệnh SX (${inRange.filter((r) => khop(r, 'lsx')).length})`,
            },
            ...lenh.map(([c, n]) => ({ value: c, label: `${c} (${n})` })),
            ...(ngoaiLenh > 0
              ? [{ value: NGOAI_LENH, label: `Ngoài lệnh SX (${ngoaiLenh})` }]
              : []),
          ]}
        />
        <Combobox
          label="Nhà cung cấp"
          placeholder="Gõ tên nhà cung cấp…"
          width={140}
          emptyLabel={`Mọi nhà cung cấp (${nccs.length})`}
          value={ncc}
          onChange={doi(setNcc)}
          options={nccs.map(([name, n]) => ({ value: name, label: tenNccGon(name), hint: `${n} phiếu` }))} // prettier-ignore
        />
        <PickVua
          label="Người phụ trách"
          value={nguoiId ? `u:${nguoiId}` : scope}
          onChange={(v) => {
            if (v.startsWith('u:')) setNguoiId(v.slice(2))
            else {
              setNguoiId(null)
              setScope(v as SupplyScope)
            }
            setTrang(0)
          }}
          options={[
            {
              value: 'toi',
              label: `Của tôi (${allRows.filter((r) => r.owner_id === meId).length})`,
            },
            { value: 'phong', label: `Cả phòng (${allRows.length})` },
            ...nguoi.map(([k, n]) => ({ value: `u:${k.split('|')[0]}`, label: `${k.split('|')[1].split(' ').slice(-2).join(' ')} (${n})` })), // prettier-ignore
          ]}
        />
        <PickVua
          label="Ngày nhận"
          value={khoang}
          onChange={doi((v: string) => setKhoang(v as (typeof KHOANG)[number]))}
          options={KHOANG.map((d) => ({
            value: d,
            label: `${d} ngày qua (${demKhoang(d)})`,
          }))}
        />
        <span className="ml-auto">
          <Btn
            icon="boLoc"
            disabled={!dangLoc}
            title={dangLoc ? undefined : 'Chưa có bộ lọc nào đang bật'}
            onClick={boLoc}
          >
            Bỏ lọc
          </Btn>
        </span>
      </FilterBar>

      <div ref={vung} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {kept.length === 0 ? (
          <Empty
            headline={
              inRange.length === 0
                ? `Chưa có hàng về trong ${khoang} ngày`
                : 'Không có phiếu nào khớp'
            }
            reason={
              inRange.length === 0
                ? scope === 'toi' && !nguoiId
                  ? `Đơn bạn phụ trách chưa có phiếu nhập nào trong ${khoang} ngày qua.`
                  : `Chưa có phiếu nhập theo đơn mua nào trong ${khoang} ngày qua.`
                : `Trong ${inRange.length} phiếu, không phiếu nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
            }
            next={
              inRange.length === 0 ? (
                khoang !== '30' ? (
                  <Btn primary icon="lich" onClick={() => setKhoang('30')}>
                    Xem 30 ngày
                  </Btn>
                ) : (
                  <Btn primary icon="nhanHang" href="/mua-hang/theo-doi">
                    Sang Đang về
                  </Btn>
                )
              ) : (
                <Btn primary icon="boLoc" onClick={boLoc}>
                  {`Bỏ lọc · ${inRange.length} phiếu`}
                </Btn>
              )
            }
          />
        ) : (
          <Table label="Phiếu nhập theo đơn mua">
            <THead pinFirst>
              <th>Ngày về</th>
              <th>Phiếu nhập</th>
              <th>Đơn</th>
              {hienLenh && <th>Lệnh SX</th>}
              <th>Nhà cung cấp</th>
              <th>Phụ trách</th>
              <th>Kết quả nhận</th>
              <th>Việc phải làm</th>
              <th aria-label="Thao tác" />
            </THead>
            <tbody>
              {(trangs[tr] ?? []).map((m) =>
                m.kind === 'nhom' ? (
                  <GroupRow
                    key={`g-${m.key}-${m.tiep ? 't' : ''}`}
                    name={m.tiep ? `${m.ten} (tiếp)` : m.ten}
                    cols={soCot}
                    meta={m.meta ?? `${m.n} phiếu`}
                  />
                ) : (
                  dong(m.row)
                ),
              )}
            </tbody>
          </Table>
        )}
      </div>

      <StatusBar
        left={[
          'Một dòng = một phiếu nhập theo đơn mua (không gồm nhập ngoài đơn, hoàn kho)',
          'Rê chuột vào số phiếu để xem người nhận',
        ]}
        right={
          <PhanTrang trang={tr} soTrang={trangs.length} onTrang={setTrang} tu={kh.tu} den={kh.den} tong={kept.length} donVi="phiếu" /> // prettier-ignore
        }
      />
      {suaRow && <SuaPhieuSheet row={suaRow} onClose={() => setSuaRow(null)} />}
      {giaoNhan && <GiaoNhanSheet data={giaoNhan} today={today} onClose={dongHop} />}
    </ScreenFrame>
  )
}
