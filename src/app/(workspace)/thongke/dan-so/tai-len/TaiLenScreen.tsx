'use client'

import { Fragment, useRef } from 'react'
import Link from 'next/link'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { fmt } from '../../da-ghi/so-da-ghi.shared'
import type { TaiLenKetQua } from '@/modules/dept/production/dan-so.service'
import { useTaiLen, type TaiLenCtx } from './useTaiLen'

/**
 * TẢI FILE NHẬP LIỆU LÊN — khuôn F, KHÔNG kit (bản vẽ v2 19/11/2026). Đọc file mẫu đã điền; mỗi tờ
 * một tab; lệnh · công đoạn · tổ lấy từ file nên không có ô chọn nào ở đây.
 */
export function TaiLenScreen() {
  const d = useTaiLen()
  const inp = useRef<HTMLInputElement>(null)
  const ghi = d.buoc === 'ghi'
  return (
    <SxKhung label="Tải file nhập liệu">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Tải file nhập liệu"
          ctx={
            d.kq ? (
              <>
                Lệnh <b>{d.kq.lsx_code}</b> · {d.kq.to.length} tờ
              </>
            ) : undefined
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/dan-so/mau">File mẫu</ApNut>
                <ApNut href="/thongke/dan-so">Dán một tờ</ApNut>
              </ApNhom>
              <ApNhom>
                {d.buoc !== 'chon' && !ghi && (
                  <ApNut onClick={d.reset}>Chọn file khác</ApNut>
                )}
                {ghi && <ApNut onClick={d.dung}>Dừng sau đợt này</ApNut>}
                {d.buoc === 'xem' && (
                  <ApNut primary onClick={d.ghi} why={d.whyGhi}>
                    {`Ghi ${fmt(d.tongO)} ô`}
                  </ApNut>
                )}
              </ApNhom>
            </>
          }
        />
        <input
          ref={inp}
          id="tai-len-file"
          type="file"
          accept=".xlsx"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void d.chonFile(f)
            e.target.value = ''
          }}
        />
        {d.buoc === 'chon' && <Chon d={d} onChon={() => inp.current?.click()} />}
        {d.buoc === 'xem' && d.kq && <Xem d={d} kq={d.kq} />}
        {(d.buoc === 'ghi' || d.buoc === 'xong') && d.kq && <KetQuaMau d={d} kq={d.kq} />}
        <ThanhTT
          left="Tờ nào cũng đọc lệnh · công đoạn · tổ từ đầu tờ; ô đã có sổ đúng số này thì bỏ qua"
          right="Phiếu nhập bù: không giờ công, không vào Năng suất"
        />
      </div>
    </SxKhung>
  )
}

function Chon({ d, onChon }: { d: TaiLenCtx; onChon: () => void }) {
  return (
    <div className="sx-ds-dan" style={{ gridTemplateColumns: '1fr' }}>
      <div className="sx-ds-o" style={{ padding: 16 }}>
        {d.loi && (
          <div className="sx-note stop" role="alert">
            {d.loi}
          </div>
        )}
        <Rong
          tieuDe={d.dangDoc ? 'Đang đọc file…' : 'Chọn file nhập liệu đã điền'}
          lyDo="File .xlsx tải từ màn File mẫu nhập liệu (mỗi công đoạn một tờ). Màn đọc cả file, xem trước từng tờ rồi ghi một lần."
          tiep={
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button
                type="button"
                className="sx-btn p"
                onClick={onChon}
                disabled={d.dangDoc}
              >
                Chọn file…
              </button>
              <Link href="/thongke/dan-so/mau" className="sx-btn">
                Tải file mẫu
              </Link>
            </span>
          }
        />
      </div>
    </div>
  )
}

function Xem({ d, kq }: { d: TaiLenCtx; kq: TaiLenKetQua }) {
  const t = kq.to.find((x) => x.ten_to === d.tab) ?? kq.to[0]
  const x = d.xem[t.ten_to]
  const dong = x?.xem?.dong ?? []
  const lenh = t.payload.rows
  // Chỉ bày cột ngày có số.
  const cot = t.payload.cot.filter((iso) =>
    lenh.some((r) => r.o[iso] != null || r.sai.some((s) => s.iso === iso)),
  )
  const chanTo = d.chan.filter((c) => c.to === t.ten_to)
  return (
    <>
      <TabNgang
        label="Tờ trong file"
        tabs={kq.to.map((o) => {
          const xo = d.xem[o.ten_to]
          const nChan = d.chan.filter((c) => c.to === o.ten_to).length
          return {
            key: o.ten_to,
            label: (
              <>
                {o.label}
                {nChan > 0 && <span className="stop"> ●</span>}
              </>
            ),
            on: o.ten_to === t.ten_to,
            n: xo?.xem?.tom_tat.o_ghi,
            onClick: () => d.setTab(o.ten_to),
          }
        })}
      />
      <div className="sx-hc" role="group" aria-label="Phạm vi tờ">
        <span className="c">
          Công đoạn <b>{t.label}</b>
        </span>
        <span className={`c${t.team_id ? '' : 'on'}`}>
          Tổ <b>{t.to_ten || 'chưa chọn'}</b>
        </span>
        <span className="c">
          Dòng <b className="num">{fmt(lenh.length)}</b>
        </span>
        {x?.xem && (
          <>
            <span className="c">
              Sẽ ghi <b className="num">{fmt(x.xem.tom_tat.o_ghi)}</b> ô
            </span>
            <span className="c">
              Trùng bỏ qua <b className="num">{fmt(x.xem.tom_tat.trung)}</b>
            </span>
            {x.xem.tom_tat.khac > 0 && (
              <span className="c">
                Khác số (không ghi đè) <b className="num">{fmt(x.xem.tom_tat.khac)}</b>
              </span>
            )}
            {x.xem.tom_tat.moi > 0 && (
              <span className="c">
                Thêm mới <b className="num">{fmt(x.xem.tom_tat.moi)}</b>
              </span>
            )}
          </>
        )}
      </div>
      {chanTo.length > 0 ? (
        <div className="sx-note stop" role="alert">
          <b>Chưa ghi được:</b>{' '}
          {chanTo
            .slice(0, 6)
            .map((c) => c.text)
            .join(' · ')}
          {chanTo.length > 6 && ` … và ${chanTo.length - 6} chỗ nữa`}. Sửa trong Excel rồi
          chọn lại file.
        </div>
      ) : x?.xem ? (
        <div className="sx-note done">
          <b>Sẵn sàng:</b> tờ {t.label} ghi {fmt(x.xem.tom_tat.o_ghi)} ô,{' '}
          {x.xem.tom_tat.ngay_ghi} phiếu nhập bù.
        </div>
      ) : (
        <div className="sx-note">
          {x?.cho ? 'Đang xem trước tờ này…' : 'Tờ này chưa xem trước được.'}
        </div>
      )}
      {kq.bo_qua.length > 0 && (
        <div className="sx-note">
          Bỏ qua {kq.bo_qua.length} tờ:{' '}
          {kq.bo_qua.map((b) => `${b.ten_to} (${b.ly_do})`).join(' · ')}
        </div>
      )}
      <div className="sx-ds-thanbang">
        {lenh.length === 0 ? (
          <Rong
            tieuDe="Tờ này chưa có số nào"
            lyDo="Không có ô vàng nào được điền (hoặc chỉ có số đã ghi sẵn)."
            tiep="Điền số vào ô vàng trong Excel rồi chọn lại file."
          />
        ) : (
          <div className="sx-ds-luoi">
            <table className="sx-tb sx-ds-tb">
              <thead>
                <tr>
                  <th className="f c1">Chi tiết</th>
                  <th>Cụm</th>
                  <th>Tình trạng</th>
                  {cot.map((iso) => (
                    <th key={iso} className="r dn">
                      {iso.slice(8)}/{iso.slice(5, 7)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lenh.map((r, i) => {
                  const xd = dong[i]
                  const truoc = i > 0 ? lenh[i - 1].ma_sp : null
                  return (
                    <Fragment key={r.hang}>
                      {(i === 0 || r.ma_sp !== truoc) && r.ma_sp && (
                        <tr className="mh">
                          <td colSpan={3 + cot.length}>
                            <b className="num">{r.ma_sp}</b>
                            {xd?.ten_sp && <span className="mut"> {xd.ten_sp}</span>}
                          </td>
                        </tr>
                      )}
                      <tr className="d">
                        <td className="f c1" title={r.ten}>
                          {r.ten}
                        </td>
                        <td className="mut">{r.cum}</td>
                        <td className="tt">
                          {!xd ? (
                            <span className="mut">…</span>
                          ) : xd.kieu === 'ngoai' ? (
                            <span className="mut">Lệnh khác — bỏ qua</span>
                          ) : xd.van_de.length > 0 ? (
                            <span className="stop" title={xd.van_de.join(' · ')}>
                              {xd.van_de[0]}
                            </span>
                          ) : xd.kieu === 'moi' ? (
                            <span className="act">Thêm mới</span>
                          ) : (
                            <span className="done">
                              {xd.qua_cum ? `Khớp cụm: ${xd.qua_cum}` : 'Khớp'}
                              {xd.phan && xd.phan.length > 1
                                ? ` · chia ${xd.phan.length} đợt`
                                : ''}
                            </span>
                          )}
                        </td>
                        {cot.map((iso) => {
                          const sai = r.sai.find((s) => s.iso === iso)
                          if (sai)
                            return (
                              <td
                                key={iso}
                                className="r num dsO sai"
                                title="Không đọc được thành số"
                              >
                                {sai.raw}
                              </td>
                            )
                          const q = r.o[iso]
                          if (q == null) return <td key={iso} className="dsO" />
                          const tt = xd?.o[iso]?.tt ?? 'ghi'
                          return (
                            <td key={iso} className={`r num dsO ${tt}`}>
                              {fmt(q)}
                            </td>
                          )
                        })}
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function KetQuaMau({ d, kq }: { d: TaiLenCtx; kq: TaiLenKetQua }) {
  const xong = d.buoc === 'xong'
  const tongPhieu = Object.values(d.ketQua).reduce(
    (a, k) => a + k.phieu.filter((p) => p.doc_no).length,
    0,
  )
  const tongDong = Object.values(d.ketQua).reduce(
    (a, k) => a + k.phieu.reduce((b, p) => b + p.so_o, 0),
    0,
  )
  const ghiBoi = Object.values(d.ketQua)[0]?.ghi_boi
  return (
    <div className="sx-ds-xong">
      {xong && !d.loi && (
        <p>
          <b className="done">Đã ghi</b>
          {ghiBoi && (
            <>
              {' '}
              bởi <b>{ghiBoi}</b>
            </>
          )}{' '}
          — lệnh <b>{kq.lsx_code}</b> · {Object.keys(d.ketQua).length} tờ ·{' '}
          {fmt(tongPhieu)} phiếu nhập bù · {fmt(tongDong)} dòng sổ
        </p>
      )}
      {d.loi && (
        <div className="sx-note stop" role="alert">
          {d.loi}
        </div>
      )}
      {!xong && (
        <div className="sx-note" role="status">
          <b>Đang ghi.</b> Đừng đóng trang. Ghi từng đợt 10 ngày; mất mạng giữa chừng thì
          mở lại, chọn lại file và bấm Ghi tiếp — ô đã ghi tự bỏ qua.
        </div>
      )}
      <table className="sx-tb">
        <thead>
          <tr>
            <th>Tờ</th>
            <th>Tổ</th>
            <th>Tiến độ</th>
            <th className="r">Phiếu</th>
            <th className="r">Dòng sổ</th>
            <th>Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {kq.to.map((t) => {
            const tien = d.tien[t.ten_to]
            const kqt = d.ketQua[t.ten_to]
            const phieu = kqt?.phieu.filter((p) => p.doc_no).length ?? tien?.da ?? 0
            const pct =
              tien && tien.tong ? Math.round((phieu / tien.tong) * 100) : tien ? 100 : 0
            return (
              <tr key={t.ten_to} className="r">
                <td>{t.label}</td>
                <td>{t.to_ten}</td>
                <td>
                  {tien ? (
                    <div className="sx-ds-pr" aria-hidden="true" style={{ margin: 0 }}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  ) : (
                    <span className="mut">—</span>
                  )}
                </td>
                <td className="r num">
                  {tien ? `${fmt(phieu)} / ${fmt(tien.tong)}` : '—'}
                </td>
                <td className="r num">
                  {fmt(kqt?.phieu.reduce((a, p) => a + p.so_o, 0) ?? 0)}
                </td>
                <td>
                  {!tien ? (
                    <span className="mut">Không có ô mới</span>
                  ) : tien.trangThai === 'xong' ? (
                    <span className="done">Đã ghi</span>
                  ) : tien.trangThai === 'dang' ? (
                    <span className="act">Đang ghi…</span>
                  ) : (
                    <span className="mut">Chờ</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
