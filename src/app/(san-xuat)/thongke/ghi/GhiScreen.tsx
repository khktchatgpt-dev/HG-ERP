'use client'

import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { dmy, fmt } from './ghi.shared'
import { LuoiGhi } from './luoi-ghi'
import { useGhi, type GhiProps } from './useGhi'

/**
 * GHI SẢN LƯỢNG — màn S4 của bản vẽ 03/11/2026
 * (https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci), B3 của
 * docs/san-xuat-cau-hinh-thiet-ke.md. KHÔNG kit — khung `_erp` của Sản xuất.
 *
 * Thống kê tổ — "hôm nay tổ tôi làm được bao nhiêu?". Lưới là nhân vật chính;
 * đầu phiếu co thành MỘT dải chip (ngày · lệnh · công đoạn · tổ · đếm bằng);
 * cột lõi + ô riêng + mã lỗi đổi theo CẤU HÌNH công đoạn (C1, 0287) chứ không
 * theo mã; thanh chốt đáy nói đúng dòng nào thiếu gì và bấm được tới ô —
 * ngoại lệ duy nhất cho thanh đáy (khuôn nhập liệu).
 *
 * MỘT LỆNH MỘT LƯỢT (22/09): không gộp nhiều lệnh vào một lưới (208 dòng / 8
 * lệnh ở Phôi, bị chê rối) — nhưng cũng không có màn "chọn lệnh" chặn trước
 * (bị chê 21/09): đổi lệnh ngay ở chip.
 */
export function GhiScreen(p: GhiProps) {
  const d = useGhi(p)
  const { sheet } = d
  const can = sheet.can_record
  const go = d.goBlocked()
  const core = sheet.stage_cfg.core
  const goiY = sheet.suggested.filter((s) => s.team_id === d.teamId).length

  return (
    <SxKhung bare label="Ghi sản lượng">
      <div
        className="sx-body"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            void d.save(true)
          }
        }}
      >
        <DauTrang
          crumb="Ghi sổ"
          title="Ghi sản lượng"
          ctx={
            sheet.lsx ? (
              <>
                <b>{sheet.lsx.code}</b> · {sheet.lsx.customer_name}
                {sheet.lsx.ship_date && <> · xuất {dmy(sheet.lsx.ship_date)}</>}
              </>
            ) : (
              'mọi lệnh đang chạy'
            )
          }
          actions={
            <>
              <ApNhom>
                <ApNut onClick={() => d.setChiGoiY(!d.chiGoiY)}>
                  {d.chiGoiY ? 'Mọi dòng' : 'Dòng gợi ý'} <b className="num">{goiY}</b>
                </ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut onClick={d.toggleMore}>
                  {d.more ? 'Ẩn cột chi tiết' : 'Cột chi tiết'}
                </ApNut>
                <ApNut
                  onClick={() => d.save(false)}
                  why={d.blocked ? 'chưa có gì để lưu' : null}
                  busy={d.busy}
                >
                  Lưu nháp
                </ApNut>
              </ApNhom>
            </>
          }
        />

        {/* DẢI CHIP ĐẦU PHIẾU — một hàng, mỗi hàng đầu trang thừa là một hàng lưới mất */}
        <div className="sx-hc">
          <label className="c">
            Ngày
            <input
              type="date"
              value={d.date}
              max={sheet.today}
              onChange={(e) => d.setDate(e.target.value)}
              aria-label="Ngày ghi sổ"
            />
          </label>
          <label className="c">
            Lệnh
            <select
              value={sheet.lsx?.id ?? ''}
              onChange={(e) => d.doiLenh(e.target.value)}
              aria-label="Lệnh sản xuất"
            >
              {d.lsxOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code}
                  {o.open_count > 0 ? ` · còn ${o.open_count} việc` : ' · đủ số'}
                </option>
              ))}
            </select>
          </label>
          <span className="c on">
            Công đoạn <b>{sheet.stage_label}</b>
          </span>
          <label className="c" htmlFor="sheet-team">
            Tổ
            <select
              id="sheet-team"
              value={d.teamId}
              onChange={(e) => d.setTeamId(e.target.value)}
              aria-label="Tổ"
              className={!d.teamId ? 'warn' : undefined}
            >
              <option value="">
                {sheet.teams.length ? '— chọn tổ —' : 'chưa có tổ nào'}
              </option>
              {sheet.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {d.lockedTeamIds.has(t.id) ? '🔒 ' : ''}
                  {t.name}
                  {t.stage_code === sheet.stage ? ' ★' : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="c">
            Đếm bằng <b>{COUNT_LEVEL_LABEL[sheet.stage_cfg.count_level]}</b>
          </span>
          <span className="sp mut">
            {d.lockedNow
              ? `Sổ ${d.teamName} ${dmy(d.date)} đã chốt`
              : d.teamName
                ? `Sổ ${d.teamName} ${dmy(d.date)} chưa chốt`
                : ''}
          </span>
        </div>

        <TabNgang
          label="Công đoạn"
          tabs={sheet.stages.map((s) => ({
            key: s.code,
            label: s.label,
            n: s.n,
            on: s.code === sheet.stage,
            onClick: () => d.doiCongDoan(s.code),
          }))}
        />

        {d.saved && !d.draftHidden && d.typed.length === 0 && (
          <div className="sx-note">
            <b>Bản gõ dở</b> Lần trước bạn gõ dở {fmt(Object.keys(d.saved.lines).length)}{' '}
            dòng ở đây (
            {new Date(d.saved.at).toLocaleString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
            ) mà chưa ghi sổ — khôi phục sẽ đặt lại cả ngày và tổ của lúc đó.
            <button type="button" className="lnk" onClick={d.khoiPhuc}>
              Khôi phục
            </button>
            <button type="button" className="lnk mut" onClick={d.boNhap}>
              Bỏ
            </button>
          </div>
        )}
        {d.lockedNow && (
          <div className="sx-note stop">
            <b>Sổ đã chốt</b> Sổ ngày {dmy(d.date)} của tổ này đã chốt
            {d.lockedBy ? ` — ${d.lockedBy} chốt` : ''}. Gõ thêm sẽ không lưu được.
            <a className="lnk" href={`/thongke/ngay?date=${d.date}`}>
              Mở khoá ở Sổ ngày
            </a>
            hoặc đổi tổ / ngày.
          </div>
        )}
        {d.dateFuture && (
          <div className="sx-note stop">
            <b>Ngày chưa tới</b> {dmy(d.date)} chưa tới nên không ghi sổ được.
            <button type="button" className="lnk" onClick={() => d.setDate(sheet.today)}>
              Về hôm nay
            </button>
          </div>
        )}
        {d.datePast && !d.dateFuture && (
          <div className="sx-note">
            <b>Ghi lùi ngày</b> Phiếu sẽ mang ngày {dmy(d.date)}. Sổ cộng dồn — ngày đó đã
            ghi rồi thì gõ thêm là cộng vào, không thay thế.
          </div>
        )}
        {sheet.truncated > 0 && (
          <div className="sx-note">
            <b>Chưa bày hết</b> Còn {fmt(sheet.truncated)} dòng của lệnh này chưa hiện —
            lưới bày tối đa 200 dòng một lượt. Ghi xong phần đang thấy rồi tải lại để gõ
            tiếp.
          </div>
        )}
        {d.warnings.length > 0 && (
          <div className="sx-note">
            <b>Đã ghi, nhưng đọc cái này</b> {d.warnings.join(' · ')}
            <button type="button" className="lnk" onClick={() => d.setWarnings([])}>
              Đã xem
            </button>
          </div>
        )}
        {d.loi && <div className="sx-err">{d.loi}</div>}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            {d.thongBao}
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}

        <LuoiGhi d={d} />

        {/* THANH CHỐT — ngoại lệ thanh đáy của khuôn nhập liệu */}
        <div className="sx-cb">
          <span className="sum">
            Sắp ghi <b>{d.typed.length}</b> dòng · <b>{fmt(d.typedQty)}</b> đạt
            {core.defect !== 'off' && (
              <>
                {' '}
                · <b>{fmt(d.typedDefect)}</b> phế
              </>
            )}
            {core.rework !== 'off' && (
              <>
                {' '}
                · <b>{fmt(d.typedRework)}</b> sửa lại
              </>
            )}
            {d.teamName && <> · {d.teamName}</>}
          </span>
          {d.blocked ? (
            <span className="blk">
              Chưa ghi được: {d.blocked}
              {go && (
                <button type="button" className="lnk" onClick={go.run}>
                  {go.label}
                </button>
              )}
            </span>
          ) : (
            <span className="mut">Ctrl+Enter ghi sổ</span>
          )}
          <span className="sp">
            <input
              className="sx-in"
              value={d.docNote}
              onChange={(e) => d.setDocNote(e.target.value)}
              placeholder="ghi chú chung cả phiếu"
              aria-label="Ghi chú phiếu"
              disabled={!can}
              style={{ width: 240 }}
            />
            <button
              type="button"
              className="sx-btn"
              onClick={d.huy}
              disabled={d.typed.length === 0 || d.busy}
            >
              Huỷ
            </button>
            {/* User chốt 27/08: không cần tổ trưởng xác nhận — gửi là chính thức. */}
            <button
              type="button"
              className="sx-btn p"
              onClick={() => d.save(true)}
              disabled={!!d.blocked || d.busy}
              aria-busy={d.busy || undefined}
            >
              {d.busy ? 'Đang ghi…' : 'Ghi sổ chính thức'}
            </button>
          </span>
        </div>

        <ThanhTT left="Enter ↓ · Ctrl+V dán từ Excel · bấm số ở cột Còn để điền đủ" />
      </div>
    </SxKhung>
  )
}
