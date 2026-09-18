'use client'

import {
  Btn,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Metric,
  MetricStrip,
  Tag,
  Td,
  Th,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import { STALE_DAYS, isStale } from '@/lib/lsx-holder'
import type {
  OverviewRow,
  TeamWorkloadRow,
  TodayPulse,
} from '@/modules/dept/production/jobs.service'

/**
 * M1 — TÌNH HÌNH XƯỞNG (Khuôn A, trang vào việc).
 *
 * Trả lời: "hôm nay lệnh nào kẹt, ai phải gỡ?".
 *
 * BA LUẬT CỦA KHUÔN A áp ở đây:
 *
 *  1. **Ô việc là CỬA VÀO VIỆC, không phải chỉ số.** Mỗi ô dẫn thẳng sang màn
 *     Lệnh sản xuất ĐÃ LỌC sẵn đúng điều kiện nó vừa đếm (`?view=`). Bấm vào
 *     phải ra đúng chừng ấy dòng — đó là lời hứa của con số.
 *  2. **Số 0 không phải lúc nào cũng xấu.** "Trễ hạn: 0" là tin mừng; chỉ tô
 *     màu khi CÓ việc.
 *  3. **KHÔNG chép cả bảng lệnh xuống đây.** Chủ dự án đã chốt 05/09: tổng
 *     quan chỉ giữ KPI + vài dòng nổi bật + đường dẫn; gom mọi khối vào một
 *     trang là trang không trả lời câu hỏi nào cho ra hồn. Bảng đầy đủ nằm ở
 *     màn Lệnh sản xuất.
 *
 * KHÔNG dùng `ScreenFrame`: đây là trang vào việc, cuộn tự nhiên như mọi trang
 * dashboard. `ScreenFrame` dành cho màn có lưới phải cuộn BÊN TRONG để giữ
 * tiêu đề cột và chân tổng dính.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (iso: string) => iso.split('-').reverse().join('/')

export function TinhHinhScreen({
  rows,
  workload,
  pulse,
  canRecord,
}: {
  rows: OverviewRow[]
  workload: TeamWorkloadRow[]
  pulse: TodayPulse
  canRecord: boolean
}) {
  const late = rows.filter((r) => r.lsx.late === 'overdue')
  const short = rows.filter((r) => (r.materials?.missing_count ?? 0) > 0)
  const noshape = rows.filter((r) => r.component_count === 0)
  const stale = rows.filter((r) => isStale(r.holder))
  const bottleneck = workload.filter((w) => w.bottleneck_stages.length > 0)
  // Tổ ĐANG HOẠT ĐỘNG mà chưa chốt sổ. Tổ không có việc gì hôm nay thì không
  // nợ ai cái gì — đếm cả chúng là ô việc báo động giả mỗi sáng.
  const unlocked = workload.filter(
    (w) => !w.locked_today && (w.today_qty > 0 || w.todo + w.doing > 0),
  )

  /**
   * LỆNH CẦN CHÚ Ý — trễ hạn trước, rồi nằm im lâu nhất.
   *
   * Chỉ 5 dòng: đây là trang "hôm nay làm gì", không phải trang tra cứu. Ai
   * cần cả danh sách thì bấm đường dẫn ngay dưới.
   */
  const spotlight = [...rows]
    .sort((a, b) => {
      const la = a.lsx.late === 'overdue' ? 0 : 1
      const lb = b.lsx.late === 'overdue' ? 0 : 1
      if (la !== lb) return la - lb
      return (b.holder.days ?? 0) - (a.holder.days ?? 0)
    })
    .slice(0, 5)

  return (
    <div className="kit flex flex-col gap-4">
      <WorkTiles>
        <WorkTile
          label="Lệnh trễ hạn xuất"
          count={late.length}
          hint="Đã quá ngày xuất mà lệnh chưa đóng"
          href="/thongke/lenh?view=late"
          tone={late.length > 0 ? 'stop' : 'neutral'}
          strong
        />
        <WorkTile
          label={`Nằm im ≥${STALE_DAYS} ngày`}
          count={stale.length}
          hint="Bóng ở một phòng mà không ai động vào"
          href="/thongke/lenh?view=stale"
          tone={stale.length > 0 ? 'warn' : 'neutral'}
        />
        <WorkTile
          label="Thiếu vật tư"
          count={short.length}
          hint="Còn mã vật tư chưa về đủ theo định mức"
          href="/thongke/lenh?view=short"
          tone={short.length > 0 ? 'warn' : 'neutral'}
        />
        <WorkTile
          label="Chưa định hình"
          count={noshape.length}
          hint="Chưa có bảng chi tiết nên chưa ghi sổ được"
          href="/thongke/lenh?view=noshape"
          tone={noshape.length > 0 ? 'warn' : 'neutral'}
        />
        <WorkTile
          label="Tổ chưa chốt sổ"
          count={unlocked.length}
          hint="Tổ có việc hôm nay mà chưa chốt sổ ngày"
          href="/thongke/ngay"
          tone={unlocked.length > 0 ? 'warn' : 'neutral'}
        />
        <WorkTile
          label="Tổ đang nghẽn"
          count={bottleneck.length}
          hint="Tồn tại tổ vượt nhịp làm của chính tổ đó"
          href="/thongke/lenh"
          tone={bottleneck.length > 0 ? 'warn' : 'neutral'}
        />
      </WorkTiles>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Nhịp hôm nay · {fmtDate(pulse.date)}
          {/* Lăng kính TUẦN của cùng bộ số — rút khỏi nav 18/09, đứng ở đây vì
              đây là chỗ người ta nảy ra nhu cầu "thế cả tuần thì sao". */}
          <span className="ml-auto normal-case">
            <Btn href="/kehoach-sx/tuan">Xem theo tuần</Btn>
          </span>
        </h2>
        <MetricStrip>
          <Metric
            label="Sản lượng đạt"
            value={fmt(pulse.qty)}
            basis={
              pulse.target > 0 ? `/ ${fmt(pulse.target)} chỉ tiêu` : 'chưa có chỉ tiêu'
            }
            tone={
              pulse.target > 0 && pulse.qty < pulse.target * 0.8
                ? 'warn'
                : pulse.qty > 0
                  ? 'done'
                  : undefined
            }
          />
          <Metric
            label="Phế hôm nay"
            value={fmt(pulse.defect)}
            basis={pulse.qty > 0 ? `trên ${fmt(pulse.qty)} đạt` : 'chưa có sổ'}
            tone={pulse.defect > 0 ? 'warn' : undefined}
          />
          <Metric
            label="Tổ đã chốt sổ"
            value={fmt(pulse.teams_locked)}
            basis={`/ ${fmt(pulse.teams_active)} tổ có việc`}
            tone={
              pulse.teams_active > 0 && pulse.teams_locked < pulse.teams_active
                ? 'warn'
                : undefined
            }
          />
          <Metric
            label="Khối lượng"
            value={pulse.kg > 0 ? fmt(pulse.kg) : null}
            basis="kg ghi trong sổ hôm nay"
          />
        </MetricStrip>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Tổ hôm nay
          {/* Bảng này chỉ nói HÔM NAY. Luỹ kế theo tổ (cần/đạt/%/dự kiến xong)
              là câu hỏi khác, nằm ở màn riêng. */}
          <span className="ml-auto normal-case">
            <Btn href="/kehoach-sx/theo-to">Tiến độ luỹ kế theo tổ</Btn>
          </span>
        </h2>
        <Grid minWidth={760}>
          <GridHead>
            <Th width={170}>Tổ</Th>
            <Th num>Chỉ tiêu</Th>
            <Th num>Đạt</Th>
            <Th num>Phế</Th>
            <Th num>Tồn tại tổ</Th>
            <Th num>Việc đang làm</Th>
            <Th>Tình trạng</Th>
          </GridHead>
          <GridBody>
            {workload.map((w) => (
              <GridRow key={w.department_id}>
                <Td>{w.department_name}</Td>
                <Td num>{w.today_target > 0 ? fmt(w.today_target) : ''}</Td>
                <Td
                  num
                  tone={
                    w.today_target > 0 && w.today_qty < w.today_target
                      ? 'warn'
                      : undefined
                  }
                >
                  {fmt(w.today_qty)}
                </Td>
                <Td num tone={w.today_defect > 0 ? 'warn' : undefined}>
                  {w.today_defect > 0 ? fmt(w.today_defect) : ''}
                </Td>
                <Td num>{w.wip > 0 ? fmt(w.wip) : ''}</Td>
                <Td num>{fmt(w.todo + w.doing)}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {w.bottleneck_stages.map((s) => (
                      <Tag key={s} tone="warn">
                        nghẽn {s}
                      </Tag>
                    ))}
                    {w.locked_today && <Tag tone="done">đã chốt sổ</Tag>}
                  </span>
                </Td>
              </GridRow>
            ))}
          </GridBody>
        </Grid>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
          Lệnh cần chú ý
          <span className="ml-auto normal-case">
            <Btn href="/thongke/lenh">Xem tất cả {fmt(rows.length)} lệnh</Btn>
          </span>
        </h2>
        <Grid minWidth={700}>
          <GridHead>
            <Th width={150}>Lệnh</Th>
            <Th>Khách hàng</Th>
            <Th>Hạn xuất</Th>
            <Th>Ai đang giữ</Th>
            <Th />
          </GridHead>
          <GridBody>
            {spotlight.map((r) => (
              <GridRow key={r.lsx.id}>
                <Td>
                  <b className="num">{r.lsx.code}</b>
                </Td>
                <Td>{r.lsx.customer_name}</Td>
                <Td num tone={r.lsx.late === 'overdue' ? 'stop' : undefined}>
                  {r.lsx.ship_date ? fmtDate(r.lsx.ship_date) : '—'}
                </Td>
                <Td tone={isStale(r.holder) ? 'warn' : undefined}>
                  {r.holder.who}
                  {r.holder.days != null && !r.holder.closed && ` · ${r.holder.days}đ`}
                </Td>
                <Td>
                  <span className="flex justify-end gap-1">
                    {canRecord && r.component_count > 0 && (
                      <Btn href={`/thongke/ghi?lsx=${r.lsx.id}`}>Ghi sổ</Btn>
                    )}
                    <Btn href={`/thongke/lsx/${r.lsx.id}`}>Mở</Btn>
                  </span>
                </Td>
              </GridRow>
            ))}
          </GridBody>
        </Grid>
      </section>
    </div>
  )
}
