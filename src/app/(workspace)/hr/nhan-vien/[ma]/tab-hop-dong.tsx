'use client'

import { useRef, useState } from 'react'
import {
  Btn,
  Consequence,
  DateInput,
  Empty,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  TextInput,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { apiErrorText } from '@/lib/api'
import { uploadFileTracked } from '@/lib/upload'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import {
  canhBaoHd,
  LOAI_HD,
  soNgay,
  TEN_LOAI_HD,
  TEN_TINH_TRANG_HD,
  tinhTrangHd,
  type LoaiHd,
  type TinhTrangHd,
} from '@/lib/nhan-su/hop-dong'
import type { HdDong } from '@/modules/dept/hr/cham-cong/hop-dong.repo'
import { TD, TH } from '../nv.shared'
import { KhoaRieng } from './tab-ca-nhan'
import type { HoSoCtx } from './useHoSoNv'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'
const tien = (n: number | null) => (n == null ? '' : n.toLocaleString('vi-VN'))
/** "12.000.000" / "12000000" → 12000000; rỗng → null; sai → undefined. */
const docTien = (s: string) => {
  const t = s.replace(/[\s.đ₫]/gi, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const TONE: Record<TinhTrangHd, 'done' | 'warn' | 'stop' | 'neutral' | 'run'> = {
  hieu_luc: 'done',
  sap_het: 'warn',
  het_han: 'stop',
  chua_hieu_luc: 'run',
  huy: 'neutral',
}

/**
 * Hợp đồng lao động (B3, bản vẽ lượt 2): HĐ đang hiệu lực đứng đầu, sắp hết hạn tô vàng.
 * Không lập mẫu in (Q2 lượt 1) — chỉ lưu bản đã ký (file scan) + các ngày để nhắc hết hạn.
 */
export function TabHopDong({ d }: { d: HoSoCtx }) {
  const ds = d.h.hopDong
  if (!ds)
    return (
      <KhoaRieng viec="Chỉ Phòng Nhân sự và Ban Giám đốc xem được hợp đồng (có mức lương)." />
    )
  const thu = (t: TinhTrangHd) =>
    ({ sap_het: 0, hieu_luc: 1, chua_hieu_luc: 2, het_han: 3, huy: 4 })[t]
  const xep = [...ds].sort(
    (a, b) =>
      thu(tinhTrangHd(a, d.homNay)) - thu(tinhTrangHd(b, d.homNay)) ||
      (a.tuNgay < b.tuNgay ? 1 : -1),
  )
  const sua = d.h.quyen.rieng
  return (
    <div className="min-h-0 overflow-auto">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-1.5">
        <span className="text-k-sm text-[var(--ink-2)]">
          Lưu bản đã ký + các ngày để nhắc hết hạn trước {30} ngày. Lương tính bảng lương
          lấy ở Hồ sơ lương.
        </span>
        <span className="ml-auto">
          <Btn
            primary
            icon="them"
            onClick={() => d.setHopHd({ moi: true })}
            blockedBy={sua ? undefined : 'Phòng Nhân sự'}
          >
            Thêm hợp đồng
          </Btn>
        </span>
      </div>
      {xep.length === 0 ? (
        <Empty
          level={2}
          headline="Chưa có hợp đồng nào"
          reason={`${d.n.hoTen} chưa được ghi hợp đồng lao động trên hệ thống.`}
          next={<Btn onClick={() => d.setHopHd({ moi: true })}>Thêm hợp đồng</Btn>}
        />
      ) : (
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Số HĐ</th>
              <th className={TH}>Loại</th>
              <th className={TH}>Từ ngày</th>
              <th className={TH}>Đến ngày</th>
              <th className={TH} style={{ textAlign: 'right' }}>
                Còn lại
              </th>
              <th className={TH}>Chức danh</th>
              <th className={TH} style={{ textAlign: 'right' }}>
                Lương ghi trên HĐ
              </th>
              <th className={TH}>Bản ký</th>
              <th className={TH}>Tình trạng</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {xep.map((h) => {
              const tt = tinhTrangHd(h, d.homNay)
              return (
                <tr
                  key={h.id}
                  className={cn(
                    tt === 'sap_het' && 'bg-[var(--warn-wash)]',
                    tt === 'huy' && 'text-[var(--ink-3)] line-through',
                  )}
                >
                  <td className={cn(TD, 'num')}>{h.so ?? '—'}</td>
                  <td className={TD}>{TEN_LOAI_HD[h.loai]}</td>
                  <td className={cn(TD, 'num')}>{ngayVn(h.tuNgay)}</td>
                  <td className={cn(TD, 'num')}>
                    {h.denNgay ? ngayVn(h.denNgay) : 'không thời hạn'}
                  </td>
                  <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                    {h.denNgay && (tt === 'hieu_luc' || tt === 'sap_het')
                      ? `${soNgay(d.homNay, h.denNgay)} ngày`
                      : ''}
                  </td>
                  <td className={TD}>{h.chucDanh ?? ''}</td>
                  <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                    {tien(h.luong)}
                  </td>
                  <td className={TD}>
                    {h.fileId ? (
                      <button
                        type="button"
                        className="text-[var(--act-text)] underline"
                        onClick={() => d.moFile(h.fileId!)}
                      >
                        Xem
                      </button>
                    ) : (
                      <span className="text-[var(--warn)] no-underline">
                        chưa có scan
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    <Tag tone={TONE[tt]}>{TEN_TINH_TRANG_HD[tt]}</Tag>
                    {h.huy && h.huyLyDo && (
                      <span className="text-k-label ml-1.5 no-underline">
                        {h.huyLyDo}
                      </span>
                    )}
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    {!h.huy && sua && (
                      <span className="flex justify-end gap-1">
                        <Btn onClick={() => d.setHopHd({ sua: h })}>Sửa</Btn>
                        <Btn onClick={() => d.setHopHd({ huy: h })}>Huỷ</Btn>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={10}
                className={cn(
                  TD,
                  'sticky bottom-0 bg-[var(--surface-raised)] whitespace-normal text-[var(--ink-2)]',
                )}
              >
                {ds.filter((h) => !h.huy).length} hợp đồng ·{' '}
                {ds.filter((h) => h.huy).length} đã huỷ (ghi nhầm, giữ lại để tra). Lương
                ghi trên HĐ chỉ để đối chiếu, không vào bảng lương.
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {d.hopHd && 'huy' in d.hopHd && <HopHuy d={d} h={d.hopHd.huy} />}
      {d.hopHd && !('huy' in d.hopHd) && (
        <HopHd
          key={'sua' in d.hopHd ? d.hopHd.sua.id : 'moi'}
          d={d}
          cu={'sua' in d.hopHd ? d.hopHd.sua : null}
        />
      )}
    </div>
  )
}

function HopHd({ d, cu }: { d: HoSoCtx; cu: HdDong | null }) {
  const [so, setSo] = useState(cu?.so ?? '')
  const [loai, setLoai] = useState<LoaiHd>(cu?.loai ?? 'fixed')
  const [tu, setTu] = useState(cu?.tuNgay ?? d.homNay)
  const [den, setDen] = useState(cu?.denNgay ?? '')
  const [cd, setCd] = useState(cu?.chucDanh ?? d.n.chucDanh ?? '')
  const [luong, setLuong] = useState(cu?.luong != null ? tien(cu.luong) : '')
  const [ghi, setGhi] = useState(cu?.ghiChu ?? '')
  const [file, setFile] = useState<{ id: string; ten: string } | null>(
    cu?.fileId ? { id: cu.fileId, ten: cu.fileTen ?? 'bản ký' } : null,
  )
  const [tai, setTai] = useState<number | null>(null)
  const chon = useRef<HTMLInputElement>(null)
  const khongHan = loai === 'indefinite'
  const so_ = docTien(luong)
  const loi = !tu
    ? 'Chọn ngày bắt đầu'
    : !khongHan && !den
      ? `${TEN_LOAI_HD[loai]} cần ngày kết thúc`
      : !khongHan && den < tu
        ? 'Ngày kết thúc trước ngày bắt đầu'
        : so_ === undefined
          ? 'Lương chưa đúng — gõ số, ví dụ 8.500.000'
          : null
  const canhBao = loi
    ? []
    : canhBaoHd({ loai, tuNgay: tu, denNgay: khongHan ? null : den })

  async function taiLen(f: File) {
    setTai(0)
    try {
      const id = await uploadFileTracked(
        f,
        { kind: 'hr_employee', id: d.n.id },
        'private',
        'hr_contract',
        setTai,
      )
      setFile({ id, ten: f.name })
    } catch (e) {
      d.toast.error('Chưa tải được bản ký', apiErrorText(e))
    } finally {
      setTai(null)
    }
  }

  async function luu() {
    if (loi) return
    const hd = {
      so: so.trim() || null,
      loai,
      tuNgay: tu,
      denNgay: khongHan ? null : den,
      chucDanh: cd.trim() || null,
      luong: so_ ?? null,
      ghiChu: ghi.trim() || null,
      fileId: file?.id ?? null,
    }
    await d.guiHd(
      cu ? { viec: 'sua', id: cu.id, hd } : { viec: 'them', hd },
      cu ? 'Đã sửa hợp đồng' : 'Đã thêm hợp đồng',
    )
  }

  return (
    <Sheet
      open
      onClose={() => d.setHopHd(null)}
      title={cu ? `Sửa hợp đồng${cu.so ? ` · ${cu.so}` : ''}` : 'Thêm hợp đồng lao động'}
      subtitle={`${d.n.code} · ${d.n.hoTen}`}
      stakes="vua"
      width={520}
      footer={
        <SheetActions
          onCancel={() => d.setHopHd(null)}
          onConfirm={luu}
          cancelLabel="Để sau"
          confirmLabel={cu ? 'Lưu hợp đồng' : 'Thêm hợp đồng'}
          disabled={!!loi || tai != null}
          busy={d.busy}
        />
      }
    >
      <div className="text-k-sm grid grid-cols-[140px_1fr] items-center gap-x-2 gap-y-2">
        <span className="text-[var(--ink-3)]">Số hợp đồng</span>
        <TextInput
          label="Số hợp đồng"
          value={so}
          onCommit={setSo}
          className={O}
          mono
          placeholder="vd 125/2026/HĐLĐ"
        />
        <span className="text-[var(--ink-3)]">Loại</span>
        <Pick
          label="Loại hợp đồng"
          width={240}
          value={loai}
          onChange={(v) => setLoai(v as LoaiHd)}
          options={LOAI_HD.map((l) => ({ value: l, label: TEN_LOAI_HD[l] }))}
        />
        <span className="text-[var(--ink-3)]">Từ ngày</span>
        <DateInput label="Từ ngày" value={tu} onChange={setTu} />
        <span className="text-[var(--ink-3)]">Đến ngày</span>
        {khongHan ? (
          <span className="text-[var(--ink-3)]">không thời hạn</span>
        ) : (
          <DateInput label="Đến ngày" value={den} onChange={setDen} />
        )}
        <span className="text-[var(--ink-3)]">Chức danh trên HĐ</span>
        <TextInput
          label="Chức danh trên HĐ"
          value={cd}
          onCommit={setCd}
          className={O}
          list="hr-chuc-danh"
        />
        <span className="text-[var(--ink-3)]">Lương ghi trên HĐ</span>
        <TextInput
          label="Lương ghi trên HĐ"
          value={luong}
          onCommit={setLuong}
          className={O}
          mono
          placeholder="vd 8.500.000 (bỏ trống được)"
        />
        <span className="text-[var(--ink-3)]">Ghi chú</span>
        <TextInput label="Ghi chú" value={ghi} onCommit={setGhi} className={O} />
        <span className="text-[var(--ink-3)]">Bản ký (scan)</span>
        <span className="flex items-center gap-2">
          {file ? (
            <button
              type="button"
              className="text-[var(--act-text)] underline"
              onClick={() => d.moFile(file.id)}
            >
              {file.ten}
            </button>
          ) : (
            <span className="text-[var(--ink-3)]">chưa có</span>
          )}
          <input
            ref={chon}
            type="file"
            hidden
            accept=".pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void taiLen(f)
            }}
          />
          <Btn busy={tai != null} onClick={() => chon.current?.click()}>
            {tai != null ? `Đang tải ${tai}%` : file ? 'Đổi file' : 'Chọn file'}
          </Btn>
        </span>
      </div>
      {loi && <p className="text-k-sm mt-2 text-[var(--ink-2)]">Còn thiếu: {loi}.</p>}
      {canhBao.map((c) => (
        <p
          key={c}
          className="text-k-sm mt-2 border-l-2 border-[var(--warn)] bg-[var(--warn-wash)] py-1 pl-2 text-[var(--ink-2)]"
        >
          {c}. Vẫn lưu được nếu đúng thực tế.
        </p>
      ))}
      <Consequence>
        Hợp đồng chồng thời gian với HĐ khác chưa huỷ thì bị chặn. Danh sách nhân viên
        nhắc khi còn 30 ngày là hết hạn. Ghi nhầm thì huỷ (giữ lại để tra), không xoá.
      </Consequence>
    </Sheet>
  )
}

function HopHuy({ d, h }: { d: HoSoCtx; h: HdDong }) {
  const [lyDo, setLyDo] = useState('')
  const ok = lyDo.trim().length >= 3
  return (
    <Sheet
      open
      onClose={() => d.setHopHd(null)}
      title={`Huỷ hợp đồng${h.so ? ` · ${h.so}` : ''}`}
      subtitle={`${TEN_LOAI_HD[h.loai]} · ${ngayVn(h.tuNgay)} – ${h.denNgay ? ngayVn(h.denNgay) : 'không thời hạn'}`}
      stakes="nang"
      footer={
        <SheetActions
          stakes="nang"
          onCancel={() => d.setHopHd(null)}
          onConfirm={() =>
            ok && d.guiHd({ viec: 'huy', id: h.id, lyDo: lyDo.trim() }, 'Đã huỷ hợp đồng')
          }
          cancelLabel="Để sau"
          confirmLabel="Huỷ hợp đồng"
          disabled={!ok}
          busy={d.busy}
        />
      }
    >
      <div className="text-k-sm grid grid-cols-[100px_1fr] items-center gap-x-2">
        <span className="text-[var(--ink-3)]">Lý do</span>
        <TextInput
          label="Lý do huỷ"
          value={lyDo}
          onCommit={setLyDo}
          className={O}
          placeholder="vd ghi nhầm ngày, nhập trùng"
          autoFocus
        />
      </div>
      <Consequence>
        Huỷ là cho HĐ GHI NHẦM. Người nghỉ việc thì dùng Biến động › Cho nghỉ việc, không
        huỷ hợp đồng. HĐ huỷ vẫn hiện (gạch ngang) cùng lý do.
      </Consequence>
    </Sheet>
  )
}
