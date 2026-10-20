'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Chip,
  Code,
  Empty,
  FilterBar,
  NoticeBar,
  Num,
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  Table,
  Tag,
  showMoney,
  TableSettings,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import { ThemNccSheet } from './them-ncc'
import { searchMatcher } from '@/lib/search-text'

export type NccRow = {
  id: string
  code: string | null
  name: string
  short_name: string | null
  tax_no: string | null
  type: string | null
  status: string
  is_active: boolean
  can_order: boolean
  po_count: number
  open_po_count: number
  last_po: string | null
  last_po_at: string | null
  /** Tổng chi THEO TỪNG loại tiền — xem lý do không cộng chung ở `page.tsx`. */
  spend: Record<string, number>
  /** Người phụ trách: gán tay, hoặc suy từ lịch sử đơn (lib/supply-scope). */
  buyer_name: string | null
  buyer_src: 'gan' | 'suy' | null
  /** NCC của người đang xem. */
  mine: boolean
}

/** Hồ sơ NCC — Khuôn E, dựng 15/09/2026. Ở lại trong khu mới. */
const profileHref = (id: string) => `/mua-hang/ncc/${id}`

const ngung = (r: NccRow) => r.status !== 'active' || !r.is_active

/**
 * CHIP LỌC — mỗi chip là một CÂU HỎI của người mua, không phải một giá trị
 * enum đem ra bày. "status = suspended" không phải câu hỏi; "ai còn đơn dở
 * dang", "ai khai rồi mà chưa đặt bao giờ" mới là.
 */
const CHIPS: { id: string; label: string; test: (r: NccRow) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'open', label: 'Còn đơn dở dang', test: (r) => r.open_po_count > 0 },
  { id: 'never', label: 'Chưa từng đặt', test: (r) => r.po_count === 0 },
  { id: 'stopped', label: 'Ngừng giao dịch', test: ngung },
  { id: 'locked', label: 'Đang khoá đặt hàng', test: (r) => !r.can_order },
]

function ngay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** ["6.582.566.971 ₫", "326.726,29 USD"] — mỗi loại tiền một cụm, không quy đổi. */
function tienTheoLoai(spend: Record<string, number>): string[] {
  return Object.entries(spend)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cur, v]) =>
        `${showMoney(v, { digits: cur === 'VND' ? 0 : 2 })} ${cur === 'VND' ? '₫' : cur}`,
    )
}

/**
 * CỘT CỦA BẢNG NCC — khai ở module, chỉ phần tổng đổi theo dữ liệu.
 *
 * CỘT ĐỊNH DANH LÀ TÊN, KHÔNG PHẢI MÃ. Đo 14/09/2026: chỉ 44/164 NCC có mã
 * (27%) — ghim cột mã lên đầu thì 120 dòng mở ra một cột toàn dấu gạch, và
 * người đọc cuộn ngang xong không biết dòng đang xem là của ai. Mã vẫn hiện,
 * nhưng đi kèm tên.
 */
function cotNcc({
  tongDon,
  tongMo,
}: {
  tongDon: number
  tongMo: number
}): KitCol<NccRow>[] {
  return [
    {
      id: 'ten',
      header: 'Nhà cung cấp',
      pin: true,
      // Tên NCC là TÊN DÒNG: trình đọc nói "Thép Asia, Đơn đặt 12…" khi đi
      // ngang một dòng thay vì đọc số trơ (B7½, 24/09/2026).
      rowHeader: true,
      grow: true,
      sort: (r) => r.name,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <Code as="a" href={profileHref(r.id)} title={r.name}>
            {r.name}
          </Code>
          {r.code && (
            <span className="num text-k-label text-[var(--ink-3)]">{r.code}</span>
          )}
          {ngung(r) && <Tag tone="warn">Ngừng</Tag>}
          {!r.can_order && <Tag tone="stop">Khoá đặt</Tag>}
        </span>
      ),
    },
    {
      id: 'phuTrach',
      header: 'Người phụ trách',
      sort: (r) => r.buyer_name,
      /* Suy từ đơn thì chữ nhạt + ghi rõ — để người đọc biết đó là đoán, gán
         chính thức ở hồ sơ NCC (27/09/2026). */
      cell: (r) =>
        r.buyer_name ? (
          <span className={r.buyer_src === 'suy' ? 'text-[var(--ink-3)]' : undefined}>
            {r.buyer_name}
            {r.buyer_src === 'suy' && <span className="text-k-label"> · suy từ đơn</span>}
          </span>
        ) : (
          ''
        ),
    },
    {
      id: 'loai',
      header: 'Mặt hàng',
      muted: true,
      sort: (r) => r.type,
      cell: (r) => r.type ?? '',
    },
    {
      id: 'dat',
      header: 'Đã đặt',
      num: true,
      sort: (r) => r.po_count,
      foot: tongDon || '',
      cell: (r) => <Num value={String(r.po_count || '')} />,
    },
    {
      id: 'dang',
      header: 'Dở dang',
      num: true,
      sort: (r) => r.open_po_count,
      foot: tongMo || '',
      /*
        ✓ CHỈ cho NCC đã từng đặt mà nay không còn đơn dở dang — đó mới là
        "xong". NCC chưa đặt đơn nào cũng có số 0, nhưng 0 đó nghĩa là "chưa có
        việc", không phải "hết việc": tô ✓ xanh cho 132 hồ sơ như vậy là hứa một
        điều không có.
      */
      cell: (r) => (
        <Num
          value={String(r.open_po_count || '')}
          strong
          zero={r.po_count > 0 ? 'done' : 'dash'}
        />
      ),
    },
    {
      id: 'ganNhat',
      header: 'Đơn gần nhất',
      muted: true,
      sort: (r) => r.last_po_at,
      /*
        MÃ ĐƠN TRÊN, NGÀY DƯỚI — không nằm ngang. Xếp ngang thì cột này đòi 205px
        (đo 17/09/2026), nhiều hơn cả cột TÊN nhà cung cấp, và đẩy bảng tràn
        khung. Nó là cột tra cứu phụ, không đáng hơn cột định danh.
      */
      cell: (r) =>
        r.last_po ? (
          <span className="flex flex-col leading-tight">
            <span className="num">{r.last_po}</span>
            <span className="text-k-label text-[var(--ink-3)]">{ngay(r.last_po_at)}</span>
          </span>
        ) : (
          ''
        ),
    },
    {
      id: 'chi',
      header: 'Tổng chi',
      num: true,
      /*
        KHÔNG cho sắp. NCC mua bằng hai loại tiền (VND + USD) không có MỘT con số
        để xếp hạng; sắp theo phần VND thì NCC mua bằng USD tụt xuống đáy như
        thể mua ít nhất — một thứ tự bịa. Nguyên tắc 3 của sổ: con số là lời hứa.
      */
      cell: (r) => {
        const chi = tienTheoLoai(r.spend)
        return chi.length === 0 ? (
          <Num value="" />
        ) : (
          // Hai loại tiền thì bày hai dòng, không gộp — cột cao thêm một dòng vẫn
          // hơn một con số không có thật.
          <span className="num flex flex-col items-end leading-tight">
            {chi.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        )
      },
    },
  ]
}

export function NccScreen({
  rows: allRows,
  chamTran,
  meId,
  defaultScope,
  urlScope,
  canManage,
  buyers,
}: {
  rows: NccRow[]
  meId: string
  /** Quyền `supply.supplier.manage` — đúng quyền service kiểm khi thêm. */
  canManage: boolean
  /** Người mua (ô Người phụ trách). */
  buyers: { id: string; name: string }[]
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
  /** Nguồn nào chạm trần nạp — xem lý do phải nói ra ở `page.tsx`. */
  chamTran: 'ncc' | 'don' | null
}) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')
  const [them, setThem] = useState(false)
  // Loại đang dùng, nhiều trước — gợi ý bấm nhanh trong panel Thêm.
  const types = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of allRows) {
      const t = r.type?.trim()
      if (t) n.set(t, (n.get(t) ?? 0) + 1)
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [allRows])
  // NCC CỦA TÔI (27/09/2026): gán cho tôi, hoặc chưa gán mà tôi từng đặt.
  const [scope, setScope] = useScopePref('ncc', meId, defaultScope, urlScope)
  const mineCount = allRows.filter((r) => r.mine).length
  const rows = useMemo(
    () => (scope === 'toi' ? allRows.filter((r) => r.mine) : allRows),
    [allRows, scope],
  )

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    const tim = searchMatcher(q)
    return rows
      .filter((r) => test(r) && tim([r.code, r.name, r.short_name, r.tax_no, r.type]))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [rows, q, chip])

  const tongDon = kept.reduce((s, r) => s + r.po_count, 0)
  const tongMo = kept.reduce((s, r) => s + r.open_po_count, 0)
  const tongChi: Record<string, number> = {}
  for (const r of kept)
    for (const [cur, v] of Object.entries(r.spend)) tongChi[cur] = (tongChi[cur] ?? 0) + v
  const chiText = tienTheoLoai(tongChi)

  const columns = useMemo(() => cotNcc({ tongDon, tongMo }), [tongDon, tongMo])
  const engine = useKitTable({
    rows: kept,
    columns,
    rowKey: (r) => r.id,
    prefsKey: 'mua-hang-ncc',
    foot: {
      label: `Cộng ${kept.length} nhà cung cấp đang hiện`,
      note:
        chiText.length === 0
          ? 'Chưa đơn nào có tiền — tổng chi để trống, không phải bằng 0.'
          : `Tổng chi ${chiText.join(' · ')} — cộng riêng từng loại tiền, KHÔNG quy đổi. Chưa gồm đơn đã huỷ.`,
    },
  })

  const dangGiaoDich = rows.filter((r) => !ngung(r)).length
  const chuaDat = rows.filter((r) => r.po_count === 0).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Nhà cung cấp"
        facts={[
          {
            label: scope === 'toi' ? 'NCC của tôi' : 'Tổng NCC',
            value: String(rows.length),
          },
          { label: 'Đang giao dịch', value: String(dangGiaoDich) },
          {
            label: 'Ngừng giao dịch',
            value: String(rows.length - dangGiaoDich),
            tone: rows.length - dangGiaoDich > 0 ? 'warn' : 'neutral',
          },
          /*
            "Chưa từng đặt" KHÔNG tô đỏ dù số lớn: phần lớn là NCC mới khai
            hoặc NCC dự phòng — chưa đặt là đúng, không phải hỏng. Nguyên tắc
            3 của sổ thiết kế: số 0 (và số lớn) không mặc nhiên là xấu.
          */
          { label: 'Chưa từng đặt', value: String(chuaDat) },
        ]}
        actions={
          <>
            <ScopeSwitch
              label="Phạm vi"
              value={scope}
              onChange={setScope}
              options={[
                {
                  value: 'toi',
                  label: 'NCC của tôi',
                  count: mineCount,
                  hint: 'Gán cho tôi, hoặc chưa gán mà tôi từng đặt',
                },
                {
                  value: 'phong',
                  label: 'Cả công ty',
                  count: allRows.length,
                  hint: 'Mọi nhà cung cấp',
                },
              ]}
            />
            <Btn
              icon="them"
              primary
              blockedBy={canManage ? undefined : 'phòng Cung ứng'}
              onClick={() => setThem(true)}
            >
              Thêm nhà cung cấp
            </Btn>
          </>
        }
      />

      {chamTran && (
        <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Thu hẹp bằng ô tìm' }}>
          {chamTran === 'ncc'
            ? 'Danh sách chạm trần 500 nhà cung cấp khi nạp — còn hồ sơ chưa hiện trên màn.'
            : 'Lịch sử mua chạm trần 500 đơn khi nạp — số đơn và tổng chi trên màn có thể THIẾU.'}{' '}
          Cần chuyển màn này sang lọc/phân trang ở server trước khi dữ liệu lớn thêm.
        </NoticeBar>
      )}

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm tên, mã, mặt hàng hoặc mã số thuế…"
          width={300}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={rows.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </Chip>
        ))}
        <span className="ml-auto">
          <TableSettings engine={engine} />
        </span>
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline={
            rows.length === 0 && scope === 'toi'
              ? 'Bạn chưa phụ trách nhà cung cấp nào'
              : 'Không có nhà cung cấp nào khớp'
          }
          reason={
            rows.length === 0 && scope === 'toi'
              ? 'NCC của tôi = NCC gán cho tôi ở hồ sơ NCC, hoặc chưa gán mà tôi từng đặt đơn.'
              : `Bộ lọc “${CHIPS.find((c) => c.id === chip)?.label}”${q.trim() ? ` cộng với từ khoá “${q.trim()}”` : ''} không còn dòng nào.`
          }
          next={
            <Btn
              icon="boLoc"
              onClick={() => {
                if (rows.length === 0) setScope('phong')
                setQ('')
                setChip('all')
              }}
            >
              Bỏ lọc, xem cả {rows.length} nhà cung cấp
            </Btn>
          }
        />
      ) : (
        /*
          MÁY BẢNG (B5, 24/09/2026): bấm tiêu đề để sắp, nút "Cột" trên thanh
          lọc để ẩn cột / đổi mật độ — người mua nhớ theo máy của họ. Chân bảng
          do máy tự chia cột, nên ẩn cột nào cũng không lệch.
        */
        <Table engine={engine} />
      )}

      <StatusBar
        left={[
          chip === 'all' && !q.trim() ? 'Khung nhìn: tất cả' : 'Khung nhìn: đang lọc',
          'Bấm tên để mở hồ sơ nhà cung cấp',
        ]}
        right={`${kept.length} / ${rows.length} NCC`}
      />
      {them && (
        <ThemNccSheet
          rows={allRows}
          types={types}
          buyers={buyers}
          meId={meId}
          onClose={() => setThem(false)}
        />
      )}
    </ScreenFrame>
  )
}
