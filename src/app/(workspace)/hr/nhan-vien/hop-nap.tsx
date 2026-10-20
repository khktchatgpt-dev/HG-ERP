'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Consequence,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  Tick,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { TEN_COT_NAP, type CotNapNv, type DoiO } from '@/lib/nhan-su/nap-ho-so'
import type {
  XemNapNv,
  DongXemNapNv,
} from '@/modules/dept/hr/cham-cong/nap-ho-so.service'
import { TD, TH } from './nv.shared'
import type { DsCtx } from './useNhanVienDs'

const NGAY: CotNapNv[] = ['ngayVao', 'ngaySinh', 'ngayCap']
const hien = (c: CotNapNv, v: string | null) =>
  v == null
    ? '—'
    : NGAY.includes(c)
      ? ngayVn(v)
      : c === 'gioiTinh'
        ? v === 'male'
          ? 'Nam'
          : 'Nữ'
        : v

function DsDoi({ ds, mo = false }: { ds: DoiO[]; mo?: boolean }) {
  return (
    <span className={cn('flex flex-col gap-0.5', mo && 'text-[var(--ink-3)]')}>
      {ds.map((o) => (
        <span key={o.cot}>
          <b className="font-semibold">{TEN_COT_NAP[o.cot]}</b>{' '}
          {o.cu != null && <span className="line-through">{hien(o.cot, o.cu)}</span>}
          {o.cu != null && ' → '}
          {hien(o.cot, o.moi)}
        </span>
      ))}
    </span>
  )
}

/**
 * Nhập hồ sơ nhân viên từ Excel (B4, bản vẽ lượt 2): DÁN vùng có dòng tiêu đề → xem trước từng
 * dòng (người khớp, ô đổi, ô giữ nguyên, ô lỗi) → ghi. Chỉ cập nhật người đã có. Mẫu: nút Xuất
 * sổ lao động (tiêu đề cột khớp sẵn). Dùng luôn cho gợi ý chức danh từ file CCCD (cột Bộ phận).
 */
export function HopNap({ d }: { d: DsCtx }) {
  const router = useRouter()
  const toast = useToast()
  const [text, setText] = useState('')
  const [ghiDe, setGhiDe] = useState(false)
  const [xem, setXem] = useState<XemNapNv | null>(null)
  const [chon, setChon] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const coNguoi = (r: DongXemNapNv) =>
    chon[r.dong] ?? (r.khop.kieu === 'khop' ? r.khop.nguoi.id : null)
  const ghiDuoc = xem
    ? xem.dong.filter((r) => coNguoi(r) && (r.doi.length || chon[r.dong]))
    : []
  const soO = ghiDuoc.reduce((s, r) => s + r.doi.length, 0)

  async function goi<T>(body: Record<string, unknown>): Promise<T | null> {
    setBusy(true)
    try {
      return await api<T>('/api/dept/hr/cham-cong/nhan-vien/nap', {
        method: 'POST',
        body,
      })
    } catch (e) {
      toast.error('Không đọc được', apiErrorText(e))
      return null
    } finally {
      setBusy(false)
    }
  }
  async function doc(gd = ghiDe) {
    const r = await goi<XemNapNv>({ viec: 'xem', text, ghiDe: gd, chon })
    if (r) setXem(r)
  }
  async function ghi() {
    const r = await goi<{
      nguoi: number
      o: number
      loi: { dong: number; loi: string }[]
    }>({
      viec: 'ghi',
      text,
      ghiDe,
      chon: Object.fromEntries(Object.entries(chon).map(([k, v]) => [k, v])),
    })
    if (!r) return
    toast.success(`Đã cập nhật ${r.nguoi} người · ${r.o} ô`)
    for (const l of r.loi.slice(0, 5)) toast.error(`Dòng ${l.dong} chưa ghi`, l.loi)
    router.refresh()
    if (!r.loi.length) d.setMoNap(false)
    else await doc()
  }

  const dem = xem
    ? {
        doi: xem.dong.filter((r) => r.khop.kieu === 'khop' && r.doi.length).length,
        khongDoi: xem.dong.filter((r) => r.khop.kieu === 'khop' && !r.doi.length).length,
        nhieu: xem.dong.filter((r) => r.khop.kieu === 'nhieu').length,
        khong: xem.dong.filter((r) => r.khop.kieu === 'khong').length,
        loi: xem.dong.filter((r) => r.loi.length).length,
      }
    : null
  const tatCa = d.h.nv.ds.map((n) => ({
    value: n.id,
    label: `${n.code} · ${n.hoTen}${n.boPhan ? ` · ${n.boPhan}` : ''}`,
  }))

  return (
    <Sheet
      open
      onClose={() => d.setMoNap(false)}
      title="Nhập hồ sơ nhân viên từ Excel"
      subtitle="Dán vùng có dòng tiêu đề — chỉ cập nhật người đã có trong danh sách"
      stakes="vua"
      width={860}
      footer={
        xem ? (
          <SheetActions
            onCancel={() => {
              setXem(null)
              setChon({})
            }}
            onConfirm={ghi}
            cancelLabel="Dán lại"
            confirmLabel={`Ghi ${ghiDuoc.length} người · ${soO} ô`}
            disabled={!ghiDuoc.length}
            busy={busy}
          />
        ) : (
          <SheetActions
            onCancel={() => d.setMoNap(false)}
            onConfirm={() => doc()}
            cancelLabel="Để sau"
            confirmLabel="Đọc và xem trước"
            disabled={!text.trim()}
            busy={busy}
          />
        )
      }
    >
      {!xem ? (
        <>
          <p className="text-k-sm text-[var(--ink-2)]">
            Trong Excel: chọn cả vùng (gồm dòng tiêu đề) → Ctrl+C → dán vào ô dưới. Cột
            nhận theo tên: Mã NV, Họ tên, Tổ, Chức danh, Ngày vào làm, Ngày sinh, Giới
            tính, Số CCCD, Ngày cấp, Nơi cấp, Mã số thuế, Thường trú, Điện thoại, Liên hệ
            khẩn cấp… Cột lạ (STT, Ký nhận) bỏ qua. Không có Mã NV thì khớp theo họ tên.
            Cột &quot;Bộ phận&quot; được hiểu là chức danh.
          </p>
          <div className="mt-2">
            <TextArea
              value={text}
              onChange={setText}
              rows={10}
              aria-label="Vùng dán từ Excel"
              placeholder="Dán ở đây…"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Btn href="/api/dept/hr/cham-cong/nhan-vien/excel">
              Tải mẫu (sổ lao động hiện tại)
            </Btn>
            <span className="text-k-sm flex items-center gap-1.5 text-[var(--ink-2)]">
              <Tick checked={ghiDe} onChange={setGhiDe} label="Ghi đè giá trị đang có" />
              Ghi đè giá trị đang có (mặc định chỉ điền ô đang trống)
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="text-k-sm mb-2 flex flex-wrap items-center gap-2">
            <Tag tone="done">{dem!.doi} người có thay đổi</Tag>
            <Tag tone="neutral">{dem!.khongDoi} không đổi gì</Tag>
            {dem!.nhieu > 0 && <Tag tone="warn">{dem!.nhieu} trùng tên — chọn người</Tag>}
            {dem!.khong > 0 && (
              <Tag tone="stop">{dem!.khong} không thấy trong danh sách</Tag>
            )}
            {dem!.loi > 0 && <Tag tone="warn">{dem!.loi} dòng có ô sai định dạng</Tag>}
            <span className="ml-auto flex items-center gap-1.5 text-[var(--ink-2)]">
              <Tick
                checked={ghiDe}
                onChange={(v) => {
                  setGhiDe(v)
                  void doc(v)
                }}
                label="Ghi đè giá trị đang có"
              />
              Ghi đè giá trị đang có
            </span>
          </div>
          {xem.boQua.length > 0 && (
            <p className="text-k-sm mb-2 border-l-2 border-[var(--warn)] bg-[var(--warn-wash)] py-1 pl-2">
              Bỏ qua {xem.boQua.map((c) => TEN_COT_NAP[c]).join(', ')}: bạn không có quyền
              ghi thông tin cá nhân (chỉ Phòng Nhân sự, Ban Giám đốc).
            </p>
          )}
          <div className="max-h-[52vh] overflow-auto border border-[var(--line)]">
            <table className="text-k-sm w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={TH}>Dòng</th>
                  <th className={TH}>Trong file</th>
                  <th className={TH}>Người</th>
                  <th className={TH}>Sẽ ghi</th>
                  <th className={TH}>Giữ nguyên / lỗi</th>
                </tr>
              </thead>
              <tbody>
                {xem.dong.map((r) => (
                  <tr key={r.dong} className={cn(!coNguoi(r) && 'text-[var(--ink-3)]')}>
                    <td className={cn(TD, 'num align-top')}>{r.dong}</td>
                    <td className={cn(TD, 'align-top whitespace-normal')}>
                      <span className="num mr-1.5">{r.ma ?? ''}</span>
                      {r.ten ?? ''}
                    </td>
                    <td className={cn(TD, 'align-top whitespace-normal')}>
                      {r.khop.kieu === 'khop' ? (
                        <span>
                          <span className="num mr-1.5">{r.khop.nguoi.ma}</span>
                          {r.khop.nguoi.ten}
                          <span className="text-k-label ml-1.5 text-[var(--ink-3)]">
                            theo {r.khop.theo === 'ma' ? 'mã' : 'tên'}
                          </span>
                          {r.tenLech && (
                            <span className="text-k-label ml-1.5 text-[var(--warn)]">
                              tên khác hồ sơ
                            </span>
                          )}
                        </span>
                      ) : r.khop.kieu === 'nhieu' ? (
                        <Pick
                          label={`Chọn người cho dòng ${r.dong}`}
                          width={260}
                          value={chon[r.dong] ?? ''}
                          onChange={(v) => setChon((c) => ({ ...c, [r.dong]: v }))}
                          options={[
                            {
                              value: '',
                              label: `${r.khop.ungVien.length} người trùng tên — chọn`,
                            },
                            ...r.khop.ungVien.map((u) => ({
                              value: u.id,
                              label: `${u.ma} · ${u.ten}${u.to ? ` · ${u.to}` : ''}`,
                            })),
                          ]}
                        />
                      ) : (
                        <Pick
                          label={`Chọn người cho dòng ${r.dong}`}
                          width={260}
                          value={chon[r.dong] ?? ''}
                          onChange={(v) => setChon((c) => ({ ...c, [r.dong]: v }))}
                          options={[
                            { value: '', label: 'Không thấy — bỏ qua, hoặc chọn' },
                            ...tatCa,
                          ]}
                        />
                      )}
                    </td>
                    <td className={cn(TD, 'align-top whitespace-normal')}>
                      {r.doi.length ? (
                        <DsDoi ds={r.doi} />
                      ) : chon[r.dong] ? (
                        <span className="text-[var(--ink-3)]">bấm Đọc lại để so</span>
                      ) : (
                        <span className="text-[var(--ink-3)]">—</span>
                      )}
                    </td>
                    <td className={cn(TD, 'align-top whitespace-normal')}>
                      {r.giu.length > 0 && <DsDoi ds={r.giu} mo />}
                      {r.loi.map((l) => (
                        <span key={l} className="block text-[var(--stop)]">
                          {l}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(chon).length > 0 && (
            <div className="mt-2">
              <Btn busy={busy} onClick={() => doc()}>
                Đọc lại với người đã chọn
              </Btn>
            </div>
          )}
          <Consequence>
            Ô trống trong file = không đổi.{' '}
            {ghiDe
              ? 'Đang GHI ĐÈ giá trị có sẵn.'
              : 'Ô đang có giá trị khác thì giữ nguyên (cột phải) — bật Ghi đè nếu file mới đúng hơn.'}{' '}
            Ngày vào rơi vào kỳ công đã chốt thì dòng đó báo lỗi, các dòng khác vẫn ghi.
            Mỗi người ghi một vết &quot;Nhập Excel&quot; ở Lịch sử.
          </Consequence>
        </>
      )}
    </Sheet>
  )
}
