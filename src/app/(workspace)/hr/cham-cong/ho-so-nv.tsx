'use client'

import { useState } from 'react'
import { Btn } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { NvDong } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { NhanVienCtx } from './useNhanVien'
import { dm } from './ky-cong.shared'

/**
 * Hồ sơ bên phải của bước ② (FactBox kiểu Dynamics): sửa một người, hoặc thêm người
 * mới (có thể điền sẵn từ một mã trên máy chưa ghép). Lưu xong vẫn mở để sửa tiếp.
 */
export function HoSoNv({ v }: { v: NhanVienCtx }) {
  const hs = v.hoSo
  const nguoi = hs && 'id' in hs ? v.nv.ds.find((n) => n.id === hs.id) : undefined
  return (
    <aside
      aria-label="Hồ sơ nhân viên"
      className="w-[300px] shrink-0 overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)]"
    >
      <datalist id="hr-bo-phan">
        {v.nv.boPhan.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      {hs && 'moi' in hs ? (
        <FormNv key={`moi|${hs.duId ?? ''}`} v={v} />
      ) : nguoi ? (
        <FormNv key={nguoi.id} v={v} n={nguoi} />
      ) : (
        <p className="text-k-sm px-3.5 py-3 text-[var(--ink-2)]">
          Bấm một dòng để xem và sửa hồ sơ; chọn nhiều dòng để đổi ca / bộ phận một lần.
        </p>
      )}
    </aside>
  )
}

const o = 'text-k-sm h-7 w-full border border-[var(--line)] bg-[var(--surface-card)] px-2'
const nhan = 'text-k-label text-[var(--ink-2)]'

function FormNv({ v, n }: { v: NhanVienCtx; n?: NvDong }) {
  const hs = v.hoSo && 'moi' in v.hoSo ? v.hoSo : null
  const caXuong = v.nv.cas[0]?.id ?? ''
  const [code, setCode] = useState(hs?.code ?? '')
  const [hoTen, setHoTen] = useState(n && !n.tenTuMay ? n.hoTen : '')
  const [boPhan, setBoPhan] = useState(n?.boPhan ?? '')
  const [ca, setCa] = useState(n?.shiftId ?? caXuong)
  const [active, setActive] = useState(n?.active ?? true)
  const [khongCham, setKhongCham] = useState(n?.khongChamCong ?? false)
  const [ghepThem, setGhepThem] = useState('')

  const tenGoiY = n?.tenTuMay ? n.hoTen : (hs?.tenMay ?? '')
  const loi =
    !n && !/^\d{1,9}$/.test(code.trim())
      ? 'Mã NV là số trên máy chấm công'
      : hoTen.trim().length < 2
        ? n?.tenTuMay
          ? `Gõ họ tên đầy đủ — máy chỉ ghi "${n.hoTen}"`
          : 'Gõ họ tên đầy đủ'
        : null

  async function luu() {
    if (loi) return
    if (n)
      await v.luu(n.id, {
        full_name: hoTen.trim(),
        team: boPhan.trim() || null,
        shift_id: ca,
        active,
        attendance_exempt: khongCham,
      })
    else {
      const ok = await v.them({
        code: code.trim(),
        full_name: hoTen.trim(),
        team: boPhan.trim() || null,
        shift_id: ca,
        ...(hs?.duId && { device_user_id: hs.duId }),
      })
      if (ok) v.setHoSo(null)
    }
  }

  return (
    <>
      <div className="border-b border-[var(--line)] px-3.5 py-2.5">
        <div className={nhan}>{n ? 'Hồ sơ' : 'Thêm nhân viên'}</div>
        <div className="text-k-lg font-semibold">
          {n ? (
            <>
              <span className="num text-[var(--act-text)]">{n.code}</span> {n.hoTen}
            </>
          ) : (
            hoTen || 'Nhân viên mới'
          )}
        </div>
        {n?.tenTuMay && (
          <div className="text-k-label text-[var(--warn)]">
            Tên lấy từ máy — gõ họ tên đầy đủ
          </div>
        )}
        {hs?.duId && (
          <div className="text-k-label text-[var(--ink-2)]">
            Tạo từ mã {hs.code} trên máy{hs.tenMay ? ` ("${hs.tenMay}")` : ''} — lưu xong
            sẽ ghép luôn mã này
          </div>
        )}
      </div>

      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-b border-[var(--line)] px-3.5 py-2.5">
        {!n && (
          <>
            <label className={nhan} htmlFor="nv-ma">
              Mã NV
            </label>
            <input
              id="nv-ma"
              className={cn(o, 'num')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="số trên máy, vd 604"
            />
          </>
        )}
        <label className={nhan} htmlFor="nv-ten">
          Họ tên
        </label>
        <input
          id="nv-ten"
          className={o}
          value={hoTen}
          onChange={(e) => setHoTen(e.target.value)}
          placeholder={tenGoiY ? `đuôi tên: ${tenGoiY}` : 'vd Nguyễn Văn An'}
        />
        <label className={nhan} htmlFor="nv-bp">
          Bộ phận / Tổ
        </label>
        <input
          id="nv-bp"
          className={o}
          list="hr-bo-phan"
          value={boPhan}
          onChange={(e) => setBoPhan(e.target.value)}
          placeholder="gõ hoặc chọn"
        />
        <label className={nhan} htmlFor="nv-ca">
          Ca thường làm
        </label>
        <span>
          <select
            id="nv-ca"
            className={o}
            value={ca}
            onChange={(e) => setCa(e.target.value)}
          >
            {v.nv.cas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.ten} {x.gio}
              </option>
            ))}
          </select>
          <span className="text-k-label mt-0.5 block text-[var(--ink-3)]">
            Chỉ là gợi ý — ngày làm nhiều đoạn thì từng đoạn tự nhận ca theo giờ
          </span>
        </span>
        {n && (
          <>
            <label className={nhan} htmlFor="nv-tt">
              Tình trạng
            </label>
            <select
              id="nv-tt"
              className={o}
              value={active ? '1' : '0'}
              onChange={(e) => setActive(e.target.value === '1')}
            >
              <option value="1">Đang làm</option>
              <option value="0">Không còn làm</option>
            </select>
            <span className={nhan}>Chấm công</span>
            <label className="text-k-sm flex items-start gap-1.5">
              <input
                type="checkbox"
                checked={khongCham}
                onChange={(e) => setKhongCham(e.target.checked)}
                className="mt-0.5 accent-[var(--act)]"
              />
              <span>
                Không chấm công
                <span className="text-k-label block text-[var(--ink-3)]">
                  không quẹt máy, không bị tính thiếu công (Kinh Doanh, Tài Xế…)
                </span>
              </span>
            </label>
          </>
        )}
      </div>

      {n && (
        <div className="border-b border-[var(--line)] px-3.5 py-2">
          <div className="text-k-sm mb-1 font-semibold">Mã trên máy</div>
          {n.ma.length === 0 && (
            <p className="text-k-label text-[var(--ink-3)]">
              Chưa ghép mã nào — lượt quẹt của người này chưa vào bảng công.
            </p>
          )}
          <table className="text-k-sm w-full">
            <tbody>
              {n.ma.map((m) => (
                <tr key={m.id}>
                  <td className="num py-0.5 pr-2">{m.may}</td>
                  <td className="num pr-2">{m.ma}</td>
                  <td className={cn('pr-2', m.canXem && 'text-[var(--warn)]')}>
                    {m.ten}
                  </td>
                  <td className="text-k-label pr-2 text-[var(--ink-3)]">
                    {m.lanCuoi ? dm(m.lanCuoi) : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="text-[var(--act-text)] underline"
                      disabled={v.busy}
                      onClick={() => v.ghep(m.id, null, n.hoTen)}
                    >
                      Gỡ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.nv.maChuaGhep.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <select
                aria-label="Ghép thêm mã trên máy"
                className={cn(o, 'h-6')}
                value={ghepThem}
                onChange={(e) => setGhepThem(e.target.value)}
              >
                <option value="">Ghép thêm mã chưa ghép…</option>
                {v.nv.maChuaGhep.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.may} {m.ma} {m.ten ?? ''} · {m.luotGanDay} lượt
                  </option>
                ))}
              </select>
              <Btn
                disabled={!ghepThem}
                busy={v.busy}
                onClick={async () => {
                  if (await v.ghep(ghepThem, n.id, n.hoTen)) setGhepThem('')
                }}
              >
                Ghép
              </Btn>
            </div>
          )}
        </div>
      )}

      <div className="px-3.5 py-2.5">
        {loi && (
          <p className="text-k-label mb-1.5 text-[var(--warn)]">Chưa lưu được: {loi}</p>
        )}
        <div className="flex gap-2">
          <Btn primary icon="tick" busy={v.busy} aria-disabled={!!loi} onClick={luu}>
            {n ? 'Lưu' : 'Thêm'}
          </Btn>
          {n && <Btn onClick={() => v.moChamCong(n.code)}>Xem chấm công</Btn>}
          <Btn onClick={() => v.setHoSo(null)}>Đóng</Btn>
        </div>
      </div>
    </>
  )
}
