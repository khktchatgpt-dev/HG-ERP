'use client'

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
import { fmt } from '../da-ghi/so-da-ghi.shared'
import type { TuyChonDanSo } from '@/modules/dept/production/dan-so.service'
import { LuoiXem } from './luoi-xem'
import { useDanSo, type DanSoCtx } from './useDanSo'

/**
 * DÁN SỔ EXCEL — khuôn F, KHÔNG kit (bản vẽ 17/11/2026
 * https://claude.ai/artifact/TN9FdcN5S1mJBDAvwQcsS4, Q1–Q8 duyệt; dựng B1).
 *
 * Ba bước trên một màn: Dán → Xem trước → Đã ghi. Việc nặng (khớp chi tiết, tính
 * ô sẽ ghi) ở `dan-so.service`; màn chỉ hiển thị và để người dùng sửa chỗ sai.
 */
export function DanSoScreen({ opt }: { opt: TuyChonDanSo }) {
  const d = useDanSo(opt)
  const dongSP = d.lenh?.dong ?? []
  const tenLenh = d.lenh?.code ?? ''
  return (
    <SxKhung label="Dán sổ Excel">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Dán sổ Excel"
          ctx={
            d.buoc === 'xem' ? (
              <>
                Lệnh <b>{tenLenh}</b> · công đoạn{' '}
                <b>{d.opt.stages.find((x) => x.code === d.stage)?.label ?? d.stage}</b> ·{' '}
                <b>{d.opt.teams.find((x) => x.id === d.teamId)?.name}</b> ·{' '}
                {d.doc.cot.length} cột ngày ·{' '}
                {d.dangTinh && <span className="mut">đang tính…</span>}
              </>
            ) : (
              'Nhập số cũ hoặc số hôm nay bằng một lần dán'
            )
          }
          actions={
            <>
              {d.buoc !== 'dan' && (
                <ApNhom>
                  <ApNut onClick={d.lamLai}>
                    {d.buoc === 'xong' ? 'Dán tờ khác' : 'Dán lại'}
                  </ApNut>
                </ApNhom>
              )}
              {d.buoc === 'dan' && (
                <ApNhom>
                  <ApNut primary onClick={d.xemTruoc} why={d.thieu}>
                    Xem trước
                  </ApNut>
                </ApNhom>
              )}
              {d.buoc === 'dan' && d.lsxId && d.teamId && d.stage && (
                <ApNhom>
                  <a
                    className="sx-btn"
                    href={`/api/dept/production/dan-so/mau?${new URLSearchParams({
                      lsx_id: d.lsxId,
                      stage: d.stage,
                      team_id: d.teamId,
                      ...(d.lineId ? { line_id: d.lineId } : {}),
                    })}`}
                    title="Tờ Excel có sẵn chi tiết của lệnh + số đã ghi của tổ này"
                  >
                    Tải Excel mẫu
                  </a>
                </ApNhom>
              )}
              {d.buoc === 'xem' && (
                <ApNhom>
                  <ApNut primary onClick={d.ghi} why={d.whyGhi} busy={d.dangGhi}>
                    {d.xem ? `Ghi ${fmt(d.xem.tom_tat.o_ghi)} ô` : 'Ghi'}
                  </ApNut>
                </ApNhom>
              )}
              {d.buoc === 'xong' && (
                <ApNhom>
                  <ApNut primary href={`/thongke/so-cong-doan?cd=${d.stage}`}>
                    Mở Sổ công đoạn
                  </ApNut>
                </ApNhom>
              )}
            </>
          }
        />

        {d.buoc !== 'xong' && (
          <div className="sx-hc" role="group" aria-label="Phạm vi dán">
            <label className="c">
              Lệnh
              <select
                value={d.lsxId}
                onChange={(e) => d.chonLenh(e.target.value)}
                aria-label="Lệnh sản xuất"
              >
                {d.opt.lenh.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </select>
            </label>
            {dongSP.length > 1 && (
              <label className="c">
                Mã hàng
                <select
                  value={d.lineId}
                  onChange={(e) => d.chonDong(e.target.value)}
                  aria-label="Mã hàng mặc định"
                >
                  <option value="">Theo cột Mã SP của file</option>
                  {dongSP.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.ma} {x.ten}
                      {x.dot ? ` · ${x.dot}` : ''} · SL {fmt(x.qty)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="c">
              Công đoạn
              <select
                value={d.stage}
                onChange={(e) => d.chonCD(e.target.value)}
                aria-label="Công đoạn"
              >
                {d.opt.stages.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="c">
              Tổ
              <select
                value={d.teamId}
                onChange={(e) => d.chonTo(e.target.value)}
                aria-label="Tổ"
              >
                {d.opt.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="c">
              Năm
              <select
                value={d.nam}
                onChange={(e) => d.chonNam(Number(e.target.value))}
                aria-label="Năm cho cột ngày chỉ có ngày/tháng"
              >
                {[d.opt.nam, d.opt.nam - 1, d.opt.nam - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {d.loi && (
          <div className="sx-note stop" role="alert">
            {d.loi}
          </div>
        )}

        {d.buoc === 'dan' && <BuocDan d={d} />}
        {d.buoc === 'xem' && <BuocXem d={d} />}
        {d.buoc === 'xong' && <BuocXong d={d} />}

        <ThanhTT
          left={
            d.buoc === 'dan'
              ? d.doc.ok
                ? `Đọc được ${fmt(d.doc.dong.length)} dòng · ${d.doc.cot.length} cột ngày`
                : 'Dán vào ô vàng bằng Ctrl+V. Dán lại cả tờ mỗi ngày cũng được: ô trùng bị bỏ qua.'
              : d.buoc === 'xem'
                ? `${d.hien.length} / ${d.rows.length} dòng · ${d.doc.cot.length} cột ngày`
                : 'Mỗi phiếu mở được ở Sổ theo ngày để sửa tới khi chốt sổ ngày.'
          }
          right="Phiếu nhập bù: không giờ công, không vào Năng suất"
        />
      </div>
    </SxKhung>
  )
}

function BuocDan({ d }: { d: DanSoCtx }) {
  return (
    <div className="sx-ds-dan">
      <div className="sx-ds-o">
        <div className="sx-ds-hint">
          Dán cả hàng tiêu đề lẫn các cột ngày. Hệ thống tự nhận cột theo tên tiêu đề.
        </div>
        <textarea
          className="sx-ds-ta"
          aria-label="Vùng dán từ Excel"
          value={d.text}
          onChange={(e) => d.setText(e.target.value)}
          spellCheck={false}
          placeholder={'Cụm\tTên chi tiết\tĐM\tCT/SP\tTổng cần\t26/07\t27/07 …'}
        />
      </div>
      <div className="sx-ds-ben">
        <h2>Cột nhận được</h2>
        {d.doc.hieu.length === 0 ? (
          <p className="mut">Chưa dán gì, hoặc chưa thấy hàng tiêu đề.</p>
        ) : (
          <table className="sx-tb">
            <tbody>
              {d.doc.hieu.map((h) => (
                <tr key={h.tieu_de + h.la}>
                  <td>{h.tieu_de}</td>
                  <td>{h.la}</td>
                </tr>
              ))}
              <tr>
                <td>
                  {d.doc.cot
                    .slice(0, 3)
                    .map((c) => c.nhan)
                    .join(', ')}
                  {d.doc.cot.length > 3 ? ' …' : ''}
                </td>
                <td>Số làm từng ngày ({d.doc.cot.length} cột)</td>
              </tr>
            </tbody>
          </table>
        )}
        {d.doc.loi.length > 0 && text(d.doc.loi)}
        <p className="mut">
          Lệnh, Mã SP, Loại bàn: bỏ qua (đã chọn ở trên) — trừ khi lệnh có nhiều mã hàng.
          Ô công thức trong Excel thì dán giá trị.
        </p>
      </div>
    </div>
  )
}

const text = (xs: string[]) => (
  <ul className="sx-ds-loi">
    {xs.map((x) => (
      <li key={x}>{x}</li>
    ))}
  </ul>
)

function BuocXem({ d }: { d: DanSoCtx }) {
  const x = d.xem
  const tabs = [
    { key: 'all', label: 'Tất cả', n: d.dem.all },
    { key: 'khop', label: 'Khớp', n: d.dem.khop },
    { key: 'moi', label: 'Sẽ thêm vào bảng chi tiết', n: d.dem.moi },
    { key: 'sua', label: 'Cần sửa', n: d.dem.sua },
  ] as const
  return (
    <>
      {d.dangGhi && x && (
        <div className="sx-note" role="status">
          <b>Đang ghi {x.tom_tat.ngay_ghi} phiếu</b> — mỗi phiếu mất vài giây, cả tờ có
          thể mất vài phút. Đừng đóng trang và đừng bấm Ghi lần nữa.
        </div>
      )}
      <TabNgang
        label="Lọc dòng"
        tabs={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          n: t.n,
          on: d.loc === t.key,
          onClick: () => d.setLoc(t.key),
        }))}
      />
      {x && (
        <div className={d.chan.length ? 'sx-note stop' : 'sx-note ok'}>
          {d.chan.length ? (
            <>
              <b>Chưa ghi được:</b> còn {d.chan.length} chỗ cần sửa trước khi ghi.
            </>
          ) : (
            <>
              <b>Sẵn sàng ghi:</b> {fmt(x.tom_tat.o_ghi)} ô, {x.tom_tat.ngay_ghi} phiếu
              nhập bù
              {x.tom_tat.moi > 0 && (
                <>, thêm {x.tom_tat.moi} chi tiết vào bảng chi tiết</>
              )}
              .
            </>
          )}
          {x.tom_tat.ngoai > 0 && (
            <span className="mut">
              {' '}
              {x.tom_tat.ngoai} dòng có mã SP không thuộc lệnh này — bỏ qua (số của lệnh
              khác).
            </span>
          )}
          {(x.tom_tat.trung > 0 || x.tom_tat.khac > 0 || x.tom_tat.chot > 0) && (
            <span className="mut">
              {' '}
              Bỏ qua {x.tom_tat.trung} ô trùng, {x.tom_tat.khac} ô đã có sổ khác số,{' '}
              {x.tom_tat.chot} ô ngày đã chốt.
            </span>
          )}
        </div>
      )}
      <div className="sx-ds-thanbang">
        {d.hien.length === 0 ? (
          <Rong
            tieuDe="Không có dòng nào ở mục này"
            lyDo={d.xem ? 'Bộ lọc đang chọn không có dòng.' : 'Đang tính xem trước…'}
            tiep={
              <button type="button" className="lnk" onClick={() => d.setLoc('all')}>
                Xem tất cả
              </button>
            }
          />
        ) : (
          <LuoiXem d={d} />
        )}
      </div>
      <div className="sx-cb">
        {d.chan.length > 0 ? (
          <span className="blk">
            Chưa ghi được:
            {d.chan.slice(0, 3).map((c, i) => (
              <button
                key={i}
                type="button"
                className="lnk"
                onClick={() => c.hang && d.nhayToi(c.hang)}
              >
                {c.text}
              </button>
            ))}
            {d.chan.length > 3 && (
              <span className="mut"> … và {d.chan.length - 3} chỗ nữa</span>
            )}
          </span>
        ) : (
          <span className="sum">
            Không còn chỗ chặn.{' '}
            <span className="mut">
              Phiếu nhập bù: không giờ công, không vào Năng suất.
            </span>
          </span>
        )}
      </div>
    </>
  )
}

function BuocXong({ d }: { d: DanSoCtx }) {
  const k = d.ketQua
  if (!k) return null
  const ok = k.phieu.filter((p) => p.doc_no)
  const hong = k.phieu.filter((p) => p.loi)
  const soDong = ok.reduce((a, p) => a + p.so_o, 0)
  const dmy = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`
  const tu = ok.length > 0 ? dmy(ok[0].iso) : ''
  const den = ok.length > 0 ? dmy(ok[ok.length - 1].iso) : ''
  const luc = new Date(k.luc).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const nhan = d.opt.stages.find((x) => x.code === d.stage)?.label ?? d.stage
  const to = d.opt.teams.find((x) => x.id === d.teamId)?.name ?? ''
  return (
    <div className="sx-ds-xong">
      <p>
        <b className="done">Đã ghi</b> bởi <b>{k.ghi_boi}</b> lúc {luc} — lệnh{' '}
        <b>{d.lenh?.code}</b> · công đoạn <b>{nhan}</b> · <b>{to}</b>
      </p>
      <p className="mut">
        {ok.length} phiếu nhập bù ({tu}
        {tu !== den ? ` → ${den}` : ''}) · {fmt(soDong)} dòng sổ
        {k.moi_tao > 0 ? ` · thêm ${fmt(k.moi_tao)} chi tiết vào bảng chi tiết` : ''}
      </p>
      {hong.length > 0 && (
        <div className="sx-note stop" role="alert">
          <b>{hong.length} ngày chưa ghi được</b> — sửa rồi dán lại (ô đã ghi sẽ tự bỏ
          qua):
          <ul className="sx-ds-loi">
            {hong.map((p) => (
              <li key={p.iso}>
                {dmy(p.iso)}: {p.loi}
              </li>
            ))}
          </ul>
        </div>
      )}
      <table className="sx-tb">
        <thead>
          <tr>
            <th>Mã SP</th>
            <th>Tên</th>
            <th>Đợt</th>
            <th className="r">Chi tiết</th>
            <th className="r">Số lượng ghi</th>
            <th className="r">Thêm mới</th>
          </tr>
        </thead>
        <tbody>
          {k.theo_ma.map((m, i) => (
            <tr key={i}>
              <td className="num">{m.ma}</td>
              <td>{m.ten}</td>
              <td>{m.dot || '—'}</td>
              <td className="r num">{m.so_ct}</td>
              <td className="r num">{fmt(m.tong)}</td>
              <td className="r num">{m.moi > 0 ? m.moi : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="sx-ds-gap">
        <summary>
          {ok.length} phiếu theo ngày ({tu} → {den})
        </summary>
        <table className="sx-tb">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Phiếu</th>
              <th className="r">Dòng sổ</th>
            </tr>
          </thead>
          <tbody>
            {ok.map((p) => (
              <tr key={p.iso}>
                <td className="num">
                  {dmy(p.iso)}/{p.iso.slice(0, 4)}
                </td>
                <td className="num">
                  <Link
                    className="lnk"
                    href={`/thongke/da-ghi?date=${p.iso}&phieu=${p.doc_no}`}
                  >
                    {p.doc_no}
                  </Link>
                </td>
                <td className="r num">{p.so_o}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {k.canh_bao.length > 0 && (
        <details className="sx-ds-gap">
          <summary>{k.canh_bao.length} chi tiết ghi vượt số cần (vẫn ghi được)</summary>
          <ul className="sx-ds-loi">
            {k.canh_bao.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
