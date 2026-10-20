'use client'

import { useState } from 'react'
import {
  Btn,
  Consequence,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
} from '@/components/kit'
import type { CotNap } from '@/lib/luong/ho-so-luong'
import type { DongXemNap, HoSoLuongCtx } from './useHoSoLuong'
import { congKy, kyVn, TD, TH } from './luong.shared'

const TEN_COT: Record<CotNap, string> = {
  ten: 'Họ tên',
  to: 'Tổ (để khớp)',
  stk: 'Số tài khoản',
  nganHang: 'Ngân hàng',
  donGia: 'Đơn giá / công',
  luongThang: 'Lương tháng',
  luongBh: 'Lương đóng BH',
  cccd: 'CCCD',
  mst: 'Mã số thuế',
  npt: 'Người phụ thuộc',
}

/**
 * Nạp từ Excel: dán vùng có dòng tiêu đề (cột không nhận ra như "SỐ TIỀN" thực lĩnh thì bỏ),
 * server khớp theo họ tên + tổ. Dòng trùng tên / không thấy thì người chọn — không đoán.
 */
export function HopNap({ d }: { d: HoSoLuongCtx }) {
  const [text, setText] = useState('')
  const [xem, setXem] = useState<{ cot: CotNap[]; dong: DongXemNap[] } | null>(null)
  const [chon, setChon] = useState<Record<number, string>>({})
  const kyMoi =
    d.h.kyChotCuoi && d.h.thang <= d.h.kyChotCuoi ? congKy(d.h.kyChotCuoi, 1) : d.h.thang
  const [tuKy, setTuKy] = useState(kyMoi)

  const nguoiCua = (r: DongXemNap) =>
    chon[r.dong] ?? (r.khop.kieu === 'khop' ? r.khop.nguoi.id : undefined)
  const ghiDuoc = xem ? xem.dong.filter((r) => nguoiCua(r)) : []
  const conCho = xem ? xem.dong.length - ghiDuoc.length : 0

  async function doc() {
    const r = await d.goi<{ cot: CotNap[]; dong: DongXemNap[] }>('nap_xem', {
      viec: 'nap_xem',
      text,
    })
    if (r) {
      setXem(r)
      setChon({})
    }
  }
  async function ghi() {
    if (!xem || !ghiDuoc.length) return
    const r = await d.goi<{ hoSo: number; rieng: number }>('nap_ghi', {
      viec: 'nap_ghi',
      tuKy,
      dong: ghiDuoc.map((x) => ({ employeeId: nguoiCua(x)!, giaTri: x.giaTri })),
    })
    if (r) {
      d.setSheet(null)
      setXem(null)
      setText('')
      await d.sauGhi()
    }
  }

  const tatCa = d.h.dong.map((x) => ({
    value: x.employeeId,
    label: `${x.ma} · ${x.ten}${x.to ? ` · ${x.to}` : ''}`,
  }))
  return (
    <Sheet
      open={d.sheet === 'nap'}
      onClose={() => d.setSheet(null)}
      title="Nạp hồ sơ lương từ Excel"
      subtitle="Dán cả dòng tiêu đề. Khớp theo họ tên (bỏ dấu) và tổ."
      width={880}
      stakes="vua"
      footer={
        xem ? (
          <SheetActions
            stakes="vua"
            onCancel={() => setXem(null)}
            onConfirm={ghi}
            confirmLabel={`Ghi ${ghiDuoc.length} dòng đã khớp`}
            cancelLabel="Dán lại"
            busy={d.busy === 'nap_ghi'}
          />
        ) : (
          <SheetActions
            stakes="nhe"
            onCancel={() => d.setSheet(null)}
            onConfirm={doc}
            confirmLabel="Đọc và khớp"
            cancelLabel="Để sau"
            busy={d.busy === 'nap_xem'}
          />
        )
      }
    >
      {!xem ? (
        <>
          <label className="text-k-sm mb-1 block font-semibold" htmlFor="nap-text">
            Dán từ Excel (chọn vùng có dòng tiêu đề → Ctrl+C → Ctrl+V vào đây)
          </label>
          <TextArea
            id="nap-text"
            aria-label="Vùng dán từ Excel"
            value={text}
            onChange={setText}
            rows={10}
            placeholder={
              'STT\tTÊN NGƯỜI THỤ HƯỞNG\tSỐ TÀI KHOẢN\tSỐ TIỀN\tTÊN NGÂN HÀNG\t…\tPHÒNG BAN'
            }
          />
          <p className="text-k-sm mt-2 text-[var(--ink-3)]">
            Nhận các cột: Họ tên · Phòng ban / Tổ · Số tài khoản · Ngân hàng · Đơn giá ·
            Lương tháng · Lương đóng BH · CCCD · Mã số thuế · Người phụ thuộc. Cột khác
            (như “SỐ TIỀN” là thực lĩnh) bị bỏ qua.
          </p>
        </>
      ) : (
        <>
          <div className="text-k-sm mb-2 flex flex-wrap items-center gap-2">
            <span>Nhận ra:</span>
            {xem.cot.map((c) => (
              <Tag key={c}>{TEN_COT[c]}</Tag>
            ))}
            <span className="ml-auto">
              <Pick
                label="Lương áp từ kỳ"
                width={170}
                value={tuKy}
                onChange={setTuKy}
                options={[0, 1, 2].map((n) => {
                  const k = congKy(kyMoi, n)
                  return { value: k, label: `Lương từ kỳ ${kyVn(k)}` }
                })}
              />
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto border border-[var(--line)]">
            <table className="text-k-sm w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={TH}>Dòng</th>
                  <th className={TH}>Trong file</th>
                  <th className={TH}>Khớp với</th>
                  <th className={TH}>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {xem.dong.map((r) => (
                  <tr key={r.dong}>
                    <td className={TD}>{r.dong}</td>
                    <td className={TD}>
                      {r.ten}
                      {r.to && <span className="text-[var(--ink-3)]"> · {r.to}</span>}
                    </td>
                    <td className={TD}>
                      {r.khop.kieu === 'khop' && !chon[r.dong] ? (
                        `${r.khop.nguoi.ma} · ${r.khop.nguoi.ten}`
                      ) : (
                        <Pick
                          label={`Chọn người cho dòng ${r.dong}`}
                          width={300}
                          value={chon[r.dong] ?? ''}
                          onChange={(v) => setChon((c) => ({ ...c, [r.dong]: v }))}
                          options={[
                            { value: '', label: 'Chọn người…' },
                            ...(r.khop.kieu === 'nhieu'
                              ? r.khop.ungVien.map((u) => ({
                                  value: u.id,
                                  label: `${u.ma} · ${u.ten}${u.to ? ` · ${u.to}` : ''}`,
                                }))
                              : tatCa),
                          ]}
                        />
                      )}
                    </td>
                    <td className={TD}>
                      {nguoiCua(r) ? (
                        <Tag tone="done">{chon[r.dong] ? 'đã chọn' : 'khớp'}</Tag>
                      ) : r.khop.kieu === 'nhieu' ? (
                        <Tag tone="warn">nhiều ứng viên</Tag>
                      ) : (
                        <Tag tone="stop">không thấy</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Consequence>
            Ghi {ghiDuoc.length} dòng: số tài khoản / ngân hàng / CCCD / MST ghi đè ô cũ;
            đơn giá, lương tháng, lương BH thành bản lương từ kỳ {kyVn(tuKy)}.
            {conCho
              ? ` ${conCho} dòng chưa chọn người sẽ bỏ qua — dán lại sau khi chọn.`
              : ''}
          </Consequence>
          {conCho > 0 && (
            <Btn
              onClick={() => {
                const dau = xem.dong.find((r) => !nguoiCua(r))
                if (dau)
                  document
                    .querySelector<HTMLElement>(
                      `[aria-label="Chọn người cho dòng ${dau.dong}"]`,
                    )
                    ?.focus()
              }}
            >
              Tới dòng đầu tiên chưa chọn
            </Btn>
          )}
        </>
      )}
    </Sheet>
  )
}
