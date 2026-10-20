'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, NoticeBar, Sheet, SheetActions, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  LOAI_NGHI,
  TEN_NGHI,
  TEN_TINH_TRANG,
  apDieuChinh,
  moTaDc,
  type DieuChinh,
  type LoaiDc,
  type LoaiNghi,
} from '@/lib/cham-cong/dieu-chinh'
import { gioPhut, tachLuot, tenMay } from '@/lib/cham-cong/mot-nguoi'
import { THU, dmy, thu } from './ky-cong.shared'
import type { QuyenDieuChinh } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'

export type MoDieuChinh = {
  ma: string
  ten: string
  to: string | null
  ca: string
  ngay: string
  /** Lượt MÁY (đã gộp lặp) — chưa áp điều chỉnh. */
  luot: { gio: string; may: string }[]
  /** Vì sao ngày này lỗi (nếu có). */
  loi?: string
}

const LOAI: { v: LoaiDc; ten: string; mo: string }[] = [
  {
    v: 'add_punch',
    ten: 'Bổ sung lượt quẹt',
    mo: 'Quên quẹt, máy hỏng, quẹt ở chỗ khác — ghi giờ thật người đó vào/ra',
  },
  {
    v: 'leave',
    ten: 'Đánh dấu nghỉ có lý do',
    mo: 'Phép, ốm, việc riêng có báo, công tác — ngày đó không bị tính vắng',
  },
  {
    v: 'ignore_punch',
    ten: 'Bỏ qua một lượt',
    mo: 'Lượt sai (quẹt nhầm, quẹt hộ) — lượt vẫn giữ trong máy, chỉ không dùng khi xem/tính',
  },
]
const LY_DO: Record<LoaiDc, string[]> = {
  add_punch: [
    'Quên quẹt',
    'Máy không nhận vân tay / khuôn mặt',
    'Quẹt ở máy khác chưa nối',
    'Đi công tác / làm ngoài xưởng',
  ],
  leave: ['Có đơn / báo trước', 'Báo qua tổ trưởng', 'Giấy khám bệnh'],
  ignore_punch: ['Quẹt nhầm', 'Quẹt hộ', 'Quẹt thử máy'],
}

const o = 'h-[30px] border border-[var(--line)] bg-[var(--surface-card)] px-2 text-k-sm'
const lab = 'text-k-label mb-1 block font-semibold text-[var(--ink-2)]'
const sec = 'border-b border-[var(--line-faint)] px-4 py-3'

/**
 * NGĂN "ĐIỀU CHỈNH CHẤM CÔNG MỘT NGÀY" (bản vẽ DieuChinh.dc.html, câu 22–25). Mở từ ô
 * bảng tổ hoặc dòng trang một người. Lượt máy bày trên cùng và không sửa được; dưới là
 * thêm điều chỉnh (gửi = chờ duyệt) và lịch sử điều chỉnh của ngày — người có quyền
 * duyệt duyệt / từ chối ngay tại đây.
 */
export function DieuChinhSheet({
  mo,
  dcs,
  quyen,
  onClose,
  onDoi,
}: {
  mo: MoDieuChinh | null
  /** Mọi điều chỉnh của kỳ — ngăn tự lọc theo người + ngày. */
  dcs: DieuChinh[]
  quyen: QuyenDieuChinh
  onClose: () => void
  /** Gọi sau mỗi lần gửi / duyệt / rút thành công — trang tải dữ liệu ở client tự nạp lại. */
  onDoi?: () => void
}) {
  return (
    <Sheet
      open={!!mo}
      onClose={onClose}
      title="Điều chỉnh chấm công"
      subtitle={
        mo
          ? `${mo.ten} · ${THU[thu(mo.ngay)]} ${dmy(mo.ngay)} · mã ${mo.ma}${mo.to ? ` · ${mo.to}` : ''} · ca ${mo.ca}`
          : undefined
      }
      width={560}
    >
      {mo && (
        <Than
          key={`${mo.ma}|${mo.ngay}`}
          mo={mo}
          dcs={dcs.filter((d) => d.ma === mo.ma && d.ngay === mo.ngay)}
          quyen={quyen}
          onClose={onClose}
          onDoi={onDoi}
        />
      )}
    </Sheet>
  )
}

function Than({
  mo,
  dcs,
  quyen,
  onClose,
  onDoi,
}: {
  mo: MoDieuChinh
  dcs: DieuChinh[]
  quyen: QuyenDieuChinh
  onClose: () => void
  onDoi?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const motLuot = mo.luot.length === 1
  const [loai, setLoai] = useState<LoaiDc>(mo.luot.length ? 'add_punch' : 'leave')
  const [gio, setGio] = useState(motLuot && mo.luot[0].gio < '12:00' ? '16:00' : '07:00')
  const [chieu, setChieu] = useState<'in' | 'out'>(
    motLuot && mo.luot[0].gio >= '12:00' ? 'in' : 'out',
  )
  const [nghi, setNghi] = useState<LoaiNghi>('annual')
  const [boQua, setBoQua] = useState(mo.luot[0]?.gio ?? '')
  const [lyDo, setLyDo] = useState('')
  const [canCu, setCanCu] = useState('')
  const [busy, setBusy] = useState(false)

  const ban = useMemo(
    () => ({
      loai,
      gio: loai === 'leave' ? null : loai === 'add_punch' ? `${gio}:00` : boQua,
      chieu: loai === 'add_punch' ? chieu : null,
      nghi: loai === 'leave' ? nghi : null,
    }),
    [loai, gio, chieu, nghi, boQua],
  )
  const sau = useMemo(() => {
    const x = apDieuChinh(mo.luot, [
      ...dcs.filter((d) => d.tinhTrang === 'approved'),
      { ...ban, tinhTrang: 'approved' as const },
    ])
    if (x.nghi) return `${TEN_NGHI[x.nghi]} — không tính vắng`
    const t = tachLuot(x.luot)
    if (!t.vao) return 'không còn lượt nào'
    return `vào ${t.vao}${t.ra ? ` · ra ${t.ra}` : ' · chưa có giờ ra'}${t.coMatPhut != null ? ` · tổng thời gian ${gioPhut(t.coMatPhut)}` : ''}`
  }, [mo.luot, dcs, ban])

  const thieu =
    lyDo.trim().length < 2
      ? 'Ghi lý do'
      : loai === 'add_punch' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)
        ? 'Ghi giờ bổ sung dạng 16:00'
        : loai === 'ignore_punch' && !boQua
          ? 'Chọn lượt cần bỏ qua'
          : null

  async function chay(viec: () => Promise<unknown>, xong: string) {
    setBusy(true)
    try {
      await viec()
      toast.success(xong)
      router.refresh()
      onDoi?.()
      return true
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function gui() {
    if (thieu) return
    const body =
      loai === 'add_punch'
        ? { loai, ma: mo.ma, ngay: mo.ngay, gio, chieu, lyDo, canCu }
        : loai === 'leave'
          ? { loai, ma: mo.ma, ngay: mo.ngay, nghi, lyDo, canCu }
          : { loai, ma: mo.ma, ngay: mo.ngay, gio: boQua, lyDo, canCu }
    const ok = await chay(
      () => api('/api/dept/hr/cham-cong/dieu-chinh', { method: 'POST', body }),
      'Đã gửi — chờ người khác duyệt',
    )
    if (ok) onClose()
    if (ok) {
      setLyDo('')
      setCanCu('')
    }
  }

  const quyet = (id: string, viec: 'duyet' | 'tu_choi' | 'rut') => {
    let ghiChu: string | undefined
    if (viec === 'tu_choi') {
      ghiChu = window.prompt('Lý do từ chối')?.trim()
      if (!ghiChu || ghiChu.length < 2) return
    }
    void chay(
      () =>
        api('/api/dept/hr/cham-cong/dieu-chinh/quyet', {
          method: 'POST',
          body: { ids: [id], viec, ghiChu },
        }),
      viec === 'duyet' ? 'Đã duyệt' : viec === 'tu_choi' ? 'Đã từ chối' : 'Đã rút',
    )
  }

  return (
    <div className="text-k-sm">
      <div className={sec}>
        <h3 className="mb-2 font-semibold">Máy đã ghi — lượt máy không sửa, không xoá</h3>
        {mo.luot.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-k-label text-left text-[var(--ink-3)]">
                <th className="w-24 py-1 font-semibold">Giờ</th>
                <th className="py-1 font-semibold">Máy</th>
              </tr>
            </thead>
            <tbody>
              {mo.luot.map((l, i) => (
                <tr key={i} className="border-t border-[var(--line-faint)]">
                  <td className="num py-1">{l.gio}</td>
                  <td className="py-1">{tenMay(l.may)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[var(--ink-3)]">Không có lượt quẹt nào ngày này.</p>
        )}
        {mo.loi && (
          <div className="mt-2">
            <NoticeBar tone="warn" tag="Lỗi">
              {mo.loi}
            </NoticeBar>
          </div>
        )}
      </div>

      {quyen.gui && (
        <div className={sec}>
          <h3 className="mb-2 font-semibold">Thêm điều chỉnh</h3>
          <div className="flex flex-col gap-1.5">
            {LOAI.map((x) => {
              const tat = x.v === 'ignore_punch' && !mo.luot.length
              return (
                <label
                  key={x.v}
                  className={cn(
                    'flex cursor-pointer gap-2 border px-2.5 py-2',
                    loai === x.v
                      ? 'border-[var(--act)] bg-[var(--act-wash)]'
                      : 'border-[var(--line-faint)]',
                    tat && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name="loai"
                    checked={loai === x.v}
                    disabled={tat}
                    onChange={() => {
                      setLoai(x.v)
                      setLyDo('')
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <b className="font-semibold">{x.ten}</b>
                    <span className="text-k-label block text-[var(--ink-3)]">{x.mo}</span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {loai === 'add_punch' && (
              <>
                <label>
                  <span className={lab}>Giờ bổ sung</span>
                  <input
                    inputMode="numeric"
                    value={gio}
                    maxLength={5}
                    placeholder="16:00"
                    onChange={(e) => {
                      // Gõ "1630" tự thành "16:30"; luôn 24 giờ, không AM/PM.
                      const v = e.target.value.replace(/[^\d:]/g, '')
                      setGio(
                        /^\d{3,4}$/.test(v)
                          ? `${v.slice(0, -2).padStart(2, '0')}:${v.slice(-2)}`
                          : v,
                      )
                    }}
                    className={cn(o, 'num w-full')}
                    style={{ textAlign: 'left' }}
                  />
                </label>
                <div>
                  <span className={lab}>Là lượt</span>
                  <div className="flex h-[30px] items-center gap-4">
                    {(['in', 'out'] as const).map((c) => (
                      <label key={c} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="chieu"
                          checked={chieu === c}
                          onChange={() => setChieu(c)}
                        />
                        {c === 'in' ? 'Vào' : 'Ra'}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            {loai === 'leave' && (
              <label className="col-span-2">
                <span className={lab}>Loại nghỉ</span>
                <select
                  value={nghi}
                  onChange={(e) => setNghi(e.target.value as LoaiNghi)}
                  className={cn(o, 'w-full')}
                >
                  {LOAI_NGHI.map((v) => (
                    <option key={v} value={v}>
                      {TEN_NGHI[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {loai === 'ignore_punch' && (
              <div className="col-span-2">
                <span className={lab}>Lượt bỏ qua</span>
                <div className="flex flex-wrap gap-3">
                  {mo.luot.map((l) => (
                    <label key={l.gio} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="boqua"
                        checked={boQua === l.gio}
                        onChange={() => setBoQua(l.gio)}
                      />
                      <span className="num">{l.gio.slice(0, 5)}</span>
                      <span className="text-[var(--ink-3)]">{tenMay(l.may)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="col-span-2">
              <span className={lab}>Lý do</span>
              <input
                value={lyDo}
                onChange={(e) => setLyDo(e.target.value)}
                maxLength={200}
                placeholder="Bấm một lý do có sẵn hoặc gõ"
                className={cn(o, 'w-full')}
              />
              <span className="mt-1 flex flex-wrap gap-1">
                {LY_DO[loai].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLyDo(t)}
                    className={cn(
                      'text-k-label border px-1.5 py-0.5',
                      lyDo === t
                        ? 'border-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]'
                        : 'border-[var(--line-faint)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </span>
            </label>
            <label className="col-span-2">
              <span className={lab}>
                Căn cứ{' '}
                <span className="font-normal text-[var(--ink-3)]">(không bắt buộc)</span>
              </span>
              <input
                value={canCu}
                onChange={(e) => setCanCu(e.target.value)}
                maxLength={300}
                placeholder="VD: tổ trưởng xác nhận, đơn nghỉ ngày 07/10"
                className={cn(o, 'w-full')}
              />
            </label>
          </div>

          <p className="mt-3 border-l-2 border-[var(--act)] bg-[var(--surface-raised)] px-2 py-1.5">
            <b>Sau điều chỉnh (khi được duyệt):</b> {sau}
          </p>
          <div className="mt-3 flex items-center justify-end gap-3">
            <span className="text-k-label text-[var(--ink-3)]">
              {thieu ?? 'Gửi xong: Chờ duyệt'}
            </span>
            <SheetActions
              onCancel={onClose}
              onConfirm={gui}
              confirmLabel="Gửi điều chỉnh"
              busy={busy}
              disabled={!!thieu}
            />
          </div>
        </div>
      )}

      <div className={sec}>
        <h3 className="mb-2 font-semibold">Lịch sử điều chỉnh của ngày này</h3>
        {dcs.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-k-label text-left text-[var(--ink-3)]">
                <th className="py-1 font-semibold">Nội dung · lý do</th>
                <th className="py-1 font-semibold">Ai gửi</th>
                <th className="py-1 font-semibold">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {[...dcs].reverse().map((d) => (
                <tr key={d.id} className="border-t border-[var(--line-faint)] align-top">
                  <td className="py-1.5 pr-2">
                    <b className="font-semibold">{moTaDc(d)}</b>
                    <span className="block text-[var(--ink-2)]">
                      {d.lyDo}
                      {d.canCu ? ` · ${d.canCu}` : ''}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {d.nguoiGui ?? '—'}
                    <span className="num text-k-label block text-[var(--ink-3)]">
                      {dmy(d.luc.slice(0, 10))}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <TinhTrang d={d} />
                    {d.tinhTrang === 'pending' && (
                      <span className="mt-1 flex gap-1">
                        {quyen.duyet && d.guiId !== quyen.toi && (
                          <>
                            <Btn primary onClick={() => quyet(d.id, 'duyet')}>
                              Duyệt
                            </Btn>
                            <Btn onClick={() => quyet(d.id, 'tu_choi')}>Từ chối</Btn>
                          </>
                        )}
                        {quyen.duyet && d.guiId === quyen.toi && (
                          <span className="text-[var(--ink-3)]">
                            Phiếu của bạn — người khác duyệt
                          </span>
                        )}
                        {quyen.gui && <Btn onClick={() => quyet(d.id, 'rut')}>Rút</Btn>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[var(--ink-3)]">Chưa có điều chỉnh nào.</p>
        )}
      </div>
    </div>
  )
}

export function TinhTrang({ d }: { d: DieuChinh }) {
  const tone =
    d.tinhTrang === 'approved'
      ? 'text-[var(--done)]'
      : d.tinhTrang === 'pending'
        ? 'text-[var(--warn)]'
        : d.tinhTrang === 'rejected'
          ? 'text-[var(--stop)]'
          : 'text-[var(--ink-3)]'
  return (
    <span className={cn('font-semibold', tone)}>
      {TEN_TINH_TRANG[d.tinhTrang]}
      {d.nguoiDuyet && (
        <span className="text-k-label block font-normal text-[var(--ink-3)]">
          {d.nguoiDuyet}
          {d.ghiChuDuyet ? ` · ${d.ghiChuDuyet}` : ''}
        </span>
      )}
    </span>
  )
}
