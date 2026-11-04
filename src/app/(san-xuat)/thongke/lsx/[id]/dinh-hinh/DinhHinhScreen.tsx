'use client'

import {
  ApNhom,
  ApNut,
  DauTrang,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { fmt, type DinhHinhProps } from './dinh-hinh.shared'
import { LuoiChiTiet } from './luoi-chi-tiet'
import { LoTrinhLenh } from './lo-trinh-lenh'
import { useDinhHinh } from './useDinhHinh'

/**
 * ĐỊNH HÌNH CHI TIẾT CỦA LỆNH — dựng lại không kit theo bản vẽ duyệt 03/11/2026
 * (https://claude.ai/artifact/DUtMtTWekhhBUUzh54XM9L). Khuôn F: lưới là nhân
 * vật chính; hai tab (Chi tiết · Lộ trình theo cụm) chung một bản nháp, một nút
 * Lưu ghi đè trọn bộ; thanh chốt đáy nói đúng dòng nào hỏng và bấm tới.
 *
 * Khoá khi lệnh đã có phiếu sản lượng: ô không gõ, không thêm / xoá dòng, thanh
 * chốt ẩn, nút Lưu nói cách gỡ. Định hình lại khi đã có số = xoá phiếu trước,
 * cố ý không đi tắt.
 */
export function DinhHinhScreen(props: DinhHinhProps) {
  const d = useDinhHinh(props)
  const { p, editable } = d
  const chuaDinhHinh = p.orderLines.filter((l) => (d.byLine.get(l.id) ?? []).length === 0)
  const thieuDinhMuc = chuaDinhHinh.filter((l) => !l.has_profile)
  const coDinhMuc = p.orderLines.filter((l) => l.has_profile).length
  const khaiRieng = d.rows.filter((r) => r.stages != null).length

  return (
    <SxKhung bare label={`Lộ trình công đoạn ${p.lsx.code}`}>
      <div className="sx-body">
        <DauTrang
          crumb={`Lệnh sản xuất › ${p.lsx.code}`}
          title="Lộ trình công đoạn"
          ctx={
            <>
              {p.lsx.customer_name} · <b>{p.orderLines.length}</b> dòng SP ·{' '}
              <b>{d.rows.length}</b> dòng ·{' '}
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
              </ApNhom>
              <ApNhom>
                <ApNut onClick={d.toggleMore}>
                  {d.more ? 'Ẩn cột quy cách' : 'Cột quy cách'}
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

        <TabNgang
          label="Lộ trình và bảng chi tiết"
          tabs={[
            {
              key: 'lo_trinh',
              label:
                d.nCum > 0
                  ? `Lộ trình công đoạn · ${d.nCum} cụm${khaiRieng ? ` · ${khaiRieng} đã khai` : ''}`
                  : 'Lộ trình công đoạn · BOM phẳng',
              on: d.tab === 'lo_trinh',
              onClick: () => d.setTab('lo_trinh'),
            },
            {
              key: 'chi_tiet',
              label: 'Bảng chi tiết (BOM Kỹ thuật)',
              n: d.rows.length,
              on: d.tab === 'chi_tiet',
              onClick: () => d.setTab('chi_tiet'),
            },
          ]}
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
              {p.orderLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.product_code}
                </option>
              ))}
            </select>
          </label>
          {d.tab === 'chi_tiet' && (
            <span className="sx-leg" style={{ padding: 0, border: 0 }}>
              <span>
                <i className="r" /> thiếu bắt buộc (chặn)
              </span>
              <span>
                <i className="w" /> ĐM kg trống ở nhóm khung (nghi ngờ)
              </span>
            </span>
          )}
          <span className="sp mut">
            {d.tab === 'chi_tiet'
              ? 'Ctrl+V dán vùng từ Excel · Enter xuống dòng · ⌫ ở cột cuối xoá dòng'
              : 'x đậm = khai riêng lệnh · x mờ = theo hồ sơ SP / nhóm · ô gạch chéo bấm để thêm'}
          </span>
        </div>

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
        {editable && d.rows.length === 0 && (
          <div className="sx-note">
            <b>Lệnh chưa có bảng chi tiết.</b> Bảng này tự nạp từ định mức Kỹ thuật lúc
            duyệt lệnh; lệnh này chưa có vì {coDinhMuc}/{p.orderLines.length} SP có định
            mức
            {thieuDinhMuc.length > 0 && (
              <>
                {' '}
                — {thieuDinhMuc.map((l) => l.product_code).join(', ')} Kỹ thuật chưa nạp,
                chờ họ xong rồi bấm Nạp từ BOM
              </>
            )}
            {thieuDinhMuc.length === 0 && ' — bấm Nạp từ BOM kỹ thuật để nạp ngay'}. Không
            có bảng chi tiết thì Ghi sản lượng không có dòng để ghi.
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

        {d.tab === 'chi_tiet' ? <LuoiChiTiet d={d} /> : <LoTrinhLenh d={d} />}

        {editable && (
          <div className="sx-cb">
            <span className="sum">
              Sắp lưu <b>{d.rows.length}</b> dòng · ghi đè trọn bảng cũ của lệnh
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
              {d.chuaDinhMuc.length > 0 && (
                <label
                  className="sx-ck"
                  title="Chỉ SP chưa có định mức ở hồ sơ mới được khởi tạo"
                >
                  <input
                    type="checkbox"
                    checked={d.seedProfile}
                    onChange={(e) => d.setSeedProfile(e.target.checked)}
                  />
                  Khởi tạo hồ sơ SP ({d.chuaDinhMuc.map((l) => l.product_code).join(', ')}
                  )
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
          right="production_components · ghi đè trọn bộ mỗi lần Lưu · lộ trình: kế hoạch lệnh → bản chụp → hồ sơ SP → nhóm vật tư"
        />
      </div>
    </SxKhung>
  )
}
