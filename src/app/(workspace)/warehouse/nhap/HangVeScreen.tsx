'use client'

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DaGhiSoBar } from '@/components/warehouse/DaGhiSoBar'
import {
  INCOMING_BUCKET,
  INCOMING_BUCKETS,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { poTemplateShort } from '@/lib/po-template'
import { MOI, NGOAI_LENH, demTheo, khopLenh, tenNccGon } from '@/lib/theo-doi-loc'
import { searchMatcher } from '@/lib/search-text'
import { useLocalPref } from '@/lib/use-local-pref'
import { useBeRong } from '@/lib/use-be-rong'
import {
  chiDongTuDo,
  ngay,
  ngayBatThuong,
  soNgayToi,
  xepHangVe,
  type HangVeRow,
} from '@/lib/kho-hang-ve'
import {
  Btn,
  Cell,
  Code,
  Combobox,
  CoverageBar,
  Empty,
  FilterBar,
  GroupRow,
  NoticeBar,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { HangCuaDonSheet } from './hang-cua-don'
import type { HangCuaDonData } from './tai-hang-cua-don'

type Hen = typeof MOI | 'tuan' | IncomingBucket
type Gom = 'moc' | 'lsx' | 'ncc'
const GOM_LABEL: Record<Gom, string> = { moc: 'Mốc hẹn', lsx: 'Lệnh SX', ncc: 'NCC' } // prettier-ignore

/** Ô chọn rộng vừa chữ lựa chọn đang chọn (cùng cách màn Theo dõi). */
function PickVua(props: ComponentProps<typeof Pick>) {
  const t = props.options.find((o) => o.value === props.value)?.label ?? ''
  return <Pick {...props} width={Math.round(t.length * 7.3) + 38} />
}

/**
 * KHO › HÀNG VỀ (bản vẽ B1-1…B1-4, duyệt 12/10/2026). Một dòng = một đơn đang
 * về; mốc, ô số đầu màn và badge menu đếm bằng CÙNG `bucket` server tính bằng
 * `incomingBucket` — bấm ô số là ra đúng chừng ấy dòng.
 *
 * Khác Theo dõi của Cung ứng ở chỗ CHỈ có việc của Kho: Nhận hàng, xem hàng của
 * đơn. Không có nút hẹn giao / NCC xác nhận / chuyến hàng (việc với NCC), không
 * có ô Người phụ trách (Kho xem cả phòng) — cột Phụ trách giữ để biết gọi ai.
 */
export function HangVeScreen({
  rows,
  today,
  canEdit,
  truncatedAt,
  hangCuaDon,
}: {
  rows: HangVeRow[]
  today: string
  /** Ghi phiếu kho được (`warehouse.stock.write`). */
  canEdit: boolean
  truncatedAt: number | null
  /** Hộp "Hàng của đơn" đang mở (`?don=`). */
  hangCuaDon: HangCuaDonData | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const thayUrl = (sua: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString())
    sua(p)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const moDon = (id: string) => thayUrl((p) => p.set('don', id))
  const dongDon = () => thayUrl((p) => p.delete('don'))
  /*
    Phiếu VỪA GHI ở form nhận hàng — form đẩy mã phiếu sang đây qua URL để dải
    "Đã ghi sổ" (có nút In) sống qua lần điều hướng. Đóng dải = xoá tham số.
  */
  const vuaGhi = params.get('vua_ghi')
  const vuaGhiMa = params.get('ma')
  const dongVuaGhi = () =>
    thayUrl((p) => {
      p.delete('vua_ghi')
      p.delete('ma')
      p.delete('chi_tiet')
    })

  const [q, setQ] = useState('')
  const [hen, setHen] = useState<Hen>(MOI)
  const [lsx, setLsx] = useState<string>(MOI)
  const [ncc, setNcc] = useState('')
  const [loai, setLoai] = useState<string>(MOI)
  /*
    LUẬT MÀN HẸP (Kho đợt 2 · Bước 2c, bản vẽ B2-4): đo KHUNG chứ không đo cửa sổ —
    B1 "vừa 1280" lúc sidebar thu gọn, mở sidebar ra là 1053/1151 cuộn ngang.
    < 1100px: ẩn Loại hàng + Phụ trách (còn ở tooltip mã đơn), gom ô lọc phụ vào
    "Lọc thêm". < 900px (1024 có sidebar): cột Đợt / Về kho / nút nhận co lại.
  */
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  const gon = rong < 1100
  const hep = rong < 900
  const [themLoc, setThemLoc] = useState(false)
  const [gomRaw, setGom] = useLocalPref('hg.kho.hang-ve.gom', 'moc')
  const gom: Gom = gomRaw === 'lsx' || gomRaw === 'ncc' ? gomRaw : 'moc'

  // Một hàm khớp, bỏ được MỘT trục — số trong từng ô chọn đếm trên tập đã lọc các trục khác.
  const khop = (r: HangVeRow, bo?: 'hen' | 'lsx' | 'ncc' | 'loai') => {
    if (bo !== 'lsx' && !khopLenh(r.lsx_code, lsx)) return false
    if (bo !== 'ncc' && ncc && r.supplier_name !== ncc) return false
    if (bo !== 'loai' && loai !== MOI && r.template !== loai) return false
    if (bo !== 'hen') {
      if (hen === 'tuan' && r.bucket !== 'today' && r.bucket !== 'week') return false
      if (hen !== MOI && hen !== 'tuan' && r.bucket !== hen) return false
    }
    return searchMatcher(q)([r.po_code, r.supplier_name, r.lsx_code, ...r.extra_lsx])
  }
  const kept = rows.filter((r) => khop(r))
  const demMoc = (b: IncomingBucket) => rows.filter((r) => khop(r, 'hen') && r.bucket === b).length // prettier-ignore
  const lenh = demTheo(rows.filter((r) => khop(r, 'lsx')), (r) => r.lsx_code) // prettier-ignore
  const ngoaiLenh = rows.filter((r) => khop(r, 'lsx') && r.lsx_code == null).length
  const nccs = demTheo(rows.filter((r) => khop(r, 'ncc')), (r) => r.supplier_name) // prettier-ignore
  const loais = demTheo(rows.filter((r) => khop(r, 'loai')), (r) => r.template) // prettier-ignore
  const dangLoc = !!q.trim() || hen !== MOI || lsx !== MOI || !!ncc || loai !== MOI
  const boLoc = () => {
    setQ('')
    setHen(MOI)
    setLsx(MOI)
    setNcc('')
    setLoai(MOI)
  }
  const batHen = (b: IncomingBucket) => setHen(hen === b ? MOI : b)

  const nhom = useMemo(() => {
    if (gom === 'moc')
      return INCOMING_BUCKETS.map((b) => {
        const rs = kept.filter((r) => r.bucket === b).sort(xepHangVe)
        return {
          key: b,
          ten: INCOMING_BUCKET[b].label,
          meta: `${rs.length} đơn`,
          rows: rs,
        }
      }).filter((g) => g.rows.length > 0)
    const keyOf =
      gom === 'lsx'
        ? (r: HangVeRow) => r.lsx_code ?? 'Ngoài lệnh SX'
        : (r: HangVeRow) => tenNccGon(r.supplier_name)
    const m = new Map<string, HangVeRow[]>()
    for (const r of kept) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r])
    return [...m]
      .map(([k, rs]) => {
        const tre = rs.filter((r) => r.bucket === 'overdue').length
        const done = rs.reduce((s, r) => s + r.lines_done, 0)
        const tot = rs.reduce((s, r) => s + r.lines_total, 0)
        return {
          key: k,
          ten: k,
          meta: `${rs.length} đơn${tre ? ` · ${tre} quá hẹn` : ''} · về ${done}/${tot} dòng`,
          rows: rs.sort(xepHangVe),
        }
      })
      .sort((a, b) => b.rows.length - a.rows.length || a.ten.localeCompare(b.ten, 'vi'))
  }, [kept, gom])

  // Đúng MỘT lệnh đang lọc thì cột Lệnh SX lặp một giá trị — ẩn.
  const hienLenh = lsx === MOI || lsx === NGOAI_LENH
  const soCot = (hienLenh ? 9 : 8) - (gon ? 2 : 0)
  const soGo = kept.filter(chiDongTuDo).length

  const dong = (r: HangVeRow) => {
    const n = r.expected_at ? soNgayToi(r.expected_at, today) : null
    const la = ngayBatThuong(r.expected_at, today)
    const tuDo = chiDongTuDo(r)
    const gap = !la && (r.bucket === 'overdue' || r.bucket === 'today')
    return (
      <Row key={r.po_id} selected={hangCuaDon?.po.id === r.po_id}>
        <Cell pin>
          {r.expected_at ? (
            <span className="flex items-baseline gap-2 whitespace-nowrap">
              {/* Khung gọn: ngày lạ (năm 2610) chỉ còn nhãn — chuỗi ngày dài kéo cả cột. */}
              {!(la && gon) && (
                <span
                  className={
                    !la && n != null && n < 0
                      ? 'num font-semibold text-[var(--stop)]'
                      : 'num'
                  }
                >
                  {ngay(r.expected_at, today)}
                </span>
              )}
              {la ? (
                <span
                  title={`Hẹn ${ngay(r.expected_at, today)} — cách hôm nay hơn một năm, có thể gõ nhầm năm. Nhờ người phụ trách sửa.`}
                >
                  <Tag tone="warn">ngày lạ</Tag>
                </span>
              ) : n != null && n < 0 ? (
                <span
                  className="text-k-sm font-semibold text-[var(--stop)]"
                  title={`trễ ${-n} ngày`}
                >
                  {gon ? `−${-n}` : `trễ ${-n} ngày`}
                </span>
              ) : n === 0 ? (
                <span className="text-k-sm text-[var(--ink-3)]">hôm nay</span>
              ) : null}
            </span>
          ) : (
            <span className="text-[var(--warn)]">chưa hẹn</span>
          )}
        </Cell>
        <Cell>
          <Code
            as="button"
            onClick={() => moDon(r.po_id)}
            title={[
              'Xem hàng của đơn',
              gon && (poTemplateShort(r.template) ?? r.template),
              gon && r.owner_name && `phụ trách ${r.owner_name}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            {r.po_code}
          </Code>
        </Cell>
        {hienLenh && (
          <Cell muted title={[r.lsx_code, ...r.extra_lsx].filter(Boolean).join(', ')}>
            <span className="num">{r.lsx_code ?? '— ngoài lệnh'}</span>
            {r.extra_lsx.length > 0 && (
              <span className="text-k-label ml-1">+{r.extra_lsx.length}</span>
            )}
          </Cell>
        )}
        <Cell grow title={r.supplier_name}>
          <span className="truncate">{tenNccGon(r.supplier_name)}</span>
        </Cell>
        {!gon && <Cell muted>{poTemplateShort(r.template) ?? r.template}</Cell>}
        <Cell>
          <DotCell r={r} today={today} hep={gon} />
        </Cell>
        <Cell>
          {tuDo ? (
            <span
              className="text-[var(--ink-3)]"
              title="Đơn chỉ có dòng theo mã SP — không vào sổ kho"
            >
              {hep ? '—' : 'dòng theo mã SP'}
            </span>
          ) : hep ? (
            <span className="num">
              {r.lines_done}/{r.lines_total}
            </span>
          ) : (
            <CoverageBar
              ratio={r.lines_done / r.lines_total}
              label={`${r.lines_done}/${r.lines_total}`}
            />
          )}
        </Cell>
        {!gon && (
          <Cell muted title={r.owner_name ?? undefined}>
            {r.owner_name ? r.owner_name.split(' ').slice(-1)[0] : '—'}
          </Cell>
        )}
        <Cell>
          <span className="flex justify-end">
            {tuDo ? (
              <Btn
                disabled
                className="text-k-sm h-6 px-2"
                title="Đơn chỉ có dòng theo mã SP (gỗ…): không vào tồn kho, Cung ứng nghiệm thu ngoài sổ."
              >
                {hep ? 'Ngoài sổ' : 'Ngoài sổ kho'}
              </Btn>
            ) : (
              <Btn
                icon="nhanHang"
                primary={gap && canEdit}
                blockedBy={canEdit ? undefined : 'Kho'}
                href={`/warehouse/nhap/${r.po_id}${r.dot?.ke_tiep ? `?dot=${r.dot.ke_tiep.id}` : ''}`}
                className="text-k-sm h-6 px-2"
              >
                {hep ? 'Nhận' : 'Nhận hàng'}
              </Btn>
            )}
          </span>
        </Cell>
      </Row>
    )
  }

  return (
    /*
      Lớp token `.kit` BẮT BUỘC ở gốc màn trong vỏ workspace (WorkspaceShell
      không gắn) — thiếu là chữ 16px, không lề (dính 16/09/2026).
    */
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      // Cột NCC co tới 140px (kit mặc định 200): 9 cột phải vừa 1280 không cuộn
      // ngang — đo 12/10: 1275px trong khung 1213px. Tên đầy đủ nằm ở `title`.
      style={{ '--col-grow': hep ? '110px' : '140px' } as CSSProperties}
    >
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Hàng về"
          facts={[
            { label: 'Đang về', value: dangLoc ? `${kept.length}/${rows.length}` : String(rows.length), on: !dangLoc, onClick: boLoc }, // prettier-ignore
            { label: 'Quá hẹn', value: String(demMoc('overdue')), tone: demMoc('overdue') > 0 ? 'stop' : undefined, on: hen === 'overdue', onClick: () => batHen('overdue') }, // prettier-ignore
            { label: 'Hôm nay', value: String(demMoc('today')), on: hen === 'today', onClick: () => batHen('today') }, // prettier-ignore
            { label: '7 ngày tới', value: String(demMoc('week')), on: hen === 'week', onClick: () => batHen('week') }, // prettier-ignore
            { label: 'Chưa hẹn', value: String(demMoc('no_eta')), tone: demMoc('no_eta') > 0 ? 'warn' : undefined, on: hen === 'no_eta', onClick: () => batHen('no_eta') }, // prettier-ignore
          ]}
          actions={
            <>
              {/* Hàng về KHÔNG có đơn (N2) — nút phụ: có đơn thì vẫn nhận theo đơn. */}
              <Btn icon="nhapKho" href="/warehouse/nhap/ngoai-don">
                Nhận không theo đơn
              </Btn>
              <Btn icon="nhapKho" href="/warehouse/nhap/hoan-kho">
                Hoàn kho từ SX
              </Btn>
              <Btn icon="so" href="/warehouse/phieu">
                Sổ phiếu
              </Btn>
            </>
          }
        />
        {vuaGhi && vuaGhiMa && (
          <DaGhiSoBar
            code={vuaGhiMa}
            docId={vuaGhi}
            detail={`${params.get('chi_tiet') ?? 'đã vào sổ'} — tồn đã cộng.`}
            soPhieuHref="/warehouse/phieu?ro=receipt"
            onClose={dongVuaGhi}
          />
        )}
        {truncatedAt != null && (
          <NoticeBar tone="warn" tag="Cắt đuôi">
            Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp — con số trên màn có thể
            thiếu.
          </NoticeBar>
        )}
        <FilterBar dense label="Tìm và lọc hàng đang về">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Số PO, NCC, lệnh…"
            width={170}
          />
          <PickVua
            label="Lệnh sản xuất"
            value={lsx}
            onChange={setLsx}
            options={[
              {
                value: MOI,
                label: `Mọi lệnh SX (${rows.filter((r) => khop(r, 'lsx')).length})`,
              },
              ...lenh.map(([c, n]) => ({ value: c, label: `${c} (${n})` })),
              ...(ngoaiLenh > 0 ? [{ value: NGOAI_LENH, label: `Ngoài lệnh SX (${ngoaiLenh})` }] : []), // prettier-ignore
            ]}
          />
          <Combobox
            label="Nhà cung cấp"
            placeholder="Gõ tên nhà cung cấp…"
            width={180}
            emptyLabel={`Mọi nhà cung cấp (${nccs.length})`}
            value={ncc}
            onChange={setNcc}
            options={nccs.map(([name, n]) => ({ value: name, label: tenNccGon(name), hint: `${n} đơn` }))} // prettier-ignore
          />
          <PickVua
            label="Hẹn giao"
            value={hen}
            onChange={(v) => setHen(v as Hen)}
            options={[
              {
                value: MOI,
                label: `Mọi mốc hẹn (${rows.filter((r) => khop(r, 'hen')).length})`,
              },
              {
                value: 'tuan',
                label: `Về trong 7 ngày (${demMoc('today') + demMoc('week')})`,
              },
              ...INCOMING_BUCKETS.map((b) => ({ value: b, label: `${INCOMING_BUCKET[b].label} (${demMoc(b)})` })), // prettier-ignore
            ]}
          />
          {(!gon || themLoc) && (
            <PickVua
              label="Loại hàng"
              value={loai}
              onChange={setLoai}
              options={[
                {
                  value: MOI,
                  label: `Mọi loại hàng (${rows.filter((r) => khop(r, 'loai')).length})`,
                },
                ...loais.map(([t, n]) => ({ value: t, label: `${poTemplateShort(t) ?? t} (${n})` })), // prettier-ignore
              ]}
            />
          )}
          <span className="ml-auto flex items-center gap-2">
            {gon && (
              <Btn
                icon="boLoc"
                aria-expanded={themLoc}
                onClick={() => setThemLoc(!themLoc)}
                title="Loại hàng và cách gom"
              >
                {themLoc
                  ? 'Thu lọc'
                  : `Lọc thêm${(loai !== MOI ? 1 : 0) + (gom !== 'moc' ? 1 : 0) ? ` (${(loai !== MOI ? 1 : 0) + (gom !== 'moc' ? 1 : 0)})` : ''}`}
              </Btn>
            )}
            {(!gon || themLoc) && (
              <PickVua
                label="Gom theo"
                value={gom}
                onChange={setGom}
                options={(Object.keys(GOM_LABEL) as Gom[]).map((g) => ({ value: g, label: `Gom: ${GOM_LABEL[g]}` }))} // prettier-ignore
              />
            )}
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
        <div ref={khung} className="h-0 w-full" aria-hidden />
        {kept.length === 0 ? (
          <Empty
            headline={
              rows.length === 0 ? 'Không có hàng nào đang về' : 'Không có đơn nào khớp'
            }
            reason={
              rows.length === 0
                ? 'Chỉ đơn NCC đã xác nhận mới nằm ở đây. Khi Cung ứng ghi NCC xác nhận, đơn tự hiện ở màn này. Hàng tới mà không có đơn thì nhận không theo đơn.'
                : `Trong ${rows.length} đơn đang về, không đơn nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
            }
            next={
              rows.length === 0 ? (
                <Btn icon="nhapKho" primary href="/warehouse/nhap/ngoai-don">
                  Nhận hàng không theo đơn
                </Btn>
              ) : (
                <Btn icon="boLoc" primary onClick={boLoc}>
                  Xem cả {rows.length} đơn
                </Btn>
              )
            }
          />
        ) : (
          <Table minWidth={hep ? 680 : gon ? 860 : undefined}>
            <THead pinFirst>
              <th>Hẹn giao</th>
              <th>Đơn</th>
              {hienLenh && <th>Lệnh SX</th>}
              <th>Nhà cung cấp</th>
              {!gon && <th>Loại hàng</th>}
              <th>Đợt · xe tới</th>
              <th>Về kho</th>
              {!gon && <th>Phụ trách</th>}
              <th />
            </THead>
            <tbody>
              {nhom.map((g) => (
                <Fragment key={g.key}>
                  <GroupRow name={g.ten} cols={soCot} meta={g.meta} />
                  {g.rows.map(dong)}
                </Fragment>
              ))}
            </tbody>
            <TFoot
              label={
                // Ô chú thích chiếm 5 cột — để 2 cột mặc định thì nó bị ép còn ~200px và
                // chân bảng cao 100px, ăn mất 3 dòng (đo 12/10/2026).
                <td colSpan={soCot - 5}>
                  Cộng {kept.length} đơn đang về
                  {soGo > 0 ? ` · ${soGo} đơn ngoài sổ kho` : ''}
                </td>
              }
              cells={null}
              caveatSpan={5}
              caveat="Không gồm đơn nháp, đơn NCC chưa xác nhận. “Về kho” = dòng vật tư đã nhận đủ hoặc đã chốt thiếu / tổng dòng vật tư."
            />
          </Table>
        )}
        <StatusBar
          left={[
            dangLoc ? 'Khung nhìn: đang lọc' : 'Khung nhìn: tất cả',
            'Nguồn: cùng hàm với Theo dõi đơn hàng của Cung ứng',
          ]}
          right={`${kept.length} / ${rows.length} đơn`}
        />
      </ScreenFrame>
      {hangCuaDon && (
        <HangCuaDonSheet
          data={hangCuaDon}
          today={today}
          canEdit={canEdit}
          onClose={dongDon}
        />
      )}
    </div>
  )
}

/**
 * Cột "Đợt · xe tới": đợt kế tiếp đứng trước (thứ thủ kho chờ), đợt đã nhập
 * trước hạn đi sau, gọn một dòng — câu đầy đủ nằm ở `title` và trong hộp đơn.
 */
function DotCell({ r, today, hep }: { r: HangVeRow; today: string; hep: boolean }) {
  const d = r.dot
  if (!d) return <span className="text-[var(--ink-3)]">chưa chia đợt</span>
  const truoc = d.da_nhap_truoc.join(', ')
  const cau = [
    d.ke_tiep
      ? `Đợt kế tiếp: đợt ${d.ke_tiep.seq}/${d.so_dot}, hẹn ${ngay(d.ke_tiep.date, today)}${d.ke_tiep.arrived ? ', NCC báo xe đã tới' : ''}.`
      : 'Không còn đợt nào đang chờ.',
    truoc ? `Đợt ${truoc} hẹn trước đó nhưng hàng đã nhập đủ — không phải chờ xe.` : '',
  ].join(' ')
  return (
    <span className="whitespace-nowrap" title={cau}>
      {d.ke_tiep ? (
        <span className="num">
          {hep ? '' : 'Đợt '}
          {d.ke_tiep.seq}/{d.so_dot} · {ngay(d.ke_tiep.date, today)}
        </span>
      ) : (
        !truoc && <span className="text-[var(--ink-3)]">hết đợt đã hẹn</span>
      )}
      {d.ke_tiep?.arrived && (
        <span className="font-semibold text-[var(--warn)]">
          {' '}
          · {hep ? 'tới' : 'đã tới'}
        </span>
      )}
      {truoc && (
        <span className="font-semibold text-[var(--done)]">
          {d.ke_tiep ? ' · ' : ''}
          {hep ? `✓đ${truoc}` : `đợt ${truoc} đã về`}
        </span>
      )}
    </span>
  )
}
