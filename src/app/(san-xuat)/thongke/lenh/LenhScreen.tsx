'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CoverageBar,
  Empty,
  FilterBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { isStale } from '@/lib/lsx-holder'
import { VIEWS } from './views'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

/**
 * M2 — LỆNH SẢN XUẤT, Khuôn C.
 *
 * BỐN LUẬT CỦA KHUÔN C áp ở đây:
 *
 *  1. Mỗi chip lọc ĐẾM BẰNG ĐÚNG HÀM mà nó lọc (`VIEWS` bên dưới) — nguyên
 *     tắc 3 của /design-lab: "con số là một lời hứa". Đếm một đằng lọc một nẻo
 *     là bấm vào ra khác số, và người dùng hết tin cả trang.
 *  2. Mỗi dòng nói VIỆC PHẢI LÀM, không nói tên trạng thái: cột "Vướng" ghi
 *     "thiếu 106 mã vật tư", không ghi "materials_pending".
 *  3. Cột định danh GHIM TRÁI — bảng cuộn ngang mà mất mã lệnh là đọc sai dòng.
 *  4. Trạng thái rỗng phải nói LÝ DO và VIỆC TIẾP (`Empty`), không để bảng trắng.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')

function daysLeft(iso: string): number {
  const d = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

/** Câu "vướng gì" của một lệnh — nói thứ CẤP nhất, không liệt kê hết. */
function snag(r: OverviewRow): { text: string; tone: 'stop' | 'warn' } | null {
  const m = r.materials
  if (m && m.due_overdue_days != null && m.due_overdue_days > 0) {
    return { text: `vật tư quá hẹn ${m.due_overdue_days} ngày`, tone: 'stop' }
  }
  if (m && m.missing_count > 0) {
    return { text: `thiếu ${fmt(m.missing_count)} mã vật tư`, tone: 'warn' }
  }
  if (r.component_count === 0) return { text: 'chưa định hình chi tiết', tone: 'warn' }
  if (r.jobs_total === 0) return { text: 'chưa lên kế hoạch công đoạn', tone: 'warn' }
  if (r.plan_overdue > 0) {
    return { text: `${r.plan_overdue} việc quá hạn kế hoạch`, tone: 'warn' }
  }
  return null
}

/**
 * DẢI CÔNG ĐOẠN — thứ tự CỐ ĐỊNH theo danh mục, không theo lệnh.
 *
 * Cố định mới đọc được theo CỘT: mắt lướt dọc một cột là so được mọi lệnh ở
 * cùng công đoạn. Xếp theo lộ trình riêng từng lệnh thì ô thứ ba của dòng này
 * là Nguội, của dòng kia là May — bảng thành vô nghĩa khi so sánh.
 *
 * Ô SỌC = công đoạn KHÔNG nằm trong lộ trình của lệnh. Khác hẳn ô 0% (có
 * trong lộ trình nhưng chưa ai làm) — gộp hai thứ này là người đọc tưởng
 * xưởng đang chậm ở một công đoạn mà lệnh đó không hề đi qua.
 */
function StageStrip({
  chips,
  stages,
}: {
  chips: OverviewRow['chips']
  stages: { code: string; label: string }[]
}) {
  const byCode = new Map(chips.map((c) => [c.stage, c]))
  /*
    CẢ CỘT NÀY TỪNG CÂM VỚI TRÌNH ĐỌC MÀN HÌNH.

    12 ô chỉ mang `title`, không một ký tự văn bản — nên với trình đọc màn
    hình, và cả khi bôi đen sao chép bảng, toàn bộ thông tin tiến độ biến mất.
    `title` cũng không hiện được trên thiết bị cảm ứng.

    Vá bằng `role="img"` + một câu tóm tắt, thay vì rắc `aria-label` vào từng
    ô: đọc 12 nhãn rời cho MỖI dòng của bảng 14 dòng là 168 lần phát ngôn —
    đúng kiểu "có aria" mà không dùng nổi. Dải là MỘT hình, nên nói một câu.

    Chỉ kể công đoạn NẰM TRONG lộ trình: đọc cả bảy công đoạn lệnh không đi
    qua là thêm nhiễu, đúng thứ ô sọc sinh ra để loại bỏ bằng mắt.
  */
  const tomTat = stages
    .map((s) => {
      const c = byCode.get(s.code)
      if (!c || c.total === 0) return null
      return `${s.label} ${Math.round(Math.min(1, c.done / c.total) * 100)}%`
    })
    .filter(Boolean)
  return (
    <span
      role="img"
      aria-label={
        tomTat.length > 0
          ? `Tiến độ công đoạn — ${tomTat.join(', ')}`
          : 'Chưa có công đoạn nào trong lộ trình của lệnh này'
      }
      className="flex gap-0.5"
    >
      {stages.map((s) => {
        const c = byCode.get(s.code)
        if (!c || c.total === 0) {
          return (
            <span
              key={s.code}
              title={`${s.label} — không nằm trong lộ trình của lệnh này`}
              className="h-[14px] w-[15px] rounded-[2px] bg-[repeating-linear-gradient(45deg,var(--track),var(--track)_2px,transparent_2px,transparent_4px)]"
            />
          )
        }
        const pct = Math.min(1, c.done / c.total)
        const full = pct >= 1
        return (
          <span
            key={s.code}
            title={`${s.label}: ${fmt(c.done)}/${fmt(c.total)}${c.doing > 0 ? ` · ${fmt(c.doing)} đang làm` : ''}`}
            className="relative h-[14px] w-[15px] overflow-hidden rounded-[2px] bg-[var(--track)]"
          >
            <i
              // `--fill` chứ không `--act`: ô này là DỮ LIỆU, không bấm được.
              // Cùng luật với `CoverageBar` — xem token `--fill` ở tokens.css.
              className={`absolute bottom-0 left-0 w-full ${full ? 'bg-[var(--done)]' : 'bg-[var(--fill)]'}`}
              style={{ height: `${Math.max(pct * 100, pct > 0 ? 12 : 0)}%` }}
            />
          </span>
        )
      })}
    </span>
  )
}

export function LenhScreen({
  rows,
  stages,
  canRecord,
  initialView,
}: {
  rows: OverviewRow[]
  stages: { code: string; label: string }[]
  canRecord: boolean
  /** Khung nhìn mở sẵn khi tới từ một ô việc (?view=). */
  initialView?: string
}) {
  const [q, setQ] = useState('')
  const [view, setView] = useState(initialView ?? 'all')

  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.id, rows.filter(v.test).length])),
    [rows],
  )

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const test = VIEWS.find((v) => v.id === view)?.test ?? (() => true)
    return rows.filter((r) => {
      if (!test(r)) return false
      if (!kw) return true
      return `${r.lsx.code} ${r.lsx.customer_name} ${r.lsx.order_codes.join(' ')}`
        .toLowerCase()
        .includes(kw)
    })
  }, [rows, q, view])

  const totalSets = shown.reduce((a, r) => a + r.qty_needed, 0)
  const doneSets = shown.reduce((a, r) => a + r.qty_done, 0)

  return (
    /*
      BỀ RỘNG TỐI THIỂU: 9 cột, trong đó "Công đoạn" là dải 12 ô công đoạn —
      riêng nó đã ~200px (12 × 15px + khe). Mặc định 680px của `Table` chỉ vừa
      bảng 4–5 cột; để nguyên thì bảng không cuộn ngang mà BÓP cột, và "Vướng
      gì" — cột nói việc phải làm — là cột cắt chữ đầu tiên.
    */
    <ScreenFrame tableMin={1180}>
      <ScreenHeader
        eyebrow="Sản xuất"
        title="Lệnh sản xuất"
        facts={[
          { label: 'Đang chạy', value: fmt(rows.length) },
          {
            label: 'Trễ hạn xuất',
            value: fmt(counts.late ?? 0),
            onClick: () => setView('late'),
          },
          {
            label: 'Thiếu vật tư',
            value: fmt(counts.short ?? 0),
            onClick: () => setView('short'),
          },
          {
            label: 'Chưa định hình',
            value: fmt(counts.noshape ?? 0),
            onClick: () => setView('noshape'),
          },
        ]}
      />

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã lệnh, khách hàng, số đơn…"
          width={280}
        />
        {VIEWS.map((v) => (
          <Chip
            key={v.id}
            on={view === v.id}
            count={counts[v.id]}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Chip>
        ))}
      </FilterBar>

      {shown.length === 0 ? (
        <Empty
          headline="Không có lệnh nào ở khung nhìn này"
          reason={
            q.trim()
              ? `Không lệnh nào khớp “${q.trim()}”. Ô tìm soi mã lệnh, tên khách và số đơn.`
              : 'Khung nhìn đang lọc hẹp — con số trên chip là 0 nên bảng trống đúng, không phải hỏng.'
          }
          next={
            <Btn
              icon="boLoc"
              onClick={() => {
                setQ('')
                setView('all')
              }}
            >
              Xem tất cả lệnh
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Lệnh</th>
            <th>Khách hàng</th>
            <th>Hạn xuất</th>
            <th>Công đoạn</th>
            <th style={{ textAlign: 'right' }}>Bộ xong</th>
            <th>Dự kiến xong</th>
            <th>Ai đang giữ</th>
            <th>Vướng gì</th>
            <th />
          </THead>
          <tbody>
            {shown.map((r) => {
              const d = r.lsx.ship_date ? daysLeft(r.lsx.ship_date) : null
              const s = snag(r)
              return (
                <Row key={r.lsx.id}>
                  {/*
                    DÒNG MÃ ĐƠN PHẢI CHẶN BỀ RỘNG.

                    Đo 23/09/2026 ở 1366px: lệnh `01/26-27 - ROSCO` gộp 13 đơn,
                    nối bằng ` · ` trong một ô `white-space: nowrap` không có
                    `max-width` → cột "Lệnh" nở ra **1415px**, kéo cả bảng lên
                    **2647px** trong khung 1299px. Mọi dòng khác cũng rộng theo
                    vì cột dùng chung bề rộng, nên muốn đọc "Vướng gì" phải cuộn
                    ngang qua một cột gần như trống.

                    Đây là lỗi DỮ LIỆU THẬT làm vỡ bố cục, không phải thiếu bề
                    rộng tối thiểu — một dòng cá biệt định đoạt cả bảng.
                  */}
                  <Cell pin title={r.lsx.code} className="max-w-[240px]">
                    {/*
                      MÃ LỆNH LÀ ĐƯỜNG VÀO LỆNH.

                      Trước 23/09/2026 mã chỉ là chữ đậm, và đường vào DUY NHẤT
                      là nút "Mở" ở cột CUỐI — dòng không bấm được (đo:
                      `cursor: auto`, không `onClick`). Ở 1366px bảng rộng hơn
                      khung 174px nên chính cột đó rơi ngoài màn: người dùng
                      không có cách nào mở lệnh mà không mò ra thanh cuộn ngang.

                      Cột này `pin` nên luôn nhìn thấy dù cuộn tới đâu. `Code`
                      đi bằng `next/link` — `<a>` trần là tải lại cả tài liệu,
                      mất bộ lọc đang đặt.
                    */}
                    <Code
                      as="a"
                      href={`/thongke/lsx/${r.lsx.id}`}
                      className="text-k-body"
                    >
                      {r.lsx.code}
                    </Code>
                    {r.lsx.order_codes.length > 0 && (
                      <span
                        title={r.lsx.order_codes.join(' · ')}
                        className="text-k-sm mt-0.5 block truncate text-[var(--ink-3)]"
                      >
                        {r.lsx.order_codes.slice(0, 2).join(' · ')}
                        {r.lsx.order_codes.length > 2 &&
                          ` +${fmt(r.lsx.order_codes.length - 2)} đơn nữa`}
                      </span>
                    )}
                  </Cell>
                  <Cell grow title={r.lsx.customer_name}>
                    {r.lsx.customer_name}
                  </Cell>
                  <Cell>
                    {r.lsx.ship_date ? (
                      <>
                        <span className="num">{fmtDate(r.lsx.ship_date)}</span>
                        {d != null && (
                          <span
                            className={`text-k-sm ml-1 ${
                              d < 0
                                ? 'font-semibold text-[var(--stop)]'
                                : d <= 7
                                  ? 'font-semibold text-[var(--warn)]'
                                  : 'text-[var(--ink-3)]'
                            }`}
                          >
                            {d < 0
                              ? `trễ ${fmt(-d)}đ`
                              : d === 0
                                ? 'HÔM NAY'
                                : `còn ${fmt(d)}đ`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--ink-3)]">chưa có hạn</span>
                    )}
                  </Cell>
                  <Cell>
                    <StageStrip chips={r.chips} stages={stages} />
                  </Cell>
                  <Cell num>
                    {r.qty_needed > 0 ? (
                      <CoverageBar
                        ratio={r.qty_done / r.qty_needed}
                        label={`${Math.round((r.qty_done / r.qty_needed) * 100)}%`}
                      />
                    ) : (
                      <span className="text-[var(--ink-3)]">—</span>
                    )}
                  </Cell>
                  <Cell>
                    {r.forecast_date ? (
                      <span className="num">{fmtDate(r.forecast_date)}</span>
                    ) : (
                      // Không bịa ngày: chưa có nhịp ghi sổ thì không suy được.
                      <span className="text-[var(--ink-3)]">chưa đoán được</span>
                    )}
                  </Cell>
                  <Cell title={r.holder.what}>
                    {r.holder.who}
                    {r.holder.days != null && !r.holder.closed && (
                      <span
                        className={`text-k-sm ml-1 ${
                          isStale(r.holder)
                            ? 'font-semibold text-[var(--warn)]'
                            : 'text-[var(--ink-3)]'
                        }`}
                      >
                        {r.holder.days === 0 ? 'từ hôm nay' : `${r.holder.days}đ`}
                      </span>
                    )}
                  </Cell>
                  <Cell>
                    {/*
                      "KHÔNG VƯỚNG" chứ không phải "trôi" (đổi 23/09/2026 theo
                      chủ dự án). Cột hỏi "Vướng gì" thì ô phải TRẢ LỜI câu đó —
                      "trôi" là tiếng nghề tả cả lệnh đang chạy ngon, đọc trong
                      cột này thành nước đôi: người mới không rõ đang khen hay
                      đang báo lệnh bị trôi hạn.
                    */}
                    {s ? (
                      <Tag tone={s.tone}>{s.text}</Tag>
                    ) : (
                      <Tag tone="done">không vướng</Tag>
                    )}
                  </Cell>
                  <Cell>
                    <span className="flex justify-end gap-1">
                      {canRecord && r.component_count > 0 && (
                        <Btn icon="ghiSo" href={`/thongke/ghi?lsx=${r.lsx.id}`}>
                          Ghi sổ
                        </Btn>
                      )}
                      <Btn icon="mo" href={`/thongke/lsx/${r.lsx.id}`}>
                        Mở
                      </Btn>
                    </span>
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={<td>Cộng {fmt(shown.length)} lệnh</td>}
            /*
              CỘT CHÂN BẢNG PHẢI CỘNG ĐÚNG 9 — bằng `THead`.

              Bản cũ cộng ra 11 (nhãn 1 + 3 + 1 + 4 + caveat 2), và đúng như
              chú thích của `TFoot` cảnh báo, trình duyệt không ném lỗi nào:
              nó bóp ô caveat lại cho chữ xếp gần như DỌC, ô cao **313px** thay
              vì 36px. Mà ô đó `position: sticky; bottom: 0` — nên nó ĐÈ LÊN
              dòng 4 tới 14, đo 23/09/2026: hit-test ở y=420..620 đều trả về ô
              "Cộng 14 lệnh". Bảng 14 dòng nhìn ra chỉ có 3.

              Nay: 1 (nhãn) + 3 + 1 (ô %) + 4 (caveat) = 9.
            */
            cells={
              <>
                <td colSpan={3} />
                <td className="num" style={{ textAlign: 'right' }}>
                  {totalSets > 0 ? `${Math.round((doneSets / totalSets) * 100)}%` : '—'}
                </td>
              </>
            }
            caveatSpan={4}
            caveat="“Bộ xong” cộng theo Σ cần / Σ đã làm của mọi công đoạn — không phải số bộ đã đóng gói."
          />
        </Table>
      )}
    </ScreenFrame>
  )
}
