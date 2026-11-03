'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { hienSdt, QUAN_HE, TEN_GIOI_TINH, TRINH_DO, tuoi } from '@/lib/nhan-su/ca-nhan'
import { thamNien } from '@/lib/nhan-su/ho-so'
import type { OHoSo } from '@/lib/nhan-su/sua-ho-so'
import { lop } from '../luoi-ds'
import type { HoSoCtx } from './useHoSoNv'

const RONG = <span className="e">—</span>
const v = (x: ReactNode) => (x == null || x === '' ? RONG : x)
const so = (x: string | null | undefined) => (x ? <span className="num">{x}</span> : RONG)
const SO: OHoSo[] = [
  'maBhxh',
  'ngayVao',
  'ngaySinh',
  'cccd',
  'ngayCap',
  'mst',
  'dienThoai',
  'khanCapSdt',
]
const GOI_Y: Partial<Record<OHoSo, string>> = {
  boPhan: 'hs-ds-bp',
  chucVu: 'hs-ds-cv',
  trinhDo: 'hs-ds-td',
  khanCapQuanHe: 'hs-ds-qh',
}

/**
 * TAB THÔNG TIN (B4, bản vẽ 02/11/2026 mục D) — Công việc · Cá nhân · Giấy tờ · Liên hệ trên
 * một trang, thay Tổng quan + Cá nhân (3 nút sửa theo khối). Bỏ dải 5 ô số và khối "Còn thiếu
 * N mục": thâm niên, tuổi đi cạnh ngày; ô trống là "—". Bấm "Sửa thông tin" thì mọi ô người
 * xem được sửa thành ô nhập; Lưu / Huỷ ở góc phải đầu trang.
 */
export function TabThongTin({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const c = h.caNhan
  const ca = h.cas.find((x) => x.id === n.shiftId)
  const cv = d.dangSua && d.quyen.cv
  const cn = d.dangSua && d.quyen.rieng
  return (
    <div className="hs-tt">
      <section>
        <h4>
          Công việc
          {d.dangSua && !d.quyen.cv && (
            <span className="note">
              {n.active
                ? 'Phòng Nhân sự giữ quyền sửa'
                : 'đã nghỉ — Đi làm lại trước khi sửa'}
            </span>
          )}
        </h4>
        <dl>
          <Hang ten="Mã nhân viên">
            <b className="num">{n.code}</b>
          </Hang>
          <Hang ten="Họ và tên" d={d} o="ten" sua={cv} bat>
            {n.hoTen}
            {n.tenTuMay && <span className="warn">tên lấy từ máy — gõ lại có dấu</span>}
          </Hang>
          <Hang ten="Bộ phận" d={d} o="boPhan" sua={cv}>
            {v(n.boPhan)}
          </Hang>
          <Hang ten="Chức vụ" d={d} o="chucVu" sua={cv}>
            {v(n.chucDanh)}
          </Hang>
          <Hang ten="Ngày vào làm" d={d} o="ngayVao" sua={cv} goiY="dd/mm/yyyy">
            {n.ngayVao ? (
              <>
                <span className="num">{ngayVn(n.ngayVao)}</span>
                <span className="mut">
                  {' '}
                  · {thamNien(n.ngayVao, d.homNay) ?? 'chưa vào'}
                </span>
              </>
            ) : (
              RONG
            )}
          </Hang>
          <Hang ten="Ca thường làm" id="hs-caId">
            {cv ? (
              <select
                id="hs-caId"
                value={d.f.caId}
                onChange={(e) => d.datO('caId')(e.target.value)}
              >
                {h.cas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.ten} {x.gio}
                  </option>
                ))}
              </select>
            ) : (
              v(ca && `${ca.ten} ${ca.gio}`)
            )}
          </Hang>
          <Hang ten="Chấm công">
            {cv ? (
              <Seg
                ten="Chấm công"
                gia={d.f.khongCham ? 'khong' : 'quet'}
                chon={[
                  ['quet', 'Quẹt máy'],
                  ['khong', 'Không chấm công'],
                ]}
                dat={(x) => d.datO('khongCham')(x === 'khong')}
              />
            ) : n.khongChamCong ? (
              'không chấm công'
            ) : (
              'quẹt máy'
            )}
          </Hang>
          <Hang ten="Mã trên máy">
            {n.ma.length ? (
              so(n.ma.map((m) => `${m.may} ${m.ma}`).join(' · '))
            ) : n.khongChamCong ? (
              RONG
            ) : (
              <span className="warn">chưa ghép mã nào</span>
            )}
            <Link className="lk" href="/hr/cham-cong/ma-may">
              ghép ở Mã trên máy
            </Link>
          </Hang>
          <Hang ten="Tài khoản ERP">
            {n.taiKhoan ? (
              <span className="num">
                {n.taiKhoan.email}
                {!n.taiKhoan.mo && ' · khoá'}
              </span>
            ) : (
              RONG
            )}
          </Hang>
          <Hang ten="Ghi chú" d={d} o="ghiChu" sua={cv}>
            {v(n.ghiChu)}
          </Hang>
        </dl>
      </section>

      {c ? (
        <>
          <section>
            <h4>Cá nhân</h4>
            <dl>
              <Hang ten="Giới tính">
                {cn ? (
                  <Seg
                    ten="Giới tính"
                    gia={d.f.gioiTinh}
                    chon={[
                      ['male', 'Nam'],
                      ['female', 'Nữ'],
                    ]}
                    dat={(x) =>
                      d.datO('gioiTinh')(
                        d.f.gioiTinh === x ? '' : (x as 'male' | 'female'),
                      )
                    }
                  />
                ) : (
                  v(c.gioiTinh && TEN_GIOI_TINH[c.gioiTinh])
                )}
              </Hang>
              <Hang ten="Ngày sinh" d={d} o="ngaySinh" sua={cn} goiY="dd/mm/yyyy">
                {c.ngaySinh ? (
                  <>
                    <span className="num">{ngayVn(c.ngaySinh)}</span>
                    <span className="mut"> · {tuoi(c.ngaySinh, d.homNay)} tuổi</span>
                  </>
                ) : (
                  RONG
                )}
              </Hang>
              <Hang ten="Quốc tịch" d={d} o="quocTich" sua={cn} goiY="Việt Nam">
                {v(c.quocTich)}
              </Hang>
              <Hang ten="Quê quán" d={d} o="queQuan" sua={cn}>
                {v(c.queQuan)}
              </Hang>
              <Hang ten="Trình độ" d={d} o="trinhDo" sua={cn}>
                {v(c.trinhDo)}
              </Hang>
            </dl>
          </section>
          <section>
            <h4>Giấy tờ</h4>
            <dl>
              <Hang
                ten="Số CCCD"
                d={d}
                o="cccd"
                sua={cn}
                goiY={c.cccdChe ? `${c.cccdChe} — gõ số mới để thay` : '12 chữ số'}
              >
                {c.cccdChe ? (
                  <>
                    <span className="num">{d.cccd ?? c.cccdChe}</span>
                    {d.cccd == null && (
                      <button type="button" className="lk" onClick={d.hienCccd}>
                        Hiện (ghi nhật ký)
                      </button>
                    )}
                  </>
                ) : (
                  RONG
                )}
              </Hang>
              <Hang ten="Ngày cấp" d={d} o="ngayCap" sua={cn} goiY="dd/mm/yyyy">
                {so(c.ngayCap && ngayVn(c.ngayCap))}
              </Hang>
              <Hang ten="Nơi cấp" d={d} o="noiCap" sua={cn}>
                {v(c.noiCap)}
              </Hang>
              <Hang
                ten="Mã số thuế"
                d={d}
                o="mst"
                sua={cn}
                goiY={c.mstChe ? `${c.mstChe} — gõ số mới để thay` : '10 hoặc 13 chữ số'}
              >
                {so(c.mstChe)}
              </Hang>
              <Hang ten="Mã số BHXH" d={d} o="maBhxh" sua={cn} goiY="10 chữ số">
                {so(c.maBhxh)}
              </Hang>
            </dl>
          </section>
          <section>
            <h4>Liên hệ</h4>
            <dl>
              <Hang ten="Điện thoại" d={d} o="dienThoai" sua={cn} goiY="09xx xxx xxx">
                {so(hienSdt(c.dienThoai))}
              </Hang>
              <Hang ten="Nơi ở hiện tại" d={d} o="choO" sua={cn}>
                {v(c.choO)}
              </Hang>
              <Hang ten="Thường trú" d={d} o="thuongTru" sua={cn}>
                {v(c.thuongTru)}
              </Hang>
              <Hang ten="Người khẩn cấp" d={d} o="khanCapTen" sua={cn}>
                {v(c.khanCapTen)}
              </Hang>
              <Hang ten="Quan hệ" d={d} o="khanCapQuanHe" sua={cn}>
                {v(c.khanCapQuanHe)}
              </Hang>
              <Hang ten="SĐT khẩn cấp" d={d} o="khanCapSdt" sua={cn} goiY="09xx xxx xxx">
                {so(hienSdt(c.khanCapSdt))}
              </Hang>
            </dl>
          </section>
        </>
      ) : (
        <section className="khoa">
          <Lock className="ico" aria-hidden />
          Chỉ Phòng Nhân sự và Ban Giám đốc xem được thông tin cá nhân, giấy tờ, liên hệ.
        </section>
      )}

      {d.dangSua && (
        <>
          <datalist id="hs-ds-bp">
            {h.boPhan.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="hs-ds-cv">
            {h.chucDanh.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="hs-ds-td">
            {TRINH_DO.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="hs-ds-qh">
            {QUAN_HE.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}

/**
 * Một hàng nhãn – giá trị. Có `o` + `sua` thì thành ô nhập của form (ô sai viền đỏ sau lần bấm
 * Lưu đầu tiên, kèm câu nói sai gì dưới ô).
 */
function Hang({
  ten,
  children,
  d,
  o,
  sua,
  bat,
  goiY,
  id,
}: {
  ten: string
  children: ReactNode
  d?: HoSoCtx
  o?: OHoSo
  sua?: boolean
  bat?: boolean
  goiY?: string
  id?: string
}) {
  const nhap = !!(d && o && sua)
  const loi = nhap && d.thu ? d.loi.find((x) => x.o === o) : undefined
  const idO = nhap ? `hs-${o}` : id
  return (
    <>
      <dt>
        {idO ? <label htmlFor={idO}>{ten}</label> : ten}
        {nhap && bat && <i aria-hidden>*</i>}
      </dt>
      <dd className={lop(nhap && 'o', loi && 'sai')}>
        {nhap ? (
          <>
            <input
              id={idO}
              className={SO.includes(o!) ? 'm' : undefined}
              value={d!.f[o!] as string}
              onChange={(e) => (d!.datO(o!) as (x: string) => void)(e.target.value)}
              placeholder={goiY}
              list={GOI_Y[o!]}
              aria-invalid={loi ? true : undefined}
            />
            {loi && <span className="loi">{loi.loi}</span>}
          </>
        ) : (
          children
        )}
      </dd>
    </>
  )
}

function Seg({
  ten,
  gia,
  chon,
  dat,
}: {
  ten: string
  gia: string
  chon: [string, string][]
  dat: (x: string) => void
}) {
  return (
    <span className="seg2" role="group" aria-label={ten}>
      {chon.map(([k, t]) => (
        <button key={k} type="button" aria-pressed={gia === k} onClick={() => dat(k)}>
          {t}
        </button>
      ))}
    </span>
  )
}
