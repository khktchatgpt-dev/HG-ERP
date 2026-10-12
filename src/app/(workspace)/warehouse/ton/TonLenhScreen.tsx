'use client'

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  NoticeBar,
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
import { isoToVn } from '@/lib/date-vn'
import { RO_LENH, type RoLenh } from '@/lib/kho-ton-lenh'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import { LenhChiTiet } from './lenh-chi-tiet'
import type { LenhDong, MaChiTiet } from './ton-lenh.shared'
import { XemSwitch } from './xem-switch'

const RO_NHAN: Record<RoLenh, string> = {
  con: 'Kho còn hàng của lệnh',
  han: 'Quá hạn · ≤ 7 ngày',
  xong: 'Lệnh xong chưa ghi xuất',
  all: 'Tất cả',
}
/** Tiêu đề số được xuống dòng — chữ nowrap của kit ép bảng tràn khung 812px (1024 + sidebar mở). */
const RH = { textAlign: 'right', whiteSpace: 'normal' } as const

/** Số ngày từ hôm nay tới hạn (âm = đã qua). */
const conNgay = (ship: string, today: string) =>
  Math.round(
    (Date.parse(`${ship}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )

function Han({ l, today }: { l: LenhDong; today: string }) {
  if (!l.ship_date) return <span className="text-[var(--ink-empty)]">chưa có</span>
  const n = conNgay(l.ship_date, today)
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="num">{isoToVn(l.ship_date)}</span>
      {!l.xong && n < 0 && (
        <span className="font-semibold text-[var(--stop)]">quá {-n} ngày</span>
      )}
      {!l.xong && n >= 0 && n <= 7 && (
        <span className="font-semibold text-[var(--warn)]">
          {n === 0 ? 'hôm nay' : `còn ${n} ngày`}
        </span>
      )}
    </span>
  )
}

const so = (n: number) =>
  n === 0 ? <span className="text-[var(--ink-empty)]">·</span> : <span>{n}</span>

/**
 * TỒN KHO THEO LỆNH — Kho đợt 2 · Bước 5 (bản vẽ B5-1/B5-2/B5-5
 * https://claude.ai/artifact/L2FFuzCdLzMPzQJ7ULUprF, duyệt 12/10/2026).
 *
 * Câu màn trả lời: lệnh nào đang có hàng nằm trong kho mà tổ chưa lấy, lệnh nào
 * sắp / đã quá hạn xuất hàng, lệnh đã xong còn sót gì. Đo 12/10: 158/168 mã có tồn
 * là hàng của lệnh chưa ghi xuất; từ 03/10 không có phiếu xuất nào.
 *
 * Mỗi dòng một lệnh đã có hàng về (Q5: lệnh chưa có gì về không hiện). Số đếm
 * từ CÙNG hàm với hộp "Lấy hàng của lệnh" ở phiếu xuất (B4) — chia tồn Q2. Bấm
 * dòng mở ngăn chi tiết; "Xuất cho lệnh" mở phiếu xuất đã chọn sẵn lệnh.
 *
 * Màn hẹp: < 1100px ẩn Khách + Xuất gần nhất, Thiếu tồn gộp vào cột Còn.
 */
export function TonLenhScreen({
  lenh,
  chiTiet,
  ro: roDau,
  mo: moDau,
  today,
}: {
  lenh: LenhDong[]
  chiTiet: MaChiTiet[]
  ro: RoLenh
  mo: string | null
  /** Ngày VN (YYYY-MM-DD) — từ server, tránh lệch giờ quanh nửa đêm. */
  today: string
}) {
  const [ro, setRo] = useState<RoLenh>(roDau)
  const [q, setQ] = useState('')
  const [mo, setMo] = useState<string | null>(moDau)
  const khung = useRef<HTMLDivElement>(null)
  const gon = useBeRong(khung) < 1100

  /** Bộ lọc + lệnh đang mở nằm trên URL: F5 / gửi link giữ đúng chỗ. */
  const ghiUrl = (r: RoLenh, m: string | null) => {
    const s = new URLSearchParams({ xem: 'lenh' })
    if (r !== 'con') s.set('ro', r)
    if (m) s.set('lenh', m)
    window.history.replaceState(null, '', `/warehouse/ton?${s}`)
  }
  const chonRo = (r: RoLenh) => {
    setRo(r)
    ghiUrl(r, mo)
  }
  const moLenh = (id: string | null) => {
    setMo(id)
    ghiUrl(ro, id)
  }

  const khop = searchMatcher(q)
  const theoTim = lenh.filter((l) => khop([l.code, l.khach ?? '']))
  const dem = Object.fromEntries(
    RO_LENH.map((r) => [r, theoTim.filter((l) => l.ro[r]).length]),
  ) as Record<RoLenh, number>
  const rows = theoTim.filter((l) => l.ro[ro])
  const cong = rows.reduce(
    (a, l) => ({ con: a.con + l.con_kho, thieu: a.thieu + l.thieu, het: a.het + l.het }),
    { con: 0, thieu: 0, het: 0 },
  )
  const tongCon = lenh.reduce((s, l) => s + l.con_kho, 0)
  const xuatCuoi = lenh.reduce<string | null>(
    (a, l) => (l.xuat_cuoi && (!a || l.xuat_cuoi > a) ? l.xuat_cuoi : a),
    null,
  )
  const chiTietMo = useMemo(
    () => (mo ? chiTiet.filter((c) => c.lsx_id === mo) : []),
    [chiTiet, mo],
  )
  const lenhMo = lenh.find((l) => l.id === mo) ?? null
  const soCot = gon ? 8 : 11

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      style={{ '--col-grow': '140px' } as CSSProperties}
    >
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Tồn kho"
          facts={[
            { label: 'Lệnh có hàng về', value: String(lenh.length) },
            { label: 'Mã còn trong kho cho lệnh', value: String(tongCon) },
          ]}
          actions={
            <Btn icon="xuatKho" href="/warehouse/xuat">
              Lập phiếu xuất
            </Btn>
          }
        />
        <FilterBar>
          <XemSwitch xem="lenh" />
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm lệnh, khách…"
            width={gon ? 150 : 220}
          />
          {RO_LENH.map((r) => (
            <Chip key={r} on={ro === r} count={dem[r]} onClick={() => chonRo(r)}>
              {RO_NHAN[r]}
            </Chip>
          ))}
        </FilterBar>
        {(ro === 'con' || ro === 'han') && tongCon > 0 && (
          <NoticeBar tone="warn" tag="Chưa ghi xuất">
            {xuatCuoi
              ? `Lần ghi xuất cho lệnh gần nhất: ${isoToVn(xuatCuoi)}. `
              : 'Chưa có phiếu xuất cho lệnh nào. '}
            {tongCon} mã dưới đây là hàng đã mua cho lệnh mà sổ chưa ghi giao cho tổ. Tổ
            đã lấy thì ghi xuất để tồn trên máy đúng với kho thật.
          </NoticeBar>
        )}
        {ro === 'xong' && rows.length > 0 && (
          <NoticeBar tone="neutral" tag="Lệnh đã xong">
            Các lệnh này còn mã sổ chưa ghi xuất, nhưng kho không còn hàng nào của chúng:
            hàng đã vào sản phẩm và kiểm kê 15/09 đã trừ tồn. Ghi xuất bù bây giờ sẽ làm
            âm tồn, nên ở đây không có nút ghi.
          </NoticeBar>
        )}
        <div ref={khung} className="h-0 w-full" aria-hidden />
        {rows.length === 0 ? (
          <Empty
            headline={`Không có lệnh nào trong rổ "${RO_NHAN[ro]}"`}
            reason={
              q.trim()
                ? `Không lệnh nào khớp "${q.trim()}" trong rổ này.`
                : ro === 'xong'
                  ? 'Mọi lệnh đã xong đều đã ghi xuất hết hàng đã về.'
                  : ro === 'han'
                    ? 'Không lệnh nào quá hạn hoặc tới hạn xuất hàng trong 7 ngày mà kho còn hàng của lệnh.'
                    : 'Kho không còn hàng nào đã mua cho lệnh mà chưa ghi xuất.'
            }
            next={
              <Btn
                icon="boLoc"
                primary
                onClick={() => {
                  setQ('')
                  chonRo('all')
                }}
              >
                Xem tất cả lệnh
              </Btn>
            }
          />
        ) : (
          <Table minWidth={gon ? 640 : 1000} label="Tồn kho theo lệnh">
            <THead>
              <th>Lệnh</th>
              {!gon && <th style={{ width: 150 }}>Khách</th>}
              <th style={{ width: 84, whiteSpace: 'normal' }}>Trạng thái</th>
              <th style={{ width: gon ? 112 : 150, whiteSpace: 'normal' }}>
                Hạn xuất hàng
              </th>
              <th style={{ ...RH, width: 70 }} title="Mã đã về">
                {gon ? 'Đã về' : 'Mã đã về'}
              </th>
              <th style={{ ...RH, width: 76 }} title="Mã đã xuất đủ">
                {gon ? 'Xuất đủ' : 'Đã xuất đủ'}
              </th>
              <th
                style={{ ...RH, width: gon ? 116 : 96 }}
                title="Mã còn trong kho cho lệnh"
              >
                {gon ? 'Còn kho' : 'Còn trong kho'}
              </th>
              {!gon && <th style={{ ...RH, width: 76 }}>Thiếu tồn</th>}
              <th style={{ ...RH, width: 66 }}>Kho hết</th>
              {!gon && <th style={{ width: 100 }}>Xuất gần nhất</th>}
              <th style={{ width: gon ? 74 : 124 }} />
            </THead>
            <tbody>
              {rows.map((l) => (
                <Row key={l.id} selected={l.id === mo} onClick={() => moLenh(l.id)}>
                  <Cell grow title={l.khach ? `${l.code} · ${l.khach}` : l.code}>
                    <button
                      type="button"
                      className="truncate text-left text-[var(--act-text)] underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        moLenh(l.id)
                      }}
                    >
                      <Code>{l.code}</Code>
                    </button>
                  </Cell>
                  {!gon && (
                    <Cell muted>
                      <span className="block truncate" title={l.khach ?? ''}>
                        {l.khach ?? '—'}
                      </span>
                    </Cell>
                  )}
                  <Cell>
                    <Tag tone={l.xong ? 'done' : 'run'}>
                      {l.xong ? 'Đã xong' : 'Đang SX'}
                    </Tag>
                  </Cell>
                  <Cell>
                    <Han l={l} today={today} />
                  </Cell>
                  <Cell num>{l.ma_ve}</Cell>
                  <Cell num muted>
                    {so(l.xuat_du)}
                  </Cell>
                  <Cell num>
                    <b>{l.con_kho}</b>
                    {gon && l.thieu > 0 && (
                      <span className="ml-1 font-normal text-[var(--warn)]">
                        · {l.thieu} thiếu
                      </span>
                    )}
                  </Cell>
                  {!gon && (
                    <Cell num>
                      {l.thieu > 0 ? (
                        <span className="font-semibold text-[var(--warn)]">
                          {l.thieu}
                        </span>
                      ) : (
                        so(0)
                      )}
                    </Cell>
                  )}
                  <Cell num muted>
                    {so(l.het)}
                  </Cell>
                  {!gon && (
                    <Cell muted>
                      {l.xuat_cuoi ? (
                        <span className="num">{isoToVn(l.xuat_cuoi)}</span>
                      ) : (
                        <span className="text-[var(--ink-empty)]">chưa xuất</span>
                      )}
                    </Cell>
                  )}
                  <Cell>
                    <span className="flex justify-end">
                      {!l.xong && l.con_kho > 0 && (
                        <Btn
                          icon={gon ? undefined : 'xuatKho'}
                          href={`/warehouse/xuat?lsx=${l.id}`}
                          className="text-k-sm h-6 px-2"
                        >
                          {gon ? 'Xuất ›' : 'Xuất cho lệnh'}
                        </Btn>
                      )}
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={
                <td colSpan={gon ? 4 : 6}>
                  {rows.length} lệnh · {cong.con} mã còn trong kho cho lệnh
                  {cong.thieu > 0 && ` · ${cong.thieu} mã tồn ít hơn phần của lệnh`}
                </td>
              }
              cells={null}
              caveat={
                gon
                  ? 'Không gồm lệnh chưa có hàng về. Mã chung nhiều lệnh: đếm ở lệnh được chia tồn.'
                  : 'Không gồm lệnh chưa có hàng về. Một mã chung nhiều lệnh đếm ở lệnh được chia tồn: lệnh đang SX hạn xuất sớm trước, lệnh đã xong sau cùng.'
              }
              caveatSpan={soCot - (gon ? 4 : 6)}
            />
          </Table>
        )}
        <StatusBar
          left={['Xếp: quá hạn → hạn gần → theo hạn xuất hàng · lệnh đã xong ở cuối']}
          right={`${rows.length} / ${lenh.length} lệnh`}
        />
      </ScreenFrame>
      {lenhMo && (
        <LenhChiTiet
          key={lenhMo.id}
          lenh={lenhMo}
          rows={chiTietMo}
          onClose={() => moLenh(null)}
        />
      )}
    </div>
  )
}
