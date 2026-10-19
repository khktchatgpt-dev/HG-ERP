'use client'

import { useEffect, useState } from 'react'
import { Btn, Pick, Sheet, Tag, TextInput } from '@/components/kit'
import { api } from '@/lib/api'
import type { NvGoc, TkGoc } from '@/lib/nhan-vien-tai-khoan'
import type { UserAuditEntry } from '@/modules/core/users/users.repo'
import type { NvTkCtx } from './useNhanVienTaiKhoan'
import { Hang, Luoi } from './hop-cap'
import { lucVn, matKhauTam, ngayVn, ROLE_LABEL, ROLES } from './nv-tk.shared'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'
const MUC =
  'text-k-label mt-4 mb-1.5 border-b border-[var(--line)] pb-1 font-semibold text-[var(--ink-2)] uppercase tracking-[.04em]'

const TEN_VIEC: Record<string, string> = {
  create: 'Tạo',
  update: 'Sửa',
  password_reset: 'Đặt lại mật khẩu',
  soft_delete: 'Xoá',
  restore: 'Khôi phục',
  bulk_import: 'Nạp hàng loạt',
  password_change: 'Tự đổi mật khẩu',
  profile_update: 'Tự sửa hồ sơ',
  link: 'Gắn / dùng chung',
  auto_lock: 'Tự khoá (nghỉ việc)',
}

/** Hộp một tài khoản: người gắn, quyền, khoá/mở, đặt lại mật khẩu, xoá/khôi phục, nhật ký. */
export function HopTaiKhoan({ d }: { d: NvTkCtx }) {
  const hop = d.hop?.kieu === 'tk' ? d.hop : null
  if (!hop) return null
  // Lấy bản MỚI của tài khoản sau router.refresh — hộp đứng mở trong lúc thao tác.
  const tk = d.h.dong.map((x) => x.tk).find((t) => t?.id === hop.tk.id) ?? hop.tk
  const dong = d.h.dong.find((x) => x.tk?.id === tk.id)
  const nv = dong?.kieu === 'nv' ? dong.nv : null
  return <HopTkMo key={tk.id} d={d} tk={tk} nv={nv} />
}

function HopTkMo({ d, tk, nv }: { d: NvTkCtx; tk: TkGoc; nv: NvGoc | null }) {
  const laToi = d.h.toi === tk.id
  const xoa = !!tk.xoaLuc
  const [ten, setTen] = useState(tk.ten ?? '')
  const [role, setRole] = useState(tk.role)
  const [phong, setPhong] = useState(tk.phongId ?? '')
  const [title, setTitle] = useState(tk.title ?? '')
  const [cam, setCam] = useState(tk.nguoiCam ?? '')
  const [mkMoi, setMkMoi] = useState<string | null>(null)
  const [nk, setNk] = useState<UserAuditEntry[] | null>(null)
  const url = `/api/users/${tk.id}`

  useEffect(() => {
    let huy = false
    api<{ entries: UserAuditEntry[] }>(
      `/api/users/audit?target_user_id=${tk.id}&limit=20`,
    )
      .then((r) => !huy && setNk(r.entries))
      .catch(() => !huy && setNk([]))
    return () => {
      huy = true
    }
  }, [tk.id, d.h])

  const doiQuyen =
    role !== tk.role ||
    (phong || null) !== tk.phongId ||
    (title.trim() || null) !== tk.title ||
    (!nv && (ten.trim() || null) !== tk.ten)

  const luuQuyen = () =>
    d.goi(
      'quyen',
      url,
      'PATCH',
      {
        ...(role !== tk.role && { role }),
        department_id: phong || null,
        title: title.trim() || null,
        ...(!nv && ten.trim() && { name: ten.trim() }),
      },
      'Đã lưu',
    )

  async function datLaiMk() {
    const mk = matKhauTam()
    const r = await d.goi(
      'mk',
      `${url}/reset-password`,
      'POST',
      { new_password: mk },
      'Đã đặt lại mật khẩu',
    )
    if (r) setMkMoi(mk)
  }

  return (
    <Sheet
      open
      onClose={d.dongHop}
      title={nv ? `${nv.ma} · ${nv.ten}` : (tk.ten ?? tk.email)}
      subtitle={tk.email}
      stakes="nhe"
      width={560}
      footer={<Btn onClick={d.dongHop}>Đóng</Btn>}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {xoa ? (
          <Tag tone="neutral">đã xoá {ngayVn(tk.xoaLuc)}</Tag>
        ) : tk.dangMo ? (
          <Tag tone="done">đang mở</Tag>
        ) : (
          <Tag tone="stop">đã khoá</Tag>
        )}
        {tk.doiMk && !xoa && <Tag tone="warn">chưa đổi mật khẩu tạm</Tag>}
        <span className="text-k-sm text-[var(--ink-3)]">
          Đăng nhập cuối {ngayVn(tk.dangNhap)}
        </span>
      </div>

      <div className={MUC}>Của ai</div>
      {nv ? (
        <div className="text-k-sm flex items-center gap-2">
          <span>
            <span className="num mr-1.5 text-[var(--ink-3)]">{nv.ma}</span>
            {nv.ten} · {nv.to ?? '(chưa có tổ)'}
            {!nv.dangLam && (
              <span className="ml-1.5">
                <Tag tone="neutral">đã nghỉ</Tag>
              </span>
            )}
          </span>
          <span className="ml-auto">
            <Btn
              blockedBy={xoa ? 'Khôi phục tài khoản trước' : undefined}
              onClick={() =>
                d.goi(
                  'gan',
                  `${url}/link`,
                  'PATCH',
                  { employee_id: null },
                  'Đã gỡ khỏi nhân viên',
                )
              }
              busy={d.busy === 'gan'}
            >
              Gỡ khỏi nhân viên
            </Btn>
          </span>
        </div>
      ) : (
        <Luoi>
          <Hang nhan={tk.dungChung ? 'Dùng chung · ai cầm' : 'Chưa gắn người'}>
            <div className="flex items-center gap-2">
              <TextInput
                label="Ai đang cầm"
                value={cam}
                onCommit={setCam}
                className={O}
                placeholder="VD: Hoa (thống kê)"
                disabled={xoa}
              />
              <Btn
                blockedBy={xoa ? 'Khôi phục tài khoản trước' : undefined}
                busy={d.busy === 'chung'}
                onClick={() =>
                  d.goi(
                    'chung',
                    `${url}/link`,
                    'PATCH',
                    { shared: true, holder: cam.trim() || null },
                    tk.dungChung ? 'Đã lưu người cầm' : 'Đã đánh dấu dùng chung',
                  )
                }
              >
                {tk.dungChung ? 'Lưu' : 'Đánh dấu dùng chung'}
              </Btn>
            </div>
          </Hang>
          <Hang nhan="">
            <Btn
              blockedBy={xoa ? 'Khôi phục tài khoản trước' : undefined}
              onClick={() => d.setHop({ kieu: 'gan', tk })}
            >
              {tk.dungChung
                ? 'Chuyển thành tài khoản của một nhân viên'
                : 'Gắn nhân viên'}
            </Btn>
          </Hang>
        </Luoi>
      )}

      <div className={MUC}>Quyền</div>
      <Luoi>
        {!nv && (
          <Hang nhan="Tên tài khoản">
            <TextInput
              label="Tên tài khoản"
              value={ten}
              onCommit={setTen}
              className={O}
              disabled={xoa}
            />
          </Hang>
        )}
        <Hang nhan="Vai trò">
          <Pick
            label="Vai trò"
            width={160}
            value={role}
            onChange={setRole}
            disabled={xoa || laToi}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
          {laToi && (
            <span className="text-k-label ml-2 text-[var(--ink-3)]">
              không tự đổi vai trò của mình
            </span>
          )}
        </Hang>
        <Hang nhan="Phòng">
          <Pick
            label="Phòng"
            width={260}
            value={phong}
            onChange={setPhong}
            disabled={xoa}
            options={[
              { value: '', label: '(chưa chọn phòng)' },
              ...d.h.phong.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Hang>
        <Hang nhan="Chức danh">
          <TextInput
            label="Chức danh"
            value={title}
            onCommit={setTitle}
            className={O}
            disabled={xoa}
          />
        </Hang>
        <Hang nhan="">
          <Btn
            primary
            disabled={!doiQuyen || xoa}
            busy={d.busy === 'quyen'}
            onClick={luuQuyen}
          >
            Lưu quyền
          </Btn>
        </Hang>
      </Luoi>
      {nv && (
        <p className="text-k-label mt-1.5 text-[var(--ink-3)]">
          Họ tên theo hồ sơ nhân viên — sửa ở Nhân sự › Hồ sơ nhân viên.
        </p>
      )}

      <div className={MUC}>Thao tác</div>
      <div className="flex flex-wrap items-center gap-2">
        {!xoa && (
          <Btn
            icon={tk.dangMo ? 'khoa' : 'mo'}
            blockedBy={laToi ? 'Không tự khoá tài khoản của mình' : undefined}
            busy={d.busy === 'khoa'}
            onClick={() =>
              d.goi(
                'khoa',
                url,
                'PATCH',
                { is_active: !tk.dangMo },
                tk.dangMo ? 'Đã khoá' : 'Đã mở khoá',
              )
            }
          >
            {tk.dangMo ? 'Khoá tài khoản' : 'Mở khoá'}
          </Btn>
        )}
        {!xoa && (
          <Btn busy={d.busy === 'mk'} onClick={datLaiMk}>
            Đặt lại mật khẩu
          </Btn>
        )}
        {xoa ? (
          <Btn
            busy={d.busy === 'xoa'}
            onClick={() =>
              d.goi('xoa', `${url}/restore`, 'POST', undefined, 'Đã khôi phục')
            }
          >
            Khôi phục
          </Btn>
        ) : (
          <Btn
            danger
            icon="xoa"
            blockedBy={laToi ? 'Không tự xoá tài khoản của mình' : undefined}
            busy={d.busy === 'xoa'}
            onClick={() => d.goi('xoa', url, 'DELETE', undefined, 'Đã xoá tài khoản')}
          >
            Xoá tài khoản
          </Btn>
        )}
      </div>
      {mkMoi && (
        <p className="text-k-sm mt-2 border-l-2 border-[var(--act)] bg-[var(--act-wash)] py-1.5 pl-2.5">
          Mật khẩu tạm mới: <b className="num select-all">{mkMoi}</b> — đưa cho người
          dùng; lần đăng nhập sau hệ thống bắt đổi. Mọi phiên đang mở của tài khoản đã bị
          đăng xuất.
        </p>
      )}
      {nv && !nv.dangLam && !tk.dangMo && !xoa && (
        <p className="text-k-label mt-1.5 text-[var(--ink-3)]">
          Nhân viên đã nghỉ việc — mở khoá sẽ bị chặn cho tới khi Nhân sự đánh dấu đi làm
          lại.
        </p>
      )}

      <div className={MUC}>Nhật ký</div>
      {nk == null ? (
        <p className="text-k-sm text-[var(--ink-3)]">Đang tải…</p>
      ) : nk.length === 0 ? (
        <p className="text-k-sm text-[var(--ink-3)]">Chưa có thao tác nào được ghi.</p>
      ) : (
        <ul className="text-k-sm space-y-1">
          {nk.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="num shrink-0 text-[var(--ink-3)]">
                {lucVn(e.created_at)}
              </span>
              <span>
                {TEN_VIEC[e.action] ?? e.action}
                {e.reason && <span className="text-[var(--ink-3)]"> · {e.reason}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
