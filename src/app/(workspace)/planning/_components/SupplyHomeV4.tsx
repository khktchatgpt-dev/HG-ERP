import { Btn, ScreenFrame, WorkTile, WorkTiles } from '@/components/kit'
import type { SupplyWork } from '../_data/supply-work'

/**
 * TỔNG QUAN CUNG ỨNG — bản kit v4.
 *
 * LỖI GỐC CỦA BẢN CŨ: trang trả lời "hôm nay PHÒNG có vấn đề gì" nhưng không
 * trả lời "hôm nay TÔI phải làm gì". Bốn ô KPI đều nói về LỆNH SẢN XUẤT
 * (nguy cơ dừng SX, thiếu/chưa mua, đang về, đủ vật tư) — góc nhìn của người
 * điều hành, không phải của người mua hàng ngồi đó tám tiếng.
 *
 * Hệ quả đo được 09/09/2026: ô "Nguy cơ dừng SX" hiện **0** — trông như mọi
 * thứ đều ổn. Trong khi thực tế:
 *     64 đơn nằm im ≥3 ngày
 *     59 đơn chưa có hẹn giao
 *      2 đơn nằm trên bàn Giám đốc
 * Không con số nào trong ba cái đó xuất hiện trên trang chủ.
 *
 * Bản v4 chia HAI TẦNG rõ rệt:
 *   Tầng 1 — VIỆC CỦA TÔI / CỦA PHÒNG: mỗi ô là một cửa vào danh sách đã lọc
 *   Tầng 2 — ẢNH HƯỞNG SẢN XUẤT: giữ nguyên góc nhìn cũ, vẫn cần cho họp
 *
 * Thứ tự đó có chủ ý: người mua mở app lên để LÀM VIỆC, không phải để đọc báo
 * cáo. Báo cáo là thứ họ xem khi có ai hỏi.
 */
export function SupplyHomeV4({
  work,
  today,
  issues,
  activeLsx,
}: {
  work: SupplyWork
  /** Ngày đã định dạng sẵn ở server — không đọc đồng hồ trong render. */
  today: string
  /** Vấn đề ảnh hưởng sản xuất — tầng 2. */
  issues: { code: string; why: string; owner: string; next: string }[]
  activeLsx: number
}) {
  const toiCoViec = work.myDrafts > 0

  return (
    <ScreenFrame>
      <div className="kit-v4 flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[var(--fs-micro)] font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
                Cung ứng
              </div>
              <h1 className="mt-[3px] text-[var(--fs-title)] font-semibold tracking-[-.015em]">
                Việc hôm nay
              </h1>
              <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
                {today} · <b className="num text-[var(--ink)]">{activeLsx}</b> lệnh sản
                xuất đang chạy
              </p>
            </div>
            <Btn primary href="/planning/pos/new">
              + Soạn đơn mua
            </Btn>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-[var(--gutter)] py-4">
          <section>
            <h2 className="mb-2 text-[var(--fs-micro)] font-semibold tracking-[.08em] text-[var(--ink-3)] uppercase">
              Đơn đặt hàng đang chờ ai đó
            </h2>
            <WorkTiles>
              {/* Ô của CHÍNH người xem đứng đầu và nổi hơn — đây là thứ họ mở
                  app lên để tìm. */}
              {/*
                "Nháp của tôi", KHÔNG cắt tên người dùng.

                Đo 09/09/2026: `meName.split(' ').slice(-1)` với "Quản trị
                viên" ra nhãn "Nháp của viên" — vô nghĩa. Tên tiếng Việt lấy
                chữ cuối là TÊN GỌI với người thường ("Đặng Thị Thanh Nga" ->
                "Nga") nhưng hỏng với tên chức danh. Đằng nào người đang xem
                cũng biết mình là ai, nên "của tôi" vừa đúng vừa ngắn.
              */}
              <WorkTile
                label="Nháp của tôi"
                count={work.myDrafts}
                hint="đơn bạn phụ trách, chưa gửi duyệt"
                href="/planning/pos?v4=1"
                tone="warn"
                strong={toiCoViec}
              />
              <WorkTile
                label="Chờ Giám đốc ký"
                count={work.awaitingApproval}
                hint="đã gửi, đang nằm trên bàn GĐ"
                href="/planning/pos?v4=1"
                tone="warn"
              />
              <WorkTile
                label="Duyệt rồi, chưa gửi NCC"
                count={work.approvedNotSent}
                hint="kẹt ở bàn Cung ứng — gửi ngay được"
                href="/planning/pos?v4=1"
                tone="stop"
              />
              {/*
                Ô này CHỒNG LẤN với hai ô trước — cùng một đơn có thể vừa
                "chờ GĐ ký" vừa "nằm im 5 ngày". Đó KHÔNG phải lỗi: hai ô trả
                lời hai câu hỏi khác nhau (đang ở đâu / đã lâu chưa), và người
                dùng cần cả hai.

                Nhưng phải NÓI RA, vì cộng dọc các ô mà ra số lớn hơn tổng đơn
                thì người ta nghi cả trang. Câu chú thích chính là chỗ nói.
              */}
              <WorkTile
                label="Nằm im ≥ 3 ngày"
                count={work.stale}
                hint="tính cả các ô bên trái — người giữ có lẽ chưa biết"
                href="/planning/pos?v4=1"
                tone="stop"
              />
              <WorkTile
                label="Chưa hẹn ngày giao"
                count={work.noEta}
                hint="không biết chờ tới bao giờ"
                href="/planning/pos?v4=1"
                tone="warn"
              />
              <WorkTile
                label="Hàng sắp về"
                count={work.incomingSoon}
                hint="đến hẹn giao trong 7 ngày tới"
                href="/planning/hang-sap-ve"
                tone="done"
              />
            </WorkTiles>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[var(--fs-micro)] font-semibold tracking-[.08em] text-[var(--ink-3)] uppercase">
                Ảnh hưởng sản xuất
              </h2>
              <a
                href="/planning/van-de"
                className="text-[var(--fs-sm)] text-[var(--act)] hover:underline"
              >
                Xem tất cả {issues.length} vấn đề
              </a>
            </div>
            {issues.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] px-3 py-4 text-[12.5px] text-[var(--ink-2)]">
                Không lệnh nào đang bị vật tư chặn. Việc còn lại nằm ở các ô phía trên.
              </p>
            ) : (
              <ol className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
                {issues.slice(0, 5).map((it, i) => (
                  <li
                    key={it.code}
                    className={`flex items-baseline gap-3 px-3 py-[9px] text-[12.5px] ${
                      i > 0 ? 'border-t border-[var(--hair)]' : ''
                    }`}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] font-semibold text-[var(--act)]">
                      {it.code}
                    </span>
                    <span className="min-w-0 flex-1 text-[var(--ink-2)]">{it.why}</span>
                    {/* AI PHẢI LÀM GÌ — không phải chỉ nêu vấn đề rồi thôi. */}
                    <span className="shrink-0 text-[11px] text-[var(--ink-3)]">
                      {it.owner}: {it.next}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </ScreenFrame>
  )
}
