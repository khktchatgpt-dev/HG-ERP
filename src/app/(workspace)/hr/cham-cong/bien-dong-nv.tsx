'use client'

import { useEffect, useState } from 'react'
import {
  Btn,
  Consequence,
  DateInput,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
} from '@/components/kit'
import { api } from '@/lib/api'
import {
  LY_DO_NGHI,
  ngaySau,
  ngayVn,
  TEN_BIEN_DONG,
  TEN_LY_DO_NGHI,
  tinhTrangLam,
  type LyDoNghi,
} from '@/lib/nhan-su/bien-dong'
import type { NvDong } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { BienDongDong } from '@/modules/dept/hr/cham-cong/bien-dong.repo'
import type { NhanVienCtx } from './useNhanVien'

/**
 * Biến động vào / ra / chuyển trên hồ sơ một người (Hồ sơ nhân viên B1, bản vẽ duyệt
 * 19/10/2026). Tình trạng suy từ ngày, không gõ tay; mỗi việc có ngày + lý do + vết.
 */

const lyDo = (r: string | null) => (r ? (TEN_LY_DO_NGHI[r as LyDoNghi] ?? r) : '')

/** Một dòng dưới tên: đang làm từ … / làm tới … / đã nghỉ từ …. */
export function TinhTrang({ n, homNay }: { n: NvDong; homNay: string }) {
  const t = tinhTrangLam({ hireDate: n.ngayVao, leaveDate: n.ngayCuoi }, homNay)
  const cls = 'text-k-label'
  if (t === 'da_nghi' || !n.active)
    return (
      <div className={`${cls} text-[var(--stop)]`}>
        Đã nghỉ{n.ngayCuoi ? ` từ ${ngayVn(ngaySau(n.ngayCuoi))}` : ''}
        {n.lyDoNghi ? ` · ${lyDo(n.lyDoNghi)}` : ''}
      </div>
    )
  if (t === 'sap_nghi')
    return (
      <div className={`${cls} text-[var(--warn)]`}>
        Làm tới hết {ngayVn(n.ngayCuoi)} · {lyDo(n.lyDoNghi)}
      </div>
    )
  if (t === 'chua_vao')
    return (
      <div className={`${cls} text-[var(--ink-2)]`}>Vào làm từ {ngayVn(n.ngayVao)}</div>
    )
  return (
    <div className={`${cls} text-[var(--done)]`}>
      Đang làm{n.ngayVao ? ` từ ${ngayVn(n.ngayVao)}` : ' · chưa có ngày vào'}
    </div>
  )
}

type Hop = null | 'nghi' | 'lam_lai' | 'chuyen'

export function BienDongNv({ v, n }: { v: NhanVienCtx; n: NvDong }) {
  const [hop, setHop] = useState<Hop>(null)
  const [ds, setDs] = useState<BienDongDong[] | null>(null)

  // Tải lại vết khi hồ sơ đổi sau router.refresh (biến động vừa ghi).
  useEffect(() => {
    let huy = false
    api<{ ds: BienDongDong[] }>(`/api/dept/hr/cham-cong/nhan-vien/${n.id}/bien-dong`)
      .then((r) => !huy && setDs(r.ds))
      .catch(() => !huy && setDs([]))
    return () => {
      huy = true
    }
  }, [n.id, n.active, n.ngayVao, n.ngayCuoi, n.boPhan, n.chucDanh])

  return (
    <div className="border-b border-[var(--line)] px-3.5 py-2">
      <div className="text-k-sm mb-1.5 font-semibold">Vào / ra</div>
      <div className="flex flex-wrap gap-1.5">
        {n.active && !n.ngayCuoi && (
          <>
            <Btn onClick={() => setHop('nghi')}>Cho nghỉ việc</Btn>
            <Btn onClick={() => setHop('chuyen')}>Chuyển tổ / chức danh</Btn>
          </>
        )}
        {n.ngayCuoi && (
          <Btn
            busy={v.busy}
            onClick={() =>
              v.bienDong(n.id, { viec: 'huy_nghi' }, `Đã huỷ cho nghỉ ${n.hoTen}`)
            }
          >
            Huỷ cho nghỉ
          </Btn>
        )}
        {!n.active && <Btn onClick={() => setHop('lam_lai')}>Đi làm lại</Btn>}
      </div>

      <ul className="text-k-label mt-2 space-y-1">
        {ds == null ? (
          <li className="text-[var(--ink-3)]">Đang tải…</li>
        ) : ds.length === 0 ? (
          <li className="text-[var(--ink-3)]">
            Chưa có biến động nào — ghi ngày vào làm ở trên để có mốc Tuyển vào.
          </li>
        ) : (
          ds.map((b) => (
            <li key={b.id} className={b.huyLuc ? 'text-[var(--ink-3)] line-through' : ''}>
              <span className="num mr-1.5">{ngayVn(b.ngay)}</span>
              {TEN_BIEN_DONG[b.loai]}
              {b.lyDo ? ` · ${lyDo(b.lyDo)}` : ''}
              {b.loai === 'transfer' && b.sau ? ` → ${moTaChuyen(b.sau)}` : ''}
              {b.ghiChu ? ` · ${b.ghiChu}` : ''}
              <span className="block text-[var(--ink-3)]">
                {b.nguoi ?? 'hệ thống'}
                {b.huyLuc ? ' · đã huỷ' : ''}
              </span>
            </li>
          ))
        )}
      </ul>

      {hop === 'nghi' && <HopNghi v={v} n={n} dong={() => setHop(null)} />}
      {hop === 'lam_lai' && <HopLamLai v={v} n={n} dong={() => setHop(null)} />}
      {hop === 'chuyen' && <HopChuyen v={v} n={n} dong={() => setHop(null)} />}
    </div>
  )
}

function moTaChuyen(sau: unknown): string {
  const x = sau as { team?: string | null; job_title?: string | null }
  return [x.team, x.job_title].filter(Boolean).join(' · ')
}

const LUOI = 'text-k-sm grid grid-cols-[130px_1fr] items-center gap-x-2 gap-y-2'
const NHAN = 'text-[var(--ink-3)]'
const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'

function HopNghi({ v, n, dong }: { v: NhanVienCtx; n: NvDong; dong: () => void }) {
  const [ngay, setNgay] = useState(v.homNay)
  const [ly, setLy] = useState<LyDoNghi>('resign')
  const [ghi, setGhi] = useState('')
  const truocVao = !!(n.ngayVao && ngay && ngay < n.ngayVao)
  async function luu() {
    if (!ngay || truocVao) return
    const ok = await v.bienDong(
      n.id,
      { viec: 'nghi', leave_date: ngay, reason: ly, note: ghi },
      `Đã cho ${n.hoTen} nghỉ sau ${ngayVn(ngay)}`,
    )
    if (ok) dong()
  }
  return (
    <Sheet
      open
      onClose={dong}
      title={`Cho nghỉ việc · ${n.code} ${n.hoTen}`}
      subtitle={`${n.boPhan ?? '(chưa có tổ)'} · vào làm ${ngayVn(n.ngayVao)}`}
      stakes="vua"
      footer={
        <SheetActions
          onCancel={dong}
          onConfirm={luu}
          cancelLabel="Để sau"
          confirmLabel={ngay ? `Cho nghỉ từ ${ngayVn(ngaySau(ngay))}` : 'Cho nghỉ'}
          disabled={!ngay || truocVao}
          busy={v.busy}
        />
      }
    >
      <div className={LUOI}>
        <span className={NHAN}>Ngày làm việc cuối</span>
        <DateInput label="Ngày làm việc cuối" value={ngay} onChange={setNgay} />
        <span className={NHAN}>Lý do</span>
        <Pick
          label="Lý do nghỉ"
          width={220}
          value={ly}
          onChange={(x) => setLy(x as LyDoNghi)}
          options={LY_DO_NGHI.map((l) => ({ value: l, label: TEN_LY_DO_NGHI[l] }))}
        />
        <span className={NHAN}>Ghi chú</span>
        <TextInput label="Ghi chú" value={ghi} onCommit={setGhi} className={O} />
      </div>
      {truocVao && (
        <p className="text-k-sm mt-2 text-[var(--stop)]">
          Ngày làm cuối trước ngày vào {ngayVn(n.ngayVao)} — chọn ngày từ{' '}
          {ngayVn(n.ngayVao)}.
        </p>
      )}
      {ngay && !truocVao && (
        <Consequence>
          Kỳ công và bảng lương tính {n.hoTen} tới hết {ngayVn(ngay)}; từ{' '}
          {ngayVn(ngaySau(ngay))} không còn trong danh sách chấm công.{' '}
          {n.taiKhoan?.mo
            ? `Tài khoản ERP ${n.taiKhoan.email} tự khoá từ ${ngayVn(ngaySau(ngay))}.`
            : 'Không có tài khoản ERP đang mở.'}{' '}
          Ngày rơi vào kỳ công đã chốt thì bị chặn. Ghi nhầm thì Huỷ cho nghỉ khi kỳ chưa
          chốt; quay lại làm thì Đi làm lại, giữ mã {n.code}.
        </Consequence>
      )}
    </Sheet>
  )
}

function HopLamLai({ v, n, dong }: { v: NhanVienCtx; n: NvDong; dong: () => void }) {
  const [ngay, setNgay] = useState(v.homNay)
  const [ghi, setGhi] = useState('')
  const sai = !!(n.ngayCuoi && ngay && ngay <= n.ngayCuoi)
  async function luu() {
    if (!ngay || sai) return
    const ok = await v.bienDong(
      n.id,
      { viec: 'lam_lai', hire_date: ngay, note: ghi },
      `${n.hoTen} đi làm lại từ ${ngayVn(ngay)}`,
    )
    if (ok) dong()
  }
  return (
    <Sheet
      open
      onClose={dong}
      title={`Đi làm lại · ${n.code} ${n.hoTen}`}
      subtitle={`Đã nghỉ sau ${ngayVn(n.ngayCuoi)}${n.lyDoNghi ? ` · ${lyDo(n.lyDoNghi)}` : ''}`}
      stakes="vua"
      footer={
        <SheetActions
          onCancel={dong}
          onConfirm={luu}
          cancelLabel="Để sau"
          confirmLabel="Đi làm lại"
          disabled={!ngay || sai}
          busy={v.busy}
        />
      }
    >
      <div className={LUOI}>
        <span className={NHAN}>Ngày vào lại</span>
        <DateInput label="Ngày vào lại" value={ngay} onChange={setNgay} />
        <span className={NHAN}>Ghi chú</span>
        <TextInput label="Ghi chú" value={ghi} onCommit={setGhi} className={O} />
      </div>
      {sai && (
        <p className="text-k-sm mt-2 text-[var(--stop)]">
          Ngày vào lại phải sau ngày làm cuối {ngayVn(n.ngayCuoi)}.
        </p>
      )}
      <Consequence>
        Giữ mã {n.code}; có mặt trong kỳ công từ ngày vào lại. Đoạn làm cũ vẫn nằm trong
        vết biến động.{' '}
        {n.taiKhoan && !n.taiKhoan.mo
          ? `Tài khoản ERP ${n.taiKhoan.email} vẫn khoá — nhờ Admin mở lại.`
          : ''}
      </Consequence>
    </Sheet>
  )
}

function HopChuyen({ v, n, dong }: { v: NhanVienCtx; n: NvDong; dong: () => void }) {
  const [ngay, setNgay] = useState(v.homNay)
  const [to, setTo] = useState(n.boPhan ?? '')
  const [cd, setCd] = useState(n.chucDanh ?? '')
  const [ghi, setGhi] = useState('')
  const doi = (to.trim() || null) !== n.boPhan || (cd.trim() || null) !== n.chucDanh
  async function luu() {
    if (!ngay || !doi) return
    const ok = await v.bienDong(
      n.id,
      {
        viec: 'chuyen',
        effective_date: ngay,
        team: to.trim(),
        job_title: cd.trim(),
        note: ghi,
      },
      `Đã chuyển ${n.hoTen}`,
    )
    if (ok) dong()
  }
  return (
    <Sheet
      open
      onClose={dong}
      title={`Chuyển tổ / chức danh · ${n.code} ${n.hoTen}`}
      subtitle={`Hiện: ${n.boPhan ?? '(chưa có tổ)'}${n.chucDanh ? ` · ${n.chucDanh}` : ''}`}
      stakes="vua"
      footer={
        <SheetActions
          onCancel={dong}
          onConfirm={luu}
          cancelLabel="Để sau"
          confirmLabel="Chuyển"
          disabled={!ngay || !doi}
          busy={v.busy}
        />
      }
    >
      <div className={LUOI}>
        <span className={NHAN}>Hiệu lực từ</span>
        <DateInput label="Hiệu lực từ" value={ngay} onChange={setNgay} />
        <span className={NHAN}>Tổ mới</span>
        <TextInput
          label="Tổ mới"
          value={to}
          onCommit={setTo}
          className={O}
          list="hr-bo-phan"
        />
        <span className={NHAN}>Chức danh mới</span>
        <TextInput
          label="Chức danh mới"
          value={cd}
          onCommit={setCd}
          className={O}
          list="hr-chuc-danh"
        />
        <span className={NHAN}>Ghi chú</span>
        <TextInput label="Ghi chú" value={ghi} onCommit={setGhi} className={O} />
      </div>
      {!doi && (
        <p className="text-k-label mt-2 text-[var(--ink-3)]">
          Đổi tổ hoặc chức danh để chuyển.
        </p>
      )}
      <Consequence>
        Ghi vết chuyển từ {ngayVn(ngay)} và đổi ngay trên hồ sơ. Bảng công hiện xếp người
        theo tổ hiện tại cho cả kỳ; chia theo ngày hiệu lực sẽ làm sau. Sửa chính tả tên
        tổ thì sửa thẳng ở ô Bộ phận / Tổ, không cần chuyển.
      </Consequence>
    </Sheet>
  )
}
