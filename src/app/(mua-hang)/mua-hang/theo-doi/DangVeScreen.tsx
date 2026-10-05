'use client'

import { useMemo, useRef, useState, type ComponentProps } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DaGhiSoBar } from '@/components/warehouse/DaGhiSoBar'
import {
  INCOMING_BUCKET,
  INCOMING_BUCKETS,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { CACH_GIAO_LABEL, type CachGiao } from '@/lib/cach-giao'
import { poTemplateShort } from '@/lib/po-template'
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
  Chip,
  Code,
  Combobox,
  CoverageBar,
  Empty,
  FilterBar,
  GroupRow,
  Menu,
  NoticeBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  THead,
  Table,
  Tag,
  Tick,
  showMoney,
} from '@/components/kit'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import { useLocalPref } from '@/lib/use-local-pref'
import { HenGiaoNut, XacNhanNut } from './hanh-dong'
import { XemTheoDoi } from './xem'
import { GiaoNhanSheet } from './giao-nhan/GiaoNhanSheet'
import type { GiaoNhanData } from './giao-nhan/tai-giao-nhan'
import { ChuyenSheet, type CarrierOption, type TripEdit } from './chuyen-sheet'
import { ChuyenDangDi, type TripCard } from './chuyen-dang-di'
import { PhanTrang, useSucChua } from './trang'
import { ThanhChon } from './chon-nhieu'
import { searchMatcher } from '@/lib/search-text'

export type DangVeRow = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string | null
  status: string
  expected_at: string | null
  currency: string
  total: number
  /** Người phụ trách (chưa giao ai thì người lập) — lọc theo người. */
  owner_id: string | null
  assignee_name: string | null
  /** Mẫu đơn (`supply_purchase_orders.template`) — lọc Loại đơn. */
  template: string
  lines_done: number
  lines_total: number
  bucket: IncomingBucket
  /** Đơn của người đang xem (lib/supply-scope). */
  mine: boolean
  /** Suy từ câu nơi giao (`lib/cach-giao`); null = đơn chưa ghi nơi giao. */
  cach: CachGiao | null
  /** Tên chành khi `cach === 'chanh'`. */
  chanh: string | null
  /** Người xem được ghi hẹn giao / xác nhận trên đơn này (cùng luật server). */
  editable: boolean
}

type Hen = typeof MOI | 'tuan' | IncomingBucket
type Gom = 'moc' | 'lsx' | 'ncc'
/** Bộ lọc NHỚ theo tài khoản (Hẹn giao không nhớ — nó đến từ link Bàn làm việc). */
type LocNho = { lsx: string; ncc: string; loai: string; gom: Gom }
const LOC_GOC: LocNho = { lsx: MOI, ncc: '', loai: MOI, gom: 'moc' }
const GOM_LABEL: Record<Gom, string> = { moc: 'Mốc hẹn', lsx: 'Lệnh SX', ncc: 'NCC' } // prettier-ignore

/**
 * Ô chọn rộng VỪA chữ của lựa chọn ĐANG CHỌN — mặc định trình duyệt rộng theo lựa
 * chọn DÀI NHẤT, làm hàng lọc phình hai dòng; ép bề rộng cứng thì cắt chữ (02/10).
 */
export function PickVua(props: ComponentProps<typeof Pick>) {
  const t = props.options.find((o) => o.value === props.value)?.label ?? ''
  return <Pick {...props} width={Math.round(t.length * 7.3) + 38} />
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const soNgay = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

const tienStr = (rows: DangVeRow[]) => {
  const m: Record<string, number> = {}
  for (const r of rows) m[r.currency] = (m[r.currency] ?? 0) + r.total
  return Object.entries(m)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `${showMoney(v, { digits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`) // prettier-ignore
}

/**
 * THEO DÕI ĐƠN HÀNG › ĐANG VỀ — bản 02/10/2026 (bản vẽ I1–I4, canvas "Cung ứng
 * · Hàng về" › Bản 6, chủ dự án duyệt): MỘT hàng lọc giống màn Đơn mua (Lệnh ·
 * NCC · Phụ trách · Hẹn giao · Loại đơn · Gom), bỏ thứ trùng/ít dùng (cột Cách
 * giao, link "NCC đã gửi hàng" từng dòng, 7 chip mốc, công tắc phạm vi), và
 * VỪA MỘT MÀN — số dòng mỗi trang đo theo chiều cao thật (`useSucChua`).
 */
export function DangVeScreen({
  rows: allRows,
  today,
  truncatedAt,
  meId,
  defaultScope,
  urlScope,
  initialNhom,
  trips,
  carriers,
  canTrip,
  canReceive,
  vuaGhi,
  giaoNhan,
  luot,
}: {
  /** Lượt NHẬN LẦN LƯỢT đang dở (`?tiep=`): các đơn còn chờ nhận, theo thứ tự đã chọn. */
  luot: { id: string; code: string }[]
  /** Hộp Giao nhận đang mở (`?don=`) — mọi việc ghi giao nhận làm ở đây. */
  giaoNhan: GiaoNhanData | null
  /** Ghi phiếu nhập được (`warehouse.stock.write`) — Cung ứng nhận thay Kho. */
  canReceive: boolean
  /** Phiếu nhập vừa ghi sổ — hiện dải "Đã ghi sổ" có nút In. */
  vuaGhi: { id: string; code: string; detail: string } | null
  /** Chuyến hàng còn theo dõi (0216). */
  trips: TripCard[]
  /** Gợi ý tên chành / nhà xe. */
  carriers: CarrierOption[]
  /** Ghi / sửa / huỷ chuyến được (nhân viên Cung ứng). */
  canTrip: boolean
  rows: DangVeRow[]
  today: string
  truncatedAt: number | null
  meId: string
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
  /** `?nhom=` — một mốc, hoặc 'tuan' = hôm nay + 7 ngày tới (link từ Bàn làm việc). */
  initialNhom: string | null
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
  const [q, setQ] = useState('')
  const [trenXe, setTrenXe] = useState(false)
  const [trang, setTrang] = useState(0)
  // Đơn đang tích chọn — thao tác một lượt (ThanhChon). Chế độ chọn nhiều BẬT
  // khi có ít nhất một đơn được chọn: vào bằng mục "Chọn nhiều đơn" trong menu ⋯
  // của dòng, ra bằng "Bỏ chọn" — lúc thường không có cột tích chiếm chỗ.
  const [chon, setChon] = useState<Set<string>>(new Set())
  const dangChon = chon.size > 0
  const lat = (id: string) =>
    setChon((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const [sheet, setSheet] = useState<{ edit: TripEdit | null; init: string[]; key: number } | null>(null) // prettier-ignore
  const poTrip = useMemo(() => {
    const m = new Map<string, TripCard>()
    for (const t of [...trips].sort((a, b) => (a.sent_on < b.sent_on ? -1 : 1)))
      for (const p of t.pos) m.set(p.id, t)
    return m
  }, [trips])
  const moSheet = (edit: TripEdit | null, init: string[] = []) =>
    setSheet((s) => ({ edit, init, key: (s?.key ?? 0) + 1 }))
  const [hen, setHenRaw] = useState<Hen>(() =>
    initialNhom === 'tuan'
      ? 'tuan'
      : INCOMING_BUCKETS.includes(initialNhom as IncomingBucket)
        ? (initialNhom as IncomingBucket)
        : MOI,
  )
  // Phạm vi Của tôi / Cả phòng giữ khoá nhớ cũ 'nhan-hang'; chọn MỘT người cụ
  // thể là liếc qua việc đồng nghiệp — không nhớ (cùng cách màn Đơn mua).
  const [scope, setScope] = useScopePref('nhan-hang', meId, defaultScope, urlScope)
  const [nguoiId, setNguoiId] = useState<string | null>(null)
  const [locRaw, setLocRaw] = useLocalPref(`hg.theo-doi.loc.${meId}`, JSON.stringify(LOC_GOC)) // prettier-ignore
  const loc: LocNho = useMemo(() => {
    try {
      return { ...LOC_GOC, ...(JSON.parse(locRaw) as Partial<LocNho>) }
    } catch {
      return LOC_GOC
    }
  }, [locRaw])
  const datLoc = (p: Partial<LocNho>) => {
    setLocRaw(JSON.stringify({ ...loc, ...p }))
    setTrang(0)
  }
  const setHen = (h: Hen) => {
    setHenRaw(h)
    setTrang(0)
  }

  // Tập theo NGƯỜI — nền cho mọi số đếm khác (số trong ngoặc của từng ô lọc).
  const theoNguoi = useMemo(
    () =>
      nguoiId
        ? allRows.filter((r) => r.owner_id === nguoiId)
        : scope === 'toi'
          ? allRows.filter((r) => r.mine)
          : allRows,
    [allRows, scope, nguoiId],
  )
  const khop = (r: DangVeRow, bo?: 'lsx' | 'ncc' | 'loai' | 'hen') => {
    if (bo !== 'lsx' && !khopLenh(r.lsx_code, loc.lsx)) return false
    if (bo !== 'ncc' && loc.ncc && r.supplier_name !== loc.ncc) return false
    if (bo !== 'loai' && loc.loai !== MOI && r.template !== loc.loai) return false
    if (bo !== 'hen') {
      if (hen === 'tuan' && r.bucket !== 'today' && r.bucket !== 'week') return false
      if (hen !== MOI && hen !== 'tuan' && r.bucket !== hen) return false
    }
    if (trenXe && !poTrip.has(r.id)) return false
    return searchMatcher(q)([r.code, r.supplier_name, r.lsx_code, r.chanh])
  }
  const kept = theoNguoi.filter((r) => khop(r))
  const ngoaiHen = hen === MOI ? 0 : theoNguoi.filter((r) => khop(r, 'hen')).length

  // Số đầu trang + số trong từng ô chọn: đếm trên tập đã lọc CÁC TRỤC KHÁC.
  const demMoc = (b: IncomingBucket) => theoNguoi.filter((r) => khop(r, 'hen') && r.bucket === b).length // prettier-ignore
  const lenh = demTheo(
    theoNguoi.filter((r) => khop(r, 'lsx')),
    (r) => r.lsx_code,
  )
  const ngoaiLenh = theoNguoi.filter((r) => khop(r, 'lsx') && r.lsx_code == null).length
  const ncc = demTheo(
    theoNguoi.filter((r) => khop(r, 'ncc')),
    (r) => r.supplier_name,
  )
  const loai = demTheo(
    theoNguoi.filter((r) => khop(r, 'loai')),
    (r) => r.template,
  )
  const nguoi = demTheo(allRows, (r) =>
    r.owner_id ? `${r.owner_id}|${r.assignee_name ?? '—'}` : null,
  )
  const dangLoc =
    !!q.trim() ||
    loc.lsx !== MOI ||
    !!loc.ncc ||
    loc.loai !== MOI ||
    hen !== MOI ||
    trenXe

  const nhom: Nhom<DangVeRow>[] = useMemo(() => {
    const theoHen = (a: DangVeRow, b: DangVeRow) =>
      (a.expected_at ?? '9999') < (b.expected_at ?? '9999') ? -1 : 1
    if (loc.gom === 'moc')
      return INCOMING_BUCKETS.map((b) => ({
        key: b,
        ten: INCOMING_BUCKET[b].label,
        rows: kept.filter((r) => r.bucket === b).sort(theoHen),
      }))
        .filter((g) => g.rows.length > 0)
        .map((g) => ({ ...g, meta: `${g.rows.length} đơn` }))
    const keyOf =
      loc.gom === 'lsx'
        ? (r: DangVeRow) => r.lsx_code ?? 'Ngoài lệnh SX'
        : (r: DangVeRow) => tenNccGon(r.supplier_name)
    const m = new Map<string, DangVeRow[]>()
    for (const r of kept) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r])
    return [...m]
      .map(([k, rs]) => ({
        key: k,
        ten: k,
        rows: rs.sort(theoHen),
        meta: `${rs.length} đơn · ${tienStr(rs).join(' · ')}`,
      })) // prettier-ignore
      .sort((a, b) => b.rows.length - a.rows.length || a.ten.localeCompare(b.ten, 'vi'))
  }, [kept, loc.gom])

  const vung = useRef<HTMLDivElement>(null)
  const { cap, rong } = useSucChua(vung)
  // Vùng bảng hẹp (1280 trừ menu bên ≈ 1060px) thì bỏ cột Giá trị — tổng tiền
  // vẫn ở thanh đáy và tiêu đề nhóm; cột Phụ trách KHÔNG bỏ (chủ dự án yêu cầu).
  const hienGia = rong >= 1150
  const trangs = useMemo(() => chiaTrang(nhom, cap), [nhom, cap])
  const tr = Math.min(trang, Math.max(0, trangs.length - 1))
  const khoang = khoangDong(trangs, tr)
  // Đúng MỘT lệnh đang lọc thì cột Lệnh SX lặp một giá trị — ẩn (bản vẽ I2).
  const hienLenh = loc.lsx === MOI
  const soCot = (hienLenh ? 9 : 8) - (hienGia ? 0 : 1) + (dangChon ? 1 : 0)
  const dongTrang = (trangs[tr] ?? []).flatMap((m) => (m.kind === 'dong' ? [m.row] : []))
  const daChon = allRows.filter((r) => chon.has(r.id))
  const tien = tienStr(kept)
  const boLoc = () => {
    setQ('')
    setTrenXe(false)
    setHen(MOI)
    datLoc({ lsx: MOI, ncc: '', loai: MOI })
  }

  // Menu ⋯ của dòng (chủ dự án chọn 02/10: gọn hơn cột tích thường trực).
  const menuDong = (r: DangVeRow): ComponentProps<typeof Menu>['items'] => [
    ...(canReceive
      ? [{ label: 'Nhận hàng', onClick: () => router.push(`/mua-hang/don/${r.id}/nhan`) }]
      : []),
    { label: 'Mở giao nhận', onClick: () => router.push(`/mua-hang/theo-doi?don=${r.id}`, { scroll: false }) }, // prettier-ignore
    ...(canTrip
      ? [{ label: 'Ghi chuyến hàng', onClick: () => moSheet(null, [r.id]) }]
      : []),
    {
      label: chon.has(r.id)
        ? 'Bỏ chọn đơn này'
        : dangChon
          ? 'Thêm vào các đơn đã chọn'
          : 'Chọn nhiều đơn…',
      group: 'Nhiều đơn',
      onClick: () => lat(r.id),
    },
  ]

  const dong = (r: DangVeRow) => {
    const con = soNgay(r.expected_at, today)
    const xe = poTrip.get(r.id)
    // Cách giao chỉ hiện khi KHÁC lệ thường (giao tận xưởng): chành, tự lấy, nhập khẩu.
    const cach = r.cach && r.cach !== 'xuong' ? `${CACH_GIAO_LABEL[r.cach]}${r.chanh ? ` · ${r.chanh}` : ''}` : null // prettier-ignore
    return (
      <Row key={r.id} selected={chon.has(r.id)}>
        {dangChon && (
          <Cell pin>
            <Tick
              checked={chon.has(r.id)}
              onChange={() => lat(r.id)}
              label={`Chọn đơn ${r.code}`}
            />
          </Cell>
        )}
        <Cell>
          {/* Mã đơn mở HỘP GIAO NHẬN tại chỗ (bản vẽ H1) — trang đơn chỉ còn xem. */}
          <Code as="a" href={`/mua-hang/theo-doi?don=${r.id}`}>
            {r.code}
          </Code>
        </Cell>
        {hienLenh && (
          <Cell muted>
            <span className="num">{r.lsx_code ?? '— ngoài lệnh'}</span>
          </Cell>
        )}
        <Cell grow title={r.supplier_name}>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate">{tenNccGon(r.supplier_name)}</span>
            {(cach || xe) && (
              <span className="text-k-label shrink-0 text-[var(--ink-3)]">
                {xe ? (
                  <span className="font-semibold text-[var(--act-text)]">
                    trên xe <span className="num">{xe.code}</span>
                  </span>
                ) : (
                  cach
                )}
              </span>
            )}
          </span>
        </Cell>
        <Cell>
          <span className="flex items-baseline gap-2 whitespace-nowrap">
            {r.expected_at ? (
              <>
                <span
                  className={
                    con != null && con < 0
                      ? 'num font-semibold text-[var(--stop)]'
                      : 'num'
                  }
                >
                  {ngay(r.expected_at)}
                </span>
                {con != null && con < 0 && (
                  <span className="text-k-sm font-semibold text-[var(--stop)]">
                    trễ {-con} ngày
                  </span>
                )}
                {con === 0 && (
                  <span className="text-k-sm text-[var(--ink-3)]">hôm nay</span>
                )}
                {r.editable && (
                  <HenGiaoNut poId={r.id} code={r.code} current={r.expected_at} />
                )}
              </>
            ) : r.editable ? (
              <HenGiaoNut poId={r.id} code={r.code} current={null} />
            ) : (
              <span className="text-[var(--warn)]">chưa hẹn</span>
            )}
          </span>
        </Cell>
        <Cell>
          {r.status !== 'ordered' ? (
            <Tag tone="done">Đã xác nhận</Tag>
          ) : r.editable ? (
            <XacNhanNut poId={r.id} code={r.code} />
          ) : (
            <span className="text-[var(--ink-3)]">chưa xác nhận</span>
          )}
        </Cell>
        <Cell>
          {r.lines_total > 0 ? (
            <CoverageBar
              ratio={r.lines_done / r.lines_total}
              label={`${r.lines_done}/${r.lines_total}`}
            />
          ) : (
            <span className="text-[var(--ink-empty)]">—</span>
          )}
        </Cell>
        <Cell muted title={r.assignee_name ?? undefined}>
          {r.assignee_name ? r.assignee_name.split(' ').slice(-2).join(' ') : '—'}
        </Cell>
        {hienGia && (
          <Cell num>
            <Num value={showMoney(r.total, { digits: r.currency === 'VND' ? 0 : 2 })} />
          </Cell>
        )}
        <Cell>
          <Menu ariaLabel={`Thao tác đơn ${r.code}`} items={menuDong(r)} />
        </Cell>
      </Row>
    )
  }

  const tenNguoi = (id: string) => nguoi.find(([k]) => k.startsWith(id + '|'))?.[0].split('|')[1] ?? 'người đã chọn' // prettier-ignore

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Theo dõi đơn hàng"
        chain={<XemTheoDoi at="dang-ve" />}
        facts={[
          { label: 'Đang về', value: dangLoc ? `${kept.length}/${theoNguoi.length}` : String(theoNguoi.length) }, // prettier-ignore
          { label: 'Quá hẹn', value: String(demMoc('overdue')), tone: demMoc('overdue') > 0 ? 'stop' : undefined, on: hen === 'overdue', onClick: () => setHen(hen === 'overdue' ? MOI : 'overdue') }, // prettier-ignore
          { label: 'Hôm nay', value: String(demMoc('today')), on: hen === 'today', onClick: () => setHen(hen === 'today' ? MOI : 'today') }, // prettier-ignore
          { label: 'Chưa hẹn giao', value: String(demMoc('no_eta')), tone: demMoc('no_eta') > 0 ? 'warn' : undefined, on: hen === 'no_eta', onClick: () => setHen(hen === 'no_eta' ? MOI : 'no_eta') }, // prettier-ignore
        ]}
        actions={
          canTrip && (
            <Btn primary icon="them" onClick={() => moSheet(null)}>
              Ghi chuyến hàng
            </Btn>
          )
        }
      />

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} đơn</b> khi nạp — con số trên màn có thể thiếu.
        </NoticeBar>
      )}

      {vuaGhi && (
        <DaGhiSoBar
          code={vuaGhi.code}
          docId={vuaGhi.id}
          detail={`${vuaGhi.detail} — tồn đã cộng, đơn đã tính lại phần còn chờ.`}
          soPhieuHref="/warehouse/phieu?ro=receipt"
          onClose={() => router.replace('/mua-hang/theo-doi', { scroll: false })}
        />
      )}

      <FilterBar dense label="Tìm và lọc đơn đang về">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v)
            setTrang(0)
          }}
          placeholder="Số PO, NCC, chành…"
          width={170}
        />
        <PickVua
          label="Lệnh sản xuất"
          value={loc.lsx}
          onChange={(v) => datLoc({ lsx: v })}
          options={[
            {
              value: MOI,
              label: `Mọi lệnh SX (${theoNguoi.filter((r) => khop(r, 'lsx')).length})`,
            },
            ...lenh.map(([c, n]) => ({ value: c, label: `${c} (${n})` })),
            ...(ngoaiLenh > 0
              ? [{ value: NGOAI_LENH, label: `Ngoài lệnh SX (${ngoaiLenh})` }]
              : []),
            ...(loc.lsx !== MOI && loc.lsx !== NGOAI_LENH && !lenh.some(([c]) => c === loc.lsx) ? [{ value: loc.lsx, label: `${loc.lsx} (0)` }] : []), // prettier-ignore
          ]}
        />
        <Combobox
          label="Nhà cung cấp"
          placeholder="Gõ tên nhà cung cấp…"
          width={180}
          emptyLabel={`Mọi nhà cung cấp (${ncc.length})`}
          value={loc.ncc}
          onChange={(v) => datLoc({ ncc: v })}
          options={[
            ...ncc.map(([name, n]) => ({
              value: name,
              label: tenNccGon(name),
              hint: `${n} đơn`,
            })),
            ...(loc.ncc && !ncc.some(([x]) => x === loc.ncc) ? [{ value: loc.ncc, label: tenNccGon(loc.ncc), hint: '0 đơn' }] : []), // prettier-ignore
          ]}
        />
        <PickVua
          label="Người phụ trách"
          value={nguoiId ? `u:${nguoiId}` : scope}
          onChange={(v) => {
            if (v.startsWith('u:')) {
              setNguoiId(v.slice(2))
            } else {
              setNguoiId(null)
              setScope(v as SupplyScope)
            }
            setTrang(0)
          }}
          options={[
            { value: 'toi', label: `Của tôi (${allRows.filter((r) => r.mine).length})` },
            { value: 'phong', label: `Cả phòng (${allRows.length})` },
            ...nguoi.map(([k, n]) => ({ value: `u:${k.split('|')[0]}`, label: `${k.split('|')[1].split(' ').slice(-2).join(' ')} (${n})` })), // prettier-ignore
          ]}
        />
        <PickVua
          label="Hẹn giao"
          value={hen}
          onChange={(v) => setHen(v as Hen)}
          options={[
            {
              value: MOI,
              label: `Mọi mốc hẹn (${theoNguoi.filter((r) => khop(r, 'hen')).length})`,
            },
            {
              value: 'tuan',
              label: `Về trong 7 ngày (${demMoc('today') + demMoc('week')})`,
            },
            ...INCOMING_BUCKETS.map((b) => ({ value: b, label: `${INCOMING_BUCKET[b].label} (${demMoc(b)})` })), // prettier-ignore
          ]}
        />
        <PickVua
          label="Loại đơn"
          value={loc.loai}
          onChange={(v) => datLoc({ loai: v })}
          options={[
            {
              value: MOI,
              label: `Mọi loại (${theoNguoi.filter((r) => khop(r, 'loai')).length})`,
            },
            ...loai.map(([t, n]) => ({
              value: t,
              label: `${poTemplateShort(t) ?? t} (${n})`,
            })),
          ]}
        />
        {/* Chỉ hiện khi CÓ đơn trên xe (hoặc đang bật) — chip số 0 là nhiễu. */}
        {(poTrip.size > 0 || trenXe) && (
          <Chip
            on={trenXe}
            count={theoNguoi.filter((r) => poTrip.has(r.id)).length}
            icon="nhanHang"
            onClick={() => setTrenXe(!trenXe)}
          >
            Trên xe
          </Chip>
        )}
        <span className="ml-auto flex items-center gap-2">
          <PickVua
            label="Gom theo"
            value={loc.gom}
            onChange={(v) => datLoc({ gom: v as Gom })}
            options={(Object.keys(GOM_LABEL) as Gom[]).map((g) => ({ value: g, label: `Gom: ${GOM_LABEL[g]}` }))} // prettier-ignore
          />
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

      {daChon.length > 0 && (
        <ThanhChon
          rows={daChon}
          canReceive={canReceive}
          canTrip={canTrip}
          onTrip={(ids) => moSheet(null, ids)}
          onClear={() => setChon(new Set())}
        />
      )}

      {luot.length > 0 && canReceive && (
        <NoticeBar
          tone="neutral"
          tag="Nhận lần lượt"
          action={{
            label: `Nhận tiếp ${luot[0].code}`,
            onClick: () =>
              router.push(
                `/mua-hang/don/${luot[0].id}/nhan${
                  luot.length > 1
                    ? `?tiep=${luot
                        .slice(1)
                        .map((x) => x.id)
                        .join(',')}`
                    : ''
                }`,
              ),
          }}
        >
          Còn <b>{luot.length}</b> đơn trong lượt nhận:{' '}
          {luot.map((x) => x.code).join(', ')}.
        </NoticeBar>
      )}

      <ChuyenDangDi
        trips={trips}
        today={today}
        canTrip={canTrip}
        onEdit={(t) => moSheet({ ...t, po_ids: t.pos.map((p) => p.id) })}
      />

      <div ref={vung} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {kept.length === 0 ? (
          <Empty
            headline={
              theoNguoi.length === 0
                ? nguoiId
                  ? `${tenNguoi(nguoiId)} chưa có đơn nào đang về`
                  : scope === 'toi' && allRows.length > 0
                    ? 'Đơn của bạn chưa có hàng nào đang về'
                    : 'Không có đơn nào đang về'
                : 'Không đơn nào khớp bộ lọc'
            }
            reason={
              theoNguoi.length === 0 && scope === 'toi' && !nguoiId && allRows.length > 0
                ? `Cả phòng có ${allRows.length} đơn đang về, nhưng không đơn nào do bạn phụ trách.`
                : theoNguoi.length === 0
                  ? 'Chỉ đơn ĐÃ GỬI nhà cung cấp mới nằm ở đây. Đơn còn nháp hoặc mới duyệt mà chưa gửi nằm ở Hộp thư việc.'
                  : ngoaiHen > 0
                    ? `Có ${ngoaiHen} đơn khớp các bộ lọc khác nhưng không thuộc mốc "${hen === 'tuan' ? 'Về trong 7 ngày' : INCOMING_BUCKET[hen as IncomingBucket].label}".`
                    : `Trong ${theoNguoi.length} đơn đang về, không đơn nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
            }
            next={
              theoNguoi.length === 0 &&
              (scope === 'toi' || nguoiId) &&
              allRows.length > 0 ? (
                <Btn
                  primary
                  icon="boLoc"
                  onClick={() => {
                    setNguoiId(null)
                    setScope('phong')
                  }}
                >
                  Xem hàng về của cả phòng
                </Btn>
              ) : theoNguoi.length === 0 ? (
                <Btn primary icon="don" href="/mua-hang/don">
                  Mở tất cả đơn mua
                </Btn>
              ) : ngoaiHen > 0 ? (
                <Btn primary icon="boLoc" onClick={() => setHen(MOI)}>
                  {`Bỏ lọc Hẹn giao · ${ngoaiHen} đơn`}
                </Btn>
              ) : (
                <Btn primary icon="boLoc" onClick={boLoc}>
                  {`Bỏ hết lọc · ${theoNguoi.length} đơn`}
                </Btn>
              )
            }
          />
        ) : (
          <Table label="Đơn đang về">
            <THead pinFirst={dangChon}>
              {dangChon && (
                <th>
                  {/* Chọn cả TRANG đang xem — không lén chọn đơn ở trang khác. */}
                  <Tick
                    checked={dongTrang.every((r) => chon.has(r.id))}
                    onChange={(on) =>
                      setChon((c) => {
                        const n = new Set(c)
                        for (const r of dongTrang) {
                          if (on) n.add(r.id)
                          else n.delete(r.id)
                        }
                        return n
                      })
                    }
                    label={`Chọn ${dongTrang.length} đơn của trang này`}
                  />
                </th>
              )}
              <th>Đơn</th>
              {hienLenh && <th>Lệnh SX</th>}
              <th>Nhà cung cấp</th>
              <th>Hẹn giao</th>
              <th>NCC</th>
              <th>Về kho</th>
              <th>Phụ trách</th>
              {hienGia && <th style={{ textAlign: 'right' }}>Giá trị</th>}
              <th aria-label="Thao tác" />
            </THead>
            <tbody>
              {(trangs[tr] ?? []).map((m) =>
                m.kind === 'nhom' ? (
                  <GroupRow
                    key={`g-${m.key}-${m.tiep ? 't' : ''}`}
                    name={m.tiep ? `${m.ten} (tiếp)` : m.ten}
                    cols={soCot}
                    meta={m.meta ?? `${m.n} đơn`}
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
          tien.length > 0
            ? `Cộng ${kept.length} đơn · ${tien.join(' · ')} — giá trị ĐƠN chưa VAT, không phải số đã về kho, không gồm phí xe`
            : `${kept.length} đơn — chưa đơn nào có giá trị`,
          `Gom: ${GOM_LABEL[loc.gom]}`,
        ]}
        right={
          <PhanTrang
            trang={tr}
            soTrang={trangs.length}
            onTrang={setTrang}
            tu={khoang.tu}
            den={khoang.den}
            tong={kept.length}
            donVi="đơn"
          />
        }
      />
      {sheet && (
        <ChuyenSheet
          key={sheet.key}
          open
          onClose={() => setSheet(null)}
          today={today}
          edit={sheet.edit}
          initialPoIds={sheet.init}
          carriers={carriers}
          pos={allRows.map((r) => ({
            id: r.id,
            code: r.code,
            supplier_name: r.supplier_name,
            lsx_code: r.lsx_code,
            chanh: r.chanh,
          }))}
        />
      )}
      {giaoNhan && <GiaoNhanSheet data={giaoNhan} today={today} onClose={dongHop} />}
    </ScreenFrame>
  )
}
