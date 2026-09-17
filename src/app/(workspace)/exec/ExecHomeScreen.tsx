import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Factory,
  FileText,
  Hourglass,
  Send,
  ShoppingCart,
  Stamp,
  Warehouse,
} from 'lucide-react'
import {
  Btn,
  Cell,
  NoticeBar,
  Row,
  ScreenHeader,
  StatusBar,
  Table,
  Tag,
  THead,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import type { ExecDashboard } from '@/modules/core/exec/exec.service'

/**
 * TỔNG QUAN (/exec) — màn mở đầu của Giám đốc.
 *
 * Ba khối, đúng thứ tự Giám đốc cần trả lời khi mở máy:
 *   1. CHỜ TÔI PHÊ DUYỆT — hôm nay tôi phải ký gì?
 *   2. TÌNH HÌNH HOẠT ĐỘNG — công ty đang chạy thế nào? (chỉ đọc)
 *   3. CẦN CHÚ Ý — có gì đang trục trặc? (ngoại lệ đứng trước số đẹp)
 *
 * CHUYỂN SANG KIT 17/09/2026 — chuyển HỆ, không thiết kế lại. Cả năm khối giữ
 * nguyên thứ tự, nguyên nội dung, nguyên đường dẫn. Đổi ba thứ:
 *
 *  · thẻ bo tròn có lề → khối PHẲNG ngăn bằng một vạch mảnh (luật kit: không
 *    thẻ nổi — SAP GUI và Dynamics đều bày như vậy);
 *  · `PageHeader` ba tầng (nhãn / tiêu đề / dữ kiện) → `ScreenHeader compact`
 *    một hàng, trả lại ~60px cho phần nội dung;
 *  · icon theo bản đồ đã chốt ở `/design-lab`.
 *
 * Server component, chỉ đọc. Mọi ô đều dẫn về màn xử lý tương ứng.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Tiền theo nhiều tiền tệ — USD và VND không bao giờ cộng chung. */
function money(rows: { currency: string; value: number }[]): string {
  return rows.map((r) => `${fmt(r.value)} ${r.currency}`).join(' · ')
}

/**
 * Câu phụ dưới con số của ô phê duyệt.
 *
 * `WorkTile` bắt buộc `hint` — nó là chỗ nói con số ĐẾM CÁI GÌ, để người dùng
 * kiểm được lời hứa. Ở đây thêm tuổi phiếu lâu nhất: "15 phiếu" và "15 phiếu,
 * cái lâu nhất 15 ngày" là hai tình huống khác hẳn nhau.
 */
function pendingHint(
  count: number,
  oldestDays: number | null,
  value?: { currency: string; value: number }[],
): string {
  if (count === 0) return 'không có phiếu chờ chữ ký'
  const parts = [`${count} phiếu chờ ký`]
  if (oldestDays != null) parts.push(`lâu nhất ${oldestDays} ngày`)
  if (value && value.length > 0) parts.push(money(value))
  return parts.join(' · ')
}

/** Một dòng cảnh báo trong khối "Cần chú ý". */
function IssueRow({
  icon: Icon,
  tone,
  count,
  label,
  samples,
  href,
}: {
  icon: typeof AlertTriangle
  tone: 'stop' | 'warn'
  count: number
  label: string
  samples: string[]
  href: string
}) {
  const color = tone === 'stop' ? 'var(--stop)' : 'var(--warn)'
  return (
    <Row>
      <Cell>
        <Link href={href} className="flex min-w-0 items-center gap-[9px]">
          <Icon className="size-[14px] shrink-0" style={{ color }} aria-hidden />
          <b className="num w-[28px] text-right text-[15px]" style={{ color }}>
            {count}
          </b>
          <span className="shrink-0">{label}</span>
          {samples.length > 0 && (
            <span className="num truncate text-[var(--fs-micro)] text-[var(--ink-3)]">
              {samples.join(' · ')}
            </span>
          )}
        </Link>
      </Cell>
    </Row>
  )
}

export function ExecHomeScreen({
  data,
  userName,
}: {
  data: ExecDashboard
  userName: string
}) {
  const { todo, issues, sales, supply, production, gaps } = data
  const pendingTotal = todo.lsx_pending + todo.po_pending + todo.quote_pending
  const oldest = Math.max(
    todo.lsx_oldest_days ?? 0,
    todo.po_oldest_days ?? 0,
    todo.quote_oldest_days ?? 0,
  )
  const issueCount =
    issues.overdue_orders.length +
    issues.late_pos.length +
    issues.stuck_pos.length +
    issues.low_stock.length
  /* "0 phiếu chờ" có hai nghĩa trái ngược: đã duyệt hết ↔ chưa ai từng lập
     phiếu. by_status đếm MỌI trạng thái nên phân biệt được hai chuyện đó. */
  const poEverExists = supply.by_status.length > 0
  const lsxEverExists = production.by_status.length > 0

  return (
    <div className="flex flex-col">
      <ScreenHeader
        compact
        eyebrow="Ban Giám đốc"
        title={`Xin chào, ${userName}`}
        facts={[
          {
            label: 'Chờ chữ ký',
            value: String(pendingTotal),
            tone: pendingTotal > 0 ? 'warn' : undefined,
          },
          ...(pendingTotal > 0 && oldest > 0
            ? [
                {
                  label: 'Lâu nhất',
                  value: `${oldest} ngày`,
                  tone: oldest >= 7 ? ('stop' as const) : ('warn' as const),
                },
              ]
            : []),
          { label: 'Cần chú ý', value: String(issueCount), tone: issueCount > 0 ? 'warn' : undefined }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn href="/exec/approvals/history">
              <FileText className="size-4" aria-hidden />
              Lịch sử ký
            </Btn>
            {pendingTotal > 0 && (
              <Btn primary href="/exec/approvals">
                <Stamp className="size-4" aria-hidden />
                Duyệt ngay ({pendingTotal})
              </Btn>
            )}
          </>
        }
      />

      {/* ── 1. Chờ tôi phê duyệt ─────────────────────────────────────────── */}
      <Section icon={Stamp} title="Chờ tôi phê duyệt" />
      <div className="px-[var(--gutter)] py-[9px]">
        <WorkTiles>
          <WorkTile
            href="/exec/approvals?loai=lsx"
            label="Lệnh sản xuất"
            count={todo.lsx_pending}
            hint={pendingHint(todo.lsx_pending, todo.lsx_oldest_days)}
            tone="warn"
          />
          <WorkTile
            href="/exec/approvals?loai=po"
            label="Đơn mua vật tư"
            count={todo.po_pending}
            hint={pendingHint(
              todo.po_pending,
              todo.po_oldest_days,
              todo.po_pending_value,
            )}
            tone="warn"
            /* Ô của chính người đang xem, và là chỗ phiếu dồn về nhiều nhất. */
            strong={todo.po_pending > 0}
          />
          <WorkTile
            href="/exec/approvals?loai=quote"
            label="Báo giá"
            count={todo.quote_pending}
            hint={pendingHint(todo.quote_pending, todo.quote_oldest_days)}
            tone="warn"
          />
        </WorkTiles>
        {/*
          0 PHIẾU CHỜ CÓ HAI NGHĨA TRÁI NGƯỢC — nói rõ đang là nghĩa nào. Giám
          đốc đọc "không có phiếu chờ" thành "đã ký hết", trong khi sự thật có
          thể là chưa ai từng lập phiếu trên hệ thống.
        */}
        {pendingTotal === 0 && !(poEverExists && lsxEverExists) && (
          <p className="mt-2 text-[var(--fs-sm)] text-[var(--ink-3)]">
            {!lsxEverExists && !poEverExists
              ? 'Hệ thống chưa từng có phiếu nào được lập — không phải bạn đã ký hết.'
              : !poEverExists
                ? 'Riêng đơn mua thì chưa có đơn nào trên hệ thống — phòng Cung ứng còn làm ngoài Excel.'
                : 'Chưa có lệnh sản xuất nào trên hệ thống.'}
          </p>
        )}
      </div>

      {/* ── 2. Tình hình hoạt động ───────────────────────────────────────── */}
      <Section title="Tình hình hoạt động" />
      <div className="px-[var(--gutter)] py-[9px]">
        <WorkTiles>
          <WorkTile
            href="/exec/orders"
            label="Đơn hàng đang thực hiện"
            count={sales.open_orders}
            hint={
              sales.open_value.length > 0
                ? money(sales.open_value)
                : 'chưa có dòng nào điền đơn giá'
            }
          />
          <WorkTile
            href="/exec/production"
            label="Lệnh sản xuất đang chạy"
            count={production.running}
            hint="lệnh chưa đóng, tính cả lệnh mới phát"
          />
          <WorkTile
            href="/exec/purchasing"
            label="Đơn mua đang xử lý"
            count={supply.open_pos}
            hint={
              supply.open_value.length > 0
                ? money(supply.open_value)
                : 'đơn đã gửi NCC, chưa về đủ'
            }
          />
          <WorkTile
            /* Khu Kho tạm gỡ 16/09/2026 — trỏ sang màn tồn của Cung ứng, vẫn
               sống và đọc cùng một nguồn số. */
            href="/planning/stock"
            label="Vật tư dưới tồn tối thiểu"
            count={issues.low_stock.length}
            hint="so với mức tối thiểu khai ở danh mục"
            tone="warn"
          />
        </WorkTiles>
      </div>

      {/* ── 3. Cần chú ý ─────────────────────────────────────────────────── */}
      <Section icon={AlertTriangle} title="Cần chú ý" />
      {issueCount === 0 ? (
        <p className="px-[var(--gutter)] py-[10px] text-[var(--fs-sm)] text-[var(--ink-3)]">
          Không có cảnh báo nào — đơn hàng đúng hạn, hàng mua về đúng hẹn, tồn kho trên
          mức tối thiểu.
        </p>
      ) : (
        <Table>
          <tbody>
            {issues.overdue_orders.length > 0 && (
              <IssueRow
                icon={AlertTriangle}
                tone="stop"
                count={issues.overdue_orders.length}
                label="đơn hàng trễ hạn giao"
                samples={issues.overdue_orders
                  .slice(0, 3)
                  .map((o) => `${o.code} (${o.days_late}n)`)}
                href="/exec/orders"
              />
            )}
            {issues.late_pos.length > 0 && (
              <IssueRow
                icon={AlertTriangle}
                tone="stop"
                count={issues.late_pos.length}
                label="đơn mua quá hẹn giao của NCC"
                samples={issues.late_pos
                  .slice(0, 3)
                  .map((p) => `${p.code} (${p.days_late}n)`)}
                href="/exec/purchasing"
              />
            )}
            {issues.stuck_pos.length > 0 && (
              <IssueRow
                icon={Send}
                tone="warn"
                count={issues.stuck_pos.length}
                label="đơn đã duyệt nhưng chưa gửi NCC"
                samples={issues.stuck_pos
                  .slice(0, 3)
                  .map((p) => `${p.code} (${p.days_idle}n)`)}
                href="/exec/purchasing"
              />
            )}
            {issues.low_stock.length > 0 && (
              <IssueRow
                icon={Warehouse}
                tone="warn"
                count={issues.low_stock.length}
                label="vật tư dưới mức tồn tối thiểu"
                samples={issues.low_stock.slice(0, 3).map((m) => m.code)}
                href="/planning/stock"
              />
            )}
          </tbody>
        </Table>
      )}

      {/* ── 4. Sắp tới hạn giao — GĐ cần thấy trước khi khách gọi ────────── */}
      {sales.due_soon.length > 0 && (
        <>
          <Section icon={Hourglass} title="Sắp tới hạn giao (≤ 7 ngày)" />
          <Table>
            <THead>
              <th style={{ width: 140 }}>Đơn hàng</th>
              <th>Khách</th>
              <th style={{ width: 110 }}>Còn lại</th>
            </THead>
            <tbody>
              {sales.due_soon.slice(0, 6).map((o) => (
                <Row key={o.id}>
                  <Cell>
                    <Link
                      href="/exec/orders"
                      className="num font-semibold text-[var(--act)]"
                    >
                      {o.code}
                    </Link>
                  </Cell>
                  <Cell>{o.customer_name}</Cell>
                  <Cell>
                    <Tag tone={o.days_left <= 2 ? 'stop' : 'warn'}>
                      <Clock className="size-[13px]" aria-hidden />
                      {o.days_left === 0 ? 'hôm nay' : `còn ${o.days_left}n`}
                    </Tag>
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {/* ── 5. Nói thẳng vì sao số tiền đang thiếu ───────────────────────── */}
      {gaps.order_lines_without_price > 0 && (
        <NoticeBar
          tone="warn"
          tag="Số liệu thiếu"
          action={{ label: 'Mở màn điền đơn giá' }}
        >
          <b>
            {fmt(gaps.order_lines_without_price)}/{fmt(gaps.order_lines_total)} dòng đơn
            hàng chưa có đơn giá
          </b>{' '}
          — mọi con số tiền ở trên đang tính thiếu. Cần phòng Bán hàng nhập giá cho các
          đơn đang mở.
        </NoticeBar>
      )}

      <StatusBar
        left={[
          pendingTotal > 0 ? `${pendingTotal} phiếu chờ chữ ký` : 'Không còn phiếu chờ',
          issueCount > 0 ? `${issueCount} cảnh báo` : 'Không có cảnh báo',
        ]}
      />
    </div>
  )
}

/**
 * Dải tên khối — thay cho `<h2>` chữ nhỏ của bản cũ.
 *
 * Nền xám nhạt + một vạch trên: đủ để mắt chia màn thành từng phần mà không
 * cần thẻ nổi, đúng luật "khối ngăn nhau bằng một vạch mảnh".
 */
function Section({ icon: Icon, title }: { icon?: typeof Stamp; title: string }) {
  return (
    <div className="flex h-[26px] items-center gap-[6px] border-t border-b border-t-[var(--line)] border-b-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] font-bold tracking-[.08em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
      {Icon && <Icon className="size-[14px]" aria-hidden />}
      {title}
    </div>
  )
}
