'use client'

import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { fmt, type DinhHinhProps } from './dinh-hinh.shared'
import { LuoiChiTiet } from './luoi-chi-tiet'
import { useDinhHinh } from './useDinhHinh'

/**
 * BẢNG CHI TIẾT CỦA LỆNH — dựng lại không kit theo bản vẽ duyệt 03/11/2026
 * (https://claude.ai/artifact/DUtMtTWekhhBUUzh54XM9L). Khuôn F: lưới là nhân
 * vật chính; một nút Lưu ghi đè trọn bộ; thanh chốt đáy nói đúng dòng nào hỏng
 * và bấm tới. 04/11/2026: tab Lộ trình theo cụm RỜI sang màn gộp
 * `/thongke/lo-trinh?lsx=` (việc của Kế hoạch) — màn này là của thống kê, chỉ
 * còn lưới chi tiết (định mức Kỹ thuật chụp sang lệnh, tự nạp lúc duyệt).
 *
 * Khoá khi lệnh đã có phiếu sản lượng: ô không gõ, không thêm / xoá dòng, thanh
 * chốt ẩn, nút Lưu nói cách gỡ. Định hình lại khi đã có số = xoá phiếu trước,
 * cố ý không đi tắt.
 */
export function DinhHinhScreen(props: DinhHinhProps) {
  const d = useDinhHinh(props)
  const { p, editable } = d
  // Đếm theo MÃ HÀNG, không theo dòng lệnh (bản vẽ 15/11 SNZSog1E… Q3): LAURA 26 mã
  // từng bày thành danh sách 87 dòng lệnh, chiếm 168px đầu màn + 177px thanh lưu.
  const maCua = (ls: { product_code: string }[]) => [
    ...new Set(ls.map((l) => l.product_code)),
  ]
  const tatCaMa = maCua(p.orderLines)
  const maChuaDinhHinh = maCua(
    d.linesHien.filter((l) => (d.byLine.get(l.id) ?? []).length === 0),
  )
  const maCoDinhMuc = new Set(maCua(p.orderLines.filter((l) => l.has_profile)))
  const nChuaDm = maChuaDinhHinh.filter((m) => !maCoDinhMuc.has(m)).length
  const nChuaNap = maChuaDinhHinh.length - nChuaDm
  const maSeed = maCua(d.chuaDinhMuc)
  const khaiRieng = d.rowsHien.filter((r) => r.stages != null).length

  return (
    <SxKhung bare label={`Bảng chi tiết ${p.lsx.code}`}>
      <div className="sx-body">
        <DauTrang
          crumb={`Lệnh sản xuất › ${p.lsx.code}`}
          title="Bảng chi tiết (BOM Kỹ thuật)"
          ctx={
            <>
              {p.lsx.customer_name} · <b>{tatCaMa.length}</b> mã
              {tatCaMa.length < p.orderLines.length && ` (${p.orderLines.length} dòng SP)`} ·{' '}
              <b>{d.rowsHien.length}</b> dòng ·{' '}
              {p.lsxClosed ? (
                <span className="pill m">lệnh đã kết thúc</span>
              ) : p.lockedByEntries ? (
                <span className="pill r">khoá — đã có {p.pbsCount} phiếu PBS</span>
              ) : (
                'chưa có sổ — sửa được'
              )}
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut
                  primary={d.rows.length === 0 && editable}
                  onClick={() => d.suggest('bom')}
                  why={editable ? null : d.luuWhy}
                  busy={d.busy}
                >
                  Nạp từ BOM kỹ thuật
                </ApNut>
                {editable && (
                  <ApNut onClick={() => d.suggest('previous')} busy={d.busy}>
                    Chép từ lệnh trước
                  </ApNut>
                )}
                {editable && (
                  <ApNut
                    onClick={() => d.lineThem && d.addRow(d.lineThem)}
                    why={d.lineThem ? null : 'chọn SP ở ô lọc'}
                  >
                    + Thêm dòng
                  </ApNut>
                )}
              </ApNhom>
              <ApNhom>
                <ApNut onClick={d.toggleMore}>
                  {d.more ? 'Ẩn cột quy cách' : 'Cột quy cách'}
                </ApNut>
                <ApNut href={`/thongke/lo-trinh?lsx=${p.lsx.id}`}>
                  Khai lộ trình công đoạn
                </ApNut>
                <ApNut href={`/thongke/lsx/${p.lsx.id}`}>Hồ sơ lệnh</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut primary onClick={d.save} why={d.luuWhy} busy={d.busy}>
                  Lưu bảng định hình
                </ApNut>
              </ApNhom>
            </>
          }
        />

        <div className="sx-hc">
          <label className="c">
            SP
            <select
              value={d.spLoc}
              onChange={(e) => d.setSpLoc(e.target.value)}
              aria-label="Lọc SP"
            >
              <option value="">tất cả</option>
              {d.linesHien.map((l) => {
                const g = d.dotCua(l.id)
                return (
                  <option key={l.id} value={l.id}>
                    {l.product_code}
                    {g.dot > 1 ? ` · ${g.dot} đợt` : ''}
                  </option>
                )
              })}
            </select>
          </label>
          <span className="sx-leg" style={{ padding: 0, border: 0 }}>
            <span>
              <i className="r" /> thiếu bắt buộc / sai số (chặn)
            </span>
            <span>
              <i className="w" /> ĐM kg trống ở nhóm khung (nghi ngờ)
            </span>
          </span>
          <span className="sp mut">
            Ô vàng gõ được · số lẻ gõ phẩy (1,25), chấm là nghìn (1.390 = 1390) · Ctrl+V
            dán vùng từ Excel · Enter xuống dòng · Xoá hỏi lại một lần
          </span>
        </div>

        {d.boVua && (
          <div className="sx-note">
            <span>
              Đã bỏ dòng <b>{d.boVua.row.name || '(chưa tên)'}</b> khỏi bản nháp — chưa
              mất hẳn, bấm <b>Lưu bảng định hình</b> mới ghi vào lệnh.
            </span>
            <button type="button" className="lnk" onClick={d.hoanTac}>
              Hoàn tác
            </button>
          </div>
        )}
        {p.lockedByEntries && !p.lsxClosed && (
          <div className="sx-note stop">
            <b>Bảng chỉ để tra cứu.</b> Lệnh đã có {p.pbsCount} phiếu sản lượng — xoá
            phiếu ở Hồ sơ lệnh › Phiếu rồi mới sửa được. Cố ý không đi tắt: sửa bảng khi
            đã có số là sổ mất chỗ bám.
          </div>
        )}
        {p.lsxClosed && (
          <div className="sx-note">
            <b>Lệnh đã kết thúc</b> — bảng chỉ để tra cứu.
          </div>
        )}
        {editable && maChuaDinhHinh.length > 0 && (
          <div className="sx-note">
            <b>
              {nChuaDm > 0
                ? `${nChuaDm}/${tatCaMa.length} mã chưa có định mức`
                : `${nChuaNap}/${tatCaMa.length} mã chưa có bảng`}
            </b>
            <span>
              {nChuaNap > 0 &&
                `· ${nChuaDm > 0 ? `${nChuaNap} mã ` : ''}có định mức — bấm Nạp từ BOM kỹ thuật `}
              {nChuaDm > 0 &&
                '· khai phần khung ở đây để ghi sổ được; định mức đầy đủ vẫn chờ Kỹ thuật'}
            </span>
            {nChuaDm > 0 && (
              <a href="/phan-cong-viec?muc=giao" className="lnk">
                Nhắc Kỹ thuật ›
              </a>
            )}
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

        <LuoiChiTiet d={d} />

        {editable && (
          <div className="sx-cb">
            <span className="sum">
              Sắp lưu <b>{d.rowsHien.length}</b> dòng
              {d.rowsLuu.length !== d.rowsHien.length && (
                <>
                  {' '}
                  → <b>{d.rowsLuu.length}</b> dòng vào lệnh (nhân theo đợt)
                </>
              )}{' '}
              · ghi đè trọn bảng cũ của lệnh
              {/* Q6: nói trước — ghi số xong bảng khoá, định mức Kỹ thuật sau dùng cho lệnh sau. */}
              {nChuaDm > 0 && (
                <span className="mut">
                  {' '}
                  · ghi số xong bảng khoá; định mức Kỹ thuật khai sau dùng cho lệnh sau
                </span>
              )}
              {khaiRieng > 0 && (
                <>
                  {' '}
                  · <b>{khaiRieng}</b> dòng khai lộ trình riêng lệnh
                </>
              )}
            </span>
            {d.luuWhy && d.luuWhy !== 'Chưa đổi gì' ? (
              <span className="blk">
                Chưa lưu được: {d.luuWhy}
                {d.first && (
                  <button type="button" className="lnk" onClick={d.goFirst}>
                    Tới dòng
                  </button>
                )}
              </span>
            ) : (
              <span className="mut">
                {d.dirty ? 'Có thay đổi chưa lưu' : 'Chưa đổi gì'}
              </span>
            )}
            <span className="sp">
              {khaiRieng > 0 && (
                <label
                  className="sx-ck"
                  title="Kế hoạch định hình trên lệnh là đường chính — hồ sơ SP nhận lộ trình cụm theo bản này (khớp tên cụm). Bỏ tick khi lệnh là ngoại lệ một lần."
                >
                  <input
                    type="checkbox"
                    checked={d.syncProfile}
                    onChange={(e) => d.setSyncProfile(e.target.checked)}
                  />
                  Cập nhật lộ trình cụm vào hồ sơ SP
                </label>
              )}
              {/* Q5 (15/11): thống kê không thấy ô này — bảng khai chỉ thuộc lệnh. */}
              {p.canSeedProfile && maSeed.length > 0 && (
                <label
                  className="sx-ck"
                  title={`Chỉ SP chưa có định mức ở hồ sơ mới được khởi tạo: ${maSeed.join(', ')}`}
                >
                  <input
                    type="checkbox"
                    checked={d.seedProfile}
                    onChange={(e) => d.setSeedProfile(e.target.checked)}
                  />
                  Khởi tạo hồ sơ SP ({maSeed.length} mã chưa có định mức)
                </label>
              )}
              <button
                type="button"
                className="sx-btn p"
                onClick={d.save}
                disabled={!!d.luuWhy || d.busy}
                aria-busy={d.busy || undefined}
              >
                {d.busy ? 'Đang lưu…' : 'Lưu bảng định hình'}
              </button>
            </span>
          </div>
        )}

        <ThanhTT
          left={
            p.lsxClosed
              ? 'Lệnh đã kết thúc'
              : p.lockedByEntries
                ? `Khoá vì đã có ${fmt(p.pbsCount)} phiếu PBS`
                : 'Lệnh chưa có sổ — còn sửa được; có phiếu PBS đầu tiên là bảng khoá'
          }
          right="Lưu là ghi đè trọn bảng · lộ trình công đoạn khai ở màn Lộ trình công đoạn"
        />
      </div>
    </SxKhung>
  )
}
