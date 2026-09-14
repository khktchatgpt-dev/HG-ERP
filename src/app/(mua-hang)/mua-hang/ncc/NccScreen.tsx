'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  NoticeBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
} from '@/components/kit'

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
}

/** Hồ sơ NCC bản mới (Khuôn E) chưa dựng — tạm dẫn sang hồ sơ bản cũ. */
const profileHref = (id: string) => `/planning/suppliers/${id}`

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

export function NccScreen({
  rows,
  canEdit,
  chamTran,
}: {
  rows: NccRow[]
  canEdit: boolean
  /** Nguồn nào chạm trần nạp — xem lý do phải nói ra ở `page.tsx`. */
  chamTran: 'ncc' | 'don' | null
}) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    const needle = q.trim().toLowerCase()
    return rows
      .filter(
        (r) =>
          test(r) &&
          (!needle ||
            [r.code, r.name, r.short_name, r.tax_no, r.type]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle))),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [rows, q, chip])

  const tongDon = kept.reduce((s, r) => s + r.po_count, 0)
  const tongMo = kept.reduce((s, r) => s + r.open_po_count, 0)
  const tongChi: Record<string, number> = {}
  for (const r of kept)
    for (const [cur, v] of Object.entries(r.spend)) tongChi[cur] = (tongChi[cur] ?? 0) + v
  const chiText = tienTheoLoai(tongChi)

  const dangGiaoDich = rows.filter((r) => !ngung(r)).length
  const chuaDat = rows.filter((r) => r.po_count === 0).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Nhà cung cấp"
        facts={[
          { label: 'Tổng NCC', value: String(rows.length) },
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
          canEdit ? <Btn href="/planning/suppliers">Thêm / sửa hồ sơ</Btn> : undefined
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
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline="Không có nhà cung cấp nào khớp"
          reason={`Bộ lọc “${CHIPS.find((c) => c.id === chip)?.label}”${q.trim() ? ` cộng với từ khoá “${q.trim()}”` : ''} không còn dòng nào.`}
          next={
            <Btn
              onClick={() => {
                setQ('')
                setChip('all')
              }}
            >
              Bỏ lọc, xem cả {rows.length} nhà cung cấp
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            {/*
              CỘT ĐỊNH DANH LÀ TÊN, KHÔNG PHẢI MÃ. Đo 14/09/2026: chỉ 44/164
              NCC có mã (27%) — ghim cột mã lên đầu thì 120 dòng mở ra một cột
              toàn dấu gạch, và người đọc cuộn ngang xong không biết dòng đang
              xem là của ai. Mã vẫn hiện, nhưng đi kèm tên.
            */}
            <th>Nhà cung cấp</th>
            <th>Mặt hàng</th>
            <th style={{ textAlign: 'right' }}>Đã đặt</th>
            <th style={{ textAlign: 'right' }}>Dở dang</th>
            <th>Đơn gần nhất</th>
            <th style={{ textAlign: 'right' }}>Tổng chi</th>
          </THead>
          <tbody>
            {kept.map((r) => {
              const chi = tienTheoLoai(r.spend)
              return (
                <Row key={r.id}>
                  <Cell pin grow>
                    <span className="flex items-center gap-2">
                      <Code as="a" href={profileHref(r.id)} title={r.name}>
                        {r.name}
                      </Code>
                      {r.code && (
                        <span className="num text-[10.5px] text-[var(--ink-3)]">
                          {r.code}
                        </span>
                      )}
                      {ngung(r) && <Tag tone="warn">Ngừng</Tag>}
                      {!r.can_order && <Tag tone="stop">Khoá đặt</Tag>}
                    </span>
                  </Cell>
                  <Cell muted>{r.type ?? ''}</Cell>
                  <Cell num>
                    <Num value={String(r.po_count || '')} />
                  </Cell>
                  <Cell num>
                    {/*
                      ✓ CHỈ cho NCC đã từng đặt mà nay không còn đơn dở dang —
                      đó mới là "xong". NCC chưa đặt đơn nào cũng có số 0, nhưng
                      0 đó nghĩa là "chưa có việc", không phải "hết việc": tô ✓
                      xanh cho 132 hồ sơ như vậy là hứa một điều không có.
                    */}
                    <Num
                      value={String(r.open_po_count || '')}
                      strong
                      zero={r.po_count > 0 ? 'done' : 'dash'}
                    />
                  </Cell>
                  <Cell muted>
                    {r.last_po ? (
                      <span className="flex items-baseline gap-2">
                        <span className="num">{r.last_po}</span>
                        <span className="text-[var(--ink-3)]">{ngay(r.last_po_at)}</span>
                      </span>
                    ) : (
                      ''
                    )}
                  </Cell>
                  <Cell num>
                    {chi.length === 0 ? (
                      <Num value="" />
                    ) : (
                      /*
                        NCC mua bằng hai loại tiền thì bày hai dòng, không gộp.
                        Cột cao thêm một dòng vẫn hơn một con số không có thật.
                      */
                      <span className="num flex flex-col items-end leading-tight">
                        {chi.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </span>
                    )}
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={<td colSpan={2}>Cộng {kept.length} nhà cung cấp đang hiện</td>}
            cells={
              <>
                <td className="num">{tongDon || ''}</td>
                <td className="num">{tongMo || ''}</td>
              </>
            }
            caveat={
              chiText.length === 0
                ? 'Chưa đơn nào có tiền — tổng chi để trống, không phải bằng 0.'
                : `Tổng chi ${chiText.join(' · ')} — cộng riêng từng loại tiền, KHÔNG quy đổi. Chưa gồm đơn đã huỷ.`
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          chip === 'all' && !q.trim() ? 'Khung nhìn: tất cả' : 'Khung nhìn: đang lọc',
          'Hồ sơ chi tiết mở ở khu Cung ứng cũ',
        ]}
        right={`${kept.length} / ${rows.length} NCC`}
      />
    </ScreenFrame>
  )
}
