'use client'

import { useState, type ReactNode } from 'react'
import {
  Combobox,
  Consequence,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
  Tick,
} from '@/components/kit'
import type { NvGoc, TkGoc } from '@/lib/nhan-vien-tai-khoan'
import type { NvTkCtx } from './useNhanVienTaiKhoan'
import { matKhauTam, ROLE_LABEL, ROLES } from './nv-tk.shared'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'

export function Hang({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <>
      <span className="text-[var(--ink-3)]">{nhan}</span>
      <div className="min-w-0">{children}</div>
    </>
  )
}
export const Luoi = ({ children }: { children: ReactNode }) => (
  <div className="text-k-sm grid grid-cols-[120px_1fr] items-center gap-x-2 gap-y-2">
    {children}
  </div>
)

function PickPhong({
  d,
  value,
  onChange,
}: {
  d: NvTkCtx
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Pick
      label="Phòng"
      width={260}
      value={value}
      onChange={onChange}
      options={[
        { value: '', label: '(chưa chọn phòng)' },
        ...d.h.phong.map((p) => ({ value: p.id, label: p.name })),
      ]}
    />
  )
}
function PickVaiTro({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Pick
      label="Vai trò"
      width={160}
      value={value}
      onChange={onChange}
      options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
    />
  )
}

/* ─── Cấp tài khoản từ dòng nhân viên ─────────────────────────────────────── */

export function HopCap({ d }: { d: NvTkCtx }) {
  const hop = d.hop?.kieu === 'cap' ? d.hop : null
  return hop ? <HopCapMo key={hop.nv.id} d={d} nv={hop.nv} /> : null
}

function HopCapMo({ d, nv }: { d: NvTkCtx; nv: NvGoc }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employee')
  const [phong, setPhong] = useState(d.h.phongGoiY[nv.id] ?? '')
  const [title, setTitle] = useState('')
  const [mk, setMk] = useState(matKhauTam)
  const [loi, setLoi] = useState<string | null>(null)

  async function cap() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setLoi('Email chưa đúng dạng')
    if (mk.length < 8) return setLoi('Mật khẩu tạm tối thiểu 8 ký tự')
    setLoi(null)
    const r = await d.goi(
      'cap',
      '/api/users/from-employee',
      'POST',
      {
        employee_id: nv.id,
        email: email.trim(),
        password: mk,
        role,
        department_id: phong || null,
        title: title.trim() || null,
      },
      `Đã cấp tài khoản cho ${nv.ten}`,
    )
    if (r) d.dongHop()
  }
  return (
    <Sheet
      open
      onClose={d.dongHop}
      title={`Cấp tài khoản · ${nv.ma}`}
      subtitle={`${nv.ten} · ${nv.to ?? '(chưa có tổ)'}`}
      stakes="vua"
      footer={
        <SheetActions
          onCancel={d.dongHop}
          onConfirm={cap}
          confirmLabel="Cấp tài khoản"
          cancelLabel="Để sau"
          busy={d.busy === 'cap'}
        />
      }
    >
      <Luoi>
        <Hang nhan="Email đăng nhập">
          <TextInput
            label="Email đăng nhập"
            value={email}
            onCommit={setEmail}
            className={O}
            mono
          />
        </Hang>
        <Hang nhan="Vai trò">
          <PickVaiTro value={role} onChange={setRole} />
        </Hang>
        <Hang nhan="Phòng">
          <PickPhong d={d} value={phong} onChange={setPhong} />
          {d.h.phongGoiY[nv.id] && phong === d.h.phongGoiY[nv.id] && (
            <span className="text-k-label ml-2 text-[var(--ink-3)]">gợi ý theo tổ</span>
          )}
        </Hang>
        <Hang nhan="Chức danh">
          <TextInput label="Chức danh" value={title} onCommit={setTitle} className={O} />
        </Hang>
        <Hang nhan="Mật khẩu tạm">
          <TextInput
            label="Mật khẩu tạm"
            value={mk}
            onCommit={setMk}
            className={O}
            mono
          />
        </Hang>
      </Luoi>
      {loi && <p className="text-k-sm mt-2 text-[var(--stop)]">{loi}</p>}
      <Consequence>
        Họ tên lấy từ hồ sơ nhân viên — sửa tên ở Nhân sự. Đưa mật khẩu tạm cho {nv.ten};
        lần đăng nhập đầu hệ thống bắt đổi. Vai trò và phòng quyết định người này thấy gì.
      </Consequence>
    </Sheet>
  )
}

/* ─── Gắn tài khoản chưa gắn người vào một nhân viên ─────────────────────── */

export function HopGan({ d }: { d: NvTkCtx }) {
  const hop = d.hop?.kieu === 'gan' ? d.hop : null
  return hop ? <HopGanMo key={hop.tk.id} d={d} tk={hop.tk} /> : null
}

function HopGanMo({ d, tk }: { d: NvTkCtx; tk: TkGoc }) {
  const [nvId, setNvId] = useState('')
  const nv = d.nvChuaCo.find((n) => n.id === nvId)
  async function gan() {
    if (!nvId) return
    const r = await d.goi(
      'gan',
      `/api/users/${tk.id}/link`,
      'PATCH',
      { employee_id: nvId },
      `Đã gắn ${tk.email} vào ${nv?.ten ?? 'nhân viên'}`,
    )
    if (r) d.dongHop()
  }
  return (
    <Sheet
      open
      onClose={d.dongHop}
      title={`Gắn nhân viên · ${tk.ten ?? tk.email}`}
      subtitle={tk.email}
      stakes="vua"
      footer={
        <SheetActions
          onCancel={d.dongHop}
          onConfirm={gan}
          confirmLabel="Gắn"
          cancelLabel="Để sau"
          disabled={!nvId}
          busy={d.busy === 'gan'}
        />
      }
    >
      <Luoi>
        <Hang nhan="Nhân viên">
          <Combobox
            label="Nhân viên"
            width={300}
            value={nvId}
            onChange={setNvId}
            emptyLabel="Tìm mã hoặc tên…"
            options={d.nvChuaCo.map((n) => ({
              value: n.id,
              label: `${n.ma} · ${n.ten}`,
              hint: n.to ?? undefined,
            }))}
          />
        </Hang>
      </Luoi>
      <p className="text-k-sm mt-3 text-[var(--ink-2)]">
        Chỉ hiện nhân viên đang làm chưa có tài khoản. Không có trong danh sách → nhờ Nhân
        sự thêm (Hồ sơ nhân viên › Thêm), rồi quay lại gắn. Admin không tự thêm nhân viên.
      </p>
      {nv && (
        <Consequence>
          Từ nay tài khoản này là của {nv.ma} · {nv.ten}. Khi Nhân sự đánh dấu người này
          nghỉ việc, tài khoản tự khoá.
        </Consequence>
      )}
    </Sheet>
  )
}

/* ─── Tạo tài khoản dùng chung ───────────────────────────────────────────── */

export function HopTaoChung({ d }: { d: NvTkCtx }) {
  return d.hop?.kieu === 'tao_chung' ? <HopTaoChungMo d={d} /> : null
}

function HopTaoChungMo({ d }: { d: NvTkCtx }) {
  const [ten, setTen] = useState('')
  const [email, setEmail] = useState('')
  const [cam, setCam] = useState('')
  const [role, setRole] = useState('employee')
  const [phong, setPhong] = useState('')
  const [mk, setMk] = useState(matKhauTam)
  const [loi, setLoi] = useState<string | null>(null)
  async function tao() {
    if (!ten.trim()) return setLoi('Chưa đặt tên tài khoản')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setLoi('Email chưa đúng dạng')
    if (mk.length < 8) return setLoi('Mật khẩu tạm tối thiểu 8 ký tự')
    setLoi(null)
    const r = await d.goi(
      'tao_chung',
      '/api/users',
      'POST',
      {
        name: ten.trim(),
        email: email.trim(),
        password: mk,
        role,
        department_id: phong || null,
        account_kind: 'shared',
        shared_holder: cam.trim() || null,
      },
      `Đã tạo tài khoản dùng chung ${ten.trim()}`,
    )
    if (r) d.dongHop()
  }
  return (
    <Sheet
      open
      onClose={d.dongHop}
      title="Tạo tài khoản dùng chung"
      subtitle="Không gắn một nhân viên — vd. Thống kê Tổ …"
      stakes="vua"
      footer={
        <SheetActions
          onCancel={d.dongHop}
          onConfirm={tao}
          confirmLabel="Tạo tài khoản"
          cancelLabel="Để sau"
          busy={d.busy === 'tao_chung'}
        />
      }
    >
      <Luoi>
        <Hang nhan="Tên tài khoản">
          <TextInput label="Tên tài khoản" value={ten} onCommit={setTen} className={O} />
        </Hang>
        <Hang nhan="Email đăng nhập">
          <TextInput
            label="Email đăng nhập"
            value={email}
            onCommit={setEmail}
            className={O}
            mono
          />
        </Hang>
        <Hang nhan="Ai đang cầm">
          <TextInput
            label="Ai đang cầm"
            value={cam}
            onCommit={setCam}
            className={O}
            placeholder="VD: Hoa (thống kê)"
          />
        </Hang>
        <Hang nhan="Vai trò">
          <PickVaiTro value={role} onChange={setRole} />
        </Hang>
        <Hang nhan="Phòng">
          <PickPhong d={d} value={phong} onChange={setPhong} />
        </Hang>
        <Hang nhan="Mật khẩu tạm">
          <TextInput
            label="Mật khẩu tạm"
            value={mk}
            onCommit={setMk}
            className={O}
            mono
          />
        </Hang>
      </Luoi>
      {loi && <p className="text-k-sm mt-2 text-[var(--stop)]">{loi}</p>}
      <Consequence>
        Tài khoản cá nhân thì cấp từ dòng nhân viên, không tạo ở đây. Nhật ký thao tác vẫn
        ghi tài khoản dùng chung nào làm — ghi rõ ai đang cầm để còn truy được người.
      </Consequence>
    </Sheet>
  )
}

/* ─── Gắn theo gợi ý khớp họ tên ─────────────────────────────────────────── */

export function HopGoiY({ d }: { d: NvTkCtx }) {
  return d.hop?.kieu === 'goi_y' ? <HopGoiYMo d={d} /> : null
}

function HopGoiYMo({ d }: { d: NvTkCtx }) {
  const [bo, setBo] = useState<Set<string>>(new Set())
  const chon = d.h.goiY.filter((g) => !bo.has(g.tk.id))
  async function gan() {
    const r = await d.goi<{ xong: number; loi: { user_id: string; message: string }[] }>(
      'goi_y',
      '/api/users/link-bulk',
      'POST',
      { pairs: chon.map((g) => ({ user_id: g.tk.id, employee_id: g.nv.id })) },
    )
    if (!r) return
    if (r.loi.length) {
      d.dongHop()
      d.toast.error(
        `Đã gắn ${r.xong}; ${r.loi.length} dòng lỗi: ${r.loi.map((l) => l.message).join(' · ')}`,
      )
    } else {
      d.toast.success(`Đã gắn ${r.xong} tài khoản`)
      d.dongHop()
    }
  }
  return (
    <Sheet
      open
      onClose={d.dongHop}
      title="Gắn theo họ tên"
      subtitle={`${d.h.goiY.length} tài khoản khớp đúng một nhân viên — bỏ tick dòng nào sai`}
      stakes="vua"
      width={620}
      footer={
        <SheetActions
          onCancel={d.dongHop}
          onConfirm={gan}
          confirmLabel={`Gắn ${chon.length} tài khoản`}
          cancelLabel="Để sau"
          disabled={!chon.length}
          busy={d.busy === 'goi_y'}
        />
      }
    >
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-[var(--ink-3)]">
            <th className="w-8 border-b border-[var(--line)] py-1" />
            <th className="border-b border-[var(--line)] py-1 font-semibold">
              Tài khoản
            </th>
            <th className="border-b border-[var(--line)] py-1 font-semibold">
              → Nhân viên
            </th>
          </tr>
        </thead>
        <tbody>
          {d.h.goiY.map((g) => (
            <tr key={g.tk.id}>
              <td className="border-b border-[var(--line-faint)] py-1">
                <Tick
                  checked={!bo.has(g.tk.id)}
                  label={`Gắn ${g.tk.email} vào ${g.nv.ten}`}
                  onChange={(v) =>
                    setBo((s) => {
                      const n = new Set(s)
                      if (v) n.delete(g.tk.id)
                      else n.add(g.tk.id)
                      return n
                    })
                  }
                />
              </td>
              <td className="border-b border-[var(--line-faint)] py-1">
                {g.tk.ten}
                <span className="num ml-1.5 text-[var(--ink-3)]">{g.tk.email}</span>
              </td>
              <td className="border-b border-[var(--line-faint)] py-1">
                <span className="num mr-1.5 text-[var(--ink-3)]">{g.nv.ma}</span>
                {g.nv.ten}
                <span className="ml-1.5 text-[var(--ink-3)]">{g.nv.to ?? ''}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Consequence>
        Khớp theo họ tên bỏ dấu, chỉ khi đúng MỘT nhân viên đang làm chưa có tài khoản
        mang tên đó. Gắn xong, Nhân sự cho người đó nghỉ việc thì tài khoản tự khoá; gỡ lại
        được ở từng tài khoản.
      </Consequence>
    </Sheet>
  )
}
