'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { maKccTiep, ngayVn } from '@/lib/nhan-su/bien-dong'
import {
  choNguoiTiep,
  formTrong,
  goiTuyen,
  kiemTuyen,
  TEN_O_TUYEN,
  type FormTuyen,
  type OTuyen,
} from '@/lib/nhan-su/tuyen-vao'
import type { MaMoi } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { lop } from './luoi-ds'
import type { DsCtx } from './useNhanVienDs'

type DaTuyen = { ten: string; code: string; luuRieng: boolean | null }
type GoiY = { trangThai: 'dang' | 'xong' | 'loi'; ds: MaMoi[] }

/**
 * TUYỂN VÀO (B3, bản vẽ 02/11/2026 mục C) — hỏi đủ ô của file DS CNV ngay lúc nhận người,
 * thay hộp cũ 6 ô + "điền trên hồ sơ" (23 người vào từ 15/09: 2 có SĐT, 7 có ngày sinh).
 * Bắt buộc ba ô (Q4); ô cá nhân trống vẫn lưu, hộp nói ra. "Lưu & thêm người nữa" giữ bộ phận,
 * chức vụ, ngày vào, ca — 23/10 tuyển 7 người, 27/10 tuyển 6. Gợi ý mã đã quẹt máy mà chưa có
 * hồ sơ (vụ 27/10: người mới quẹt nhưng không có dòng trên Bảng công). Không kit (31/10/2026).
 */
export function HopTuyen({ d }: { d: DsCtx }) {
  const router = useRouter()
  const nv = d.h.nv
  const rieng = nv.rieng
  const [f, setF] = useState<FormTuyen>(() =>
    formTrong({ ngayVao: ngayVn(d.h.homNay), caId: nv.cas[0]?.id ?? '' }),
  )
  const [tenMay, setTenMay] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [thu, setThu] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [da, setDa] = useState<DaTuyen[]>([])
  const [goiY, setGoiY] = useState<GoiY>({ trangThai: 'dang', ds: [] })
  const dau = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let huy = false
    api<MaMoi[]>('/api/dept/hr/cham-cong/nhan-vien/ma-moi').then(
      (ds) => !huy && setGoiY({ trangThai: 'xong', ds }),
      () => !huy && setGoiY({ trangThai: 'loi', ds: [] }),
    )
    return () => {
      huy = true
    }
  }, [])

  const maDaCo = useMemo(
    () => [...nv.ds.map((n) => n.code), ...da.map((x) => x.code)],
    [nv.ds, da],
  )
  const k = kiemTuyen(f, maDaCo, rieng)
  const chucVu = useMemo(
    () =>
      [...new Set(nv.ds.map((n) => n.chucDanh).filter((t): t is string => !!t))].sort(
        (a, b) => a.localeCompare(b, 'vi'),
      ),
    [nv.ds],
  )
  const conGoiY = goiY.ds.filter((g) => !da.some((x) => x.code === g.ma))
  const dat =
    <K extends OTuyen>(o: K) =>
    (v: FormTuyen[K]) =>
      setF((x) => ({ ...x, [o]: v }))
  const sai = (o: OTuyen) => thu && k.chan.some((c) => c.o === o)

  function dong() {
    if (busy) return
    if (da.length)
      d.setBao({
        ok: true,
        text: `Đã tuyển ${da.length} người: ${da.map((x) => x.code).join(', ')}`,
      })
    d.setMoTuyen(false)
  }

  function toi(o: OTuyen) {
    setThu(true)
    document.getElementById(`tv-${o}`)?.focus()
  }

  /** Gõ mã tay mà trùng đúng một mã gợi ý thì ghép luôn dòng máy đó. */
  function datMa(ma: string) {
    const trung = conGoiY.filter((g) => g.ma === ma.trim())
    setF((x) => ({ ...x, ma, deviceUserId: trung.length === 1 ? trung[0].id : null }))
    setTenMay(trung.length === 1 ? trung[0].ten : null)
  }

  function chonGoiY(g: MaMoi) {
    setF((x) => ({ ...x, ma: g.ma, deviceUserId: g.id, ngayVao: ngayVn(g.dau) }))
    setTenMay(g.ten)
    document.getElementById('tv-ten')?.focus()
  }

  async function luu(moHoSo: boolean) {
    if (busy) return
    if (k.chan.length) return toi(k.chan[0].o)
    setBusy(true)
    setLoi(null)
    try {
      const r = await api<{ id: string; code: string; luuRieng: boolean | null }>(
        '/api/dept/hr/cham-cong/nhan-vien',
        { method: 'POST', body: goiTuyen(f, rieng) },
      )
      if (moHoSo) {
        router.push(`/hr/nhan-vien/${encodeURIComponent(r.code)}`)
        return
      }
      setDa((x) => [...x, { ten: f.ten.trim(), code: r.code, luuRieng: r.luuRieng }])
      if (r.luuRieng === false)
        setLoi(
          `Đã tuyển ${f.ten.trim()} (mã ${r.code}) nhưng chưa lưu được thông tin cá nhân — điền ở hồ sơ người đó`,
        )
      setF(choNguoiTiep(f))
      setTenMay(null)
      setThu(false)
      router.refresh()
      dau.current?.focus()
    } catch (e) {
      setLoi(`Chưa tuyển được: ${apiErrorText(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const why = busy ? 'Đang lưu…' : k.chan[0] ? k.chan[0].loi : null

  return (
    <div
      className="ns-man"
      onKeyDown={(e) => {
        if (e.key === 'Escape') dong()
      }}
    >
      <div
        className="ns-hop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv-tieu-de"
      >
        <div className="hd">
          <b id="tv-tieu-de">Tuyển vào</b>
          {da.length > 0 && (
            <span className="mut">
              người thứ {da.length + 1} trong lượt này · đã tuyển{' '}
              {da.map((x) => x.code).join(', ')}
            </span>
          )}
          <button type="button" className="x" aria-label="Đóng" onClick={dong}>
            <X className="ico" aria-hidden />
          </button>
        </div>
        <div className="bd">
          <section>
            <h4>Công việc</h4>
            <Dong ten="Chấm công">
              <span className="seg2" role="group" aria-label="Chấm công">
                <button
                  type="button"
                  aria-pressed={!f.khongCham}
                  onClick={() => dat('khongCham')(false)}
                >
                  Quẹt máy
                </button>
                <button
                  type="button"
                  aria-pressed={f.khongCham}
                  onClick={() =>
                    setF((x) => ({ ...x, khongCham: true, deviceUserId: null }))
                  }
                >
                  Không chấm công
                </button>
              </span>
            </Dong>
            {f.khongCham ? (
              <Dong ten="Mã nhân viên">
                <span>
                  tự cấp <b className="num">{maKccTiep(maDaCo)}</b>
                </span>
              </Dong>
            ) : (
              <>
                <Dong ten="Mã trên máy" id="tv-ma" bat sai={sai('ma')}>
                  <input
                    ref={dau}
                    id="tv-ma"
                    className="m"
                    autoFocus
                    inputMode="numeric"
                    value={f.ma}
                    onChange={(e) => datMa(e.target.value)}
                    placeholder="số đã cài trên máy, vd 7014"
                  />
                </Dong>
                <GoiYMa goiY={goiY} ds={conGoiY} chon={chonGoiY} dang={f.deviceUserId} />
              </>
            )}
            <Dong ten="Họ và tên" id="tv-ten" bat sai={sai('ten')}>
              <input
                id="tv-ten"
                ref={f.khongCham ? dau : undefined}
                autoFocus={f.khongCham}
                value={f.ten}
                onChange={(e) => dat('ten')(e.target.value)}
                placeholder={tenMay ? `trên máy: ${tenMay} — gõ họ tên có dấu` : ''}
              />
            </Dong>
            <Dong ten="Bộ phận" id="tv-boPhan" bat sai={sai('boPhan')}>
              <input
                id="tv-boPhan"
                list="tv-ds-bp"
                value={f.boPhan}
                onChange={(e) => dat('boPhan')(e.target.value)}
                placeholder="gõ hoặc chọn"
              />
            </Dong>
            <Dong ten="Chức vụ" id="tv-chucVu">
              <input
                id="tv-chucVu"
                list="tv-ds-cv"
                value={f.chucVu}
                onChange={(e) => dat('chucVu')(e.target.value)}
                placeholder="gõ hoặc chọn"
              />
            </Dong>
            <Dong ten="Ngày vào làm" id="tv-ngayVao" bat sai={sai('ngayVao')}>
              <input
                id="tv-ngayVao"
                className="m"
                value={f.ngayVao}
                onChange={(e) => dat('ngayVao')(e.target.value)}
                placeholder="dd/mm/yyyy"
              />
            </Dong>
            <Dong ten="Ca thường làm" id="tv-ca">
              <select
                id="tv-ca"
                value={f.caId}
                onChange={(e) => dat('caId')(e.target.value)}
              >
                {nv.cas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ten} {c.gio}
                  </option>
                ))}
              </select>
            </Dong>
          </section>
          <section>
            <h4>Cá nhân (như file DS CNV)</h4>
            {rieng ? (
              <>
                <Dong ten="Giới tính">
                  <span className="seg2" role="group" aria-label="Giới tính">
                    {(['male', 'female'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={f.gioiTinh === g}
                        onClick={() => dat('gioiTinh')(f.gioiTinh === g ? '' : g)}
                      >
                        {g === 'male' ? 'Nam' : 'Nữ'}
                      </button>
                    ))}
                  </span>
                </Dong>
                <Dong ten="Ngày sinh" id="tv-ngaySinh" sai={sai('ngaySinh')}>
                  <input
                    id="tv-ngaySinh"
                    className="m"
                    value={f.ngaySinh}
                    onChange={(e) => dat('ngaySinh')(e.target.value)}
                    placeholder="dd/mm/yyyy"
                  />
                </Dong>
                <Dong ten="Số CCCD" id="tv-cccd" sai={sai('cccd')}>
                  <input
                    id="tv-cccd"
                    className="m"
                    inputMode="numeric"
                    value={f.cccd}
                    onChange={(e) => dat('cccd')(e.target.value)}
                    placeholder="12 chữ số"
                  />
                </Dong>
                <Dong ten="Điện thoại" id="tv-dienThoai" sai={sai('dienThoai')}>
                  <input
                    id="tv-dienThoai"
                    className="m"
                    inputMode="tel"
                    value={f.dienThoai}
                    onChange={(e) => dat('dienThoai')(e.target.value)}
                    placeholder="09xx xxx xxx"
                  />
                </Dong>
                <Dong ten="Nơi ở hiện tại" id="tv-choO">
                  <input
                    id="tv-choO"
                    value={f.choO}
                    onChange={(e) => dat('choO')(e.target.value)}
                  />
                </Dong>
              </>
            ) : (
              <p className="mut">
                Ngày sinh, CCCD, điện thoại, nơi ở do người có quyền xem thông tin riêng
                nhập trên hồ sơ.
              </p>
            )}
            <Dong ten="Ghi chú" id="tv-ghiChu">
              <input
                id="tv-ghiChu"
                value={f.ghiChu}
                onChange={(e) => dat('ghiChu')(e.target.value)}
              />
            </Dong>
          </section>
        </div>
        <div className="ft">
          {k.chan[0] ? (
            <button type="button" className="ns-lnk why" onClick={() => toi(k.chan[0].o)}>
              {k.chan[0].loi}, bấm để tới ô
            </button>
          ) : k.trong.length ? (
            <span className="mut">
              Còn trống {k.trong.map((o) => TEN_O_TUYEN[o]).join(', ')} — vẫn lưu được
            </span>
          ) : null}
          {loi && <span className="loi">{loi}</span>}
          <span className="sp">
            <button type="button" className="ns-btn" onClick={dong}>
              {da.length ? 'Xong' : 'Huỷ'}
            </button>
            <button
              type="button"
              className="ns-btn"
              aria-disabled={why ? 'true' : undefined}
              title={why ?? undefined}
              onClick={() => luu(false)}
            >
              Lưu &amp; thêm người nữa
            </button>
            <button
              type="button"
              className="ns-btn p"
              aria-disabled={why ? 'true' : undefined}
              title={why ?? undefined}
              onClick={() => luu(true)}
            >
              {busy ? 'Đang lưu…' : 'Lưu & mở hồ sơ'}
            </button>
          </span>
        </div>
        <datalist id="tv-ds-bp">
          {nv.boPhan.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <datalist id="tv-ds-cv">
          {chucVu.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>
    </div>
  )
}

/** Một hàng nhãn – ô. `bat` = bắt buộc (dấu *). */
function Dong({
  ten,
  id,
  bat,
  sai,
  children,
}: {
  ten: string
  id?: string
  bat?: boolean
  sai?: boolean
  children: ReactNode
}) {
  return (
    <div className={lop('f', sai && 'sai')}>
      {id ? (
        <label htmlFor={id}>
          {ten}
          {bat && <i aria-hidden>*</i>}
        </label>
      ) : (
        <span className="lb">{ten}</span>
      )}
      {children}
    </div>
  )
}

/** Gợi ý mã đã quẹt máy 30 ngày mà chưa có hồ sơ — bấm để điền mã + ngày vào = lượt đầu. */
function GoiYMa({
  goiY,
  ds,
  chon,
  dang,
}: {
  goiY: GoiY
  ds: MaMoi[]
  chon: (g: MaMoi) => void
  dang: string | null
}) {
  if (goiY.trangThai === 'dang')
    return <p className="goiy mut">Đang tìm mã đã quẹt máy mà chưa có hồ sơ…</p>
  if (goiY.trangThai === 'loi')
    return <p className="goiy mut">Chưa tải được gợi ý mã — vẫn gõ mã tay được.</p>
  if (!ds.length)
    return (
      <p className="goiy mut">
        Không có mã nào quẹt máy 30 ngày qua mà chưa có hồ sơ. Người chưa quẹt thì gõ số
        đã cài trên máy.
      </p>
    )
  return (
    <div className="goiy">
      <span className="mut">Đã quẹt máy, chưa có hồ sơ:</span>
      {ds.slice(0, 6).map((g) => (
        <button
          key={g.id}
          type="button"
          aria-pressed={dang === g.id}
          onClick={() => chon(g)}
          title={`Máy ${g.may} · ${g.luot} lượt`}
        >
          <b className="num">{g.ma}</b> {g.ten ?? '(không tên)'}{' '}
          <span className="mut num">
            {ngayVn(g.dau).slice(0, 5)}–{ngayVn(g.cuoi).slice(0, 5)}
          </span>
        </button>
      ))}
      {ds.length > 6 && (
        <span className="mut">+{ds.length - 6} mã nữa ở Chấm công › Mã trên máy</span>
      )}
    </div>
  )
}
