'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { api } from '@/lib/api'
import { khoangMacDinh } from '@/lib/dan-so-mau'
import { fmt } from '../../da-ghi/so-da-ghi.shared'
import type { TuyChonDanSo } from '@/modules/dept/production/dan-so.service'

/**
 * FILE MẪU NHẬP LIỆU THEO LỆNH — khuôn F, KHÔNG kit (bản vẽ v2 19/11/2026,
 * https://claude.ai/artifact/4N2faPL2w4QHYQTvu5zNjX, Q1–Q7 duyệt; dựng bước "tải file mẫu").
 *
 * Chọn lệnh + phạm vi sản phẩm + khoảng ngày; bên phải cho thấy file sẽ có những tờ nào, bao
 * nhiêu dòng, đơn vị đếm, tổ điền sẵn. Tải xong thống kê điền số vào ô vàng rồi tải lên (bước sau).
 */
type TomTat = {
  lsx_code: string
  so_ngay: number
  to: {
    stage: string
    label: string
    don_vi: 'chi tiết' | 'cụm'
    to: string | null
    so_dong: number
    so_o_co: number
    ma: string[]
  }[]
}

export function MauScreen({ opt }: { opt: TuyChonDanSo }) {
  const kd = useMemo(() => khoangMacDinh(opt.today), [opt.today])
  const [lsxId, setLsxId] = useState(opt.lenh[0]?.id ?? '')
  /** null = cả lệnh. */
  const [chon, setChon] = useState<Set<string> | null>(null)
  const [tu, setTu] = useState(kd.tu)
  const [den, setDen] = useState(kd.den)
  const [dien, setDien] = useState(true)
  const [tt, setTt] = useState<{
    cho: string
    v: TomTat | null
    loi: string | null
  } | null>(null)

  const lenh = opt.lenh.find((l) => l.id === lsxId) ?? null
  const dsMa = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of lenh?.dong ?? []) if (!m.has(d.ma)) m.set(d.ma, d.ten)
    return [...m]
  }, [lenh])

  const hopLe =
    !!lsxId &&
    /^\d{4}-\d{2}-\d{2}$/.test(tu) &&
    /^\d{4}-\d{2}-\d{2}$/.test(den) &&
    tu <= den
  const qs = useMemo(() => {
    const p = new URLSearchParams({ lsx_id: lsxId, tu, den, dien: dien ? '1' : '0' })
    if (chon && chon.size > 0) p.set('ma', [...chon].join(','))
    return p.toString()
  }, [lsxId, tu, den, dien, chon])

  // Tóm tắt "file sẽ có" — tính ở máy chủ (cùng hàm sinh file), chạy lại mỗi khi chọn đổi.
  useEffect(() => {
    if (!hopLe) return
    let huy = false
    const t = window.setTimeout(() => {
      api<TomTat>(`/api/dept/production/dan-so/mau-lenh?${qs}&xem=1`)
        .then((v) => !huy && setTt({ cho: qs, v, loi: null }))
        .catch(
          (e: unknown) =>
            !huy &&
            setTt({
              cho: qs,
              v: null,
              loi: e instanceof Error ? e.message : 'Không tính được',
            }),
        )
    }, 350)
    return () => {
      huy = true
      window.clearTimeout(t)
    }
  }, [qs, hopLe])

  const dangTinh = hopLe && tt?.cho !== qs
  const v = tt?.cho === qs ? tt.v : null
  const soTo = v?.to.length ?? 0
  const why = !lsxId
    ? 'Chọn lệnh'
    : !hopLe
      ? 'Khoảng ngày không hợp lệ'
      : dangTinh
        ? 'Đang tính…'
        : soTo === 0
          ? 'Lệnh chưa có công đoạn nào để nhập'
          : null

  const doiLenh = (id: string) => {
    setLsxId(id)
    setChon(null)
  }
  const bat = (ma: string) =>
    setChon((c) => {
      const n = new Set(c ?? [])
      if (n.has(ma)) n.delete(ma)
      else n.add(ma)
      return n.size === 0 ? null : n
    })

  return (
    <SxKhung label="File mẫu nhập liệu">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="File mẫu nhập liệu"
          ctx={
            lenh ? (
              <>
                Lệnh <b>{lenh.code}</b>
              </>
            ) : undefined
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/dan-so">Dán một tờ</ApNut>
              </ApNhom>
              <ApNhom>
                {why ? (
                  <ApNut primary why={why}>
                    {`Tải file mẫu${soTo ? ` · ${soTo} tờ` : ''}`}
                  </ApNut>
                ) : (
                  <a
                    className="sx-btn p"
                    href={`/api/dept/production/dan-so/mau-lenh?${qs}`}
                  >
                    {`Tải file mẫu · ${soTo} tờ`}
                  </a>
                )}
              </ApNhom>
            </>
          }
        />

        <div className="sx-mau">
          <div className="sx-mau-tr">
            <label className="sx-mau-f">
              <b>Lệnh</b>
              <select
                value={lsxId}
                onChange={(e) => doiLenh(e.target.value)}
                aria-label="Lệnh sản xuất"
              >
                {opt.lenh.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="sx-mau-f" role="group" aria-label="Sản phẩm">
              <b>Sản phẩm</b>
              <label className="sx-mau-c">
                <input
                  type="checkbox"
                  checked={chon === null}
                  onChange={() => setChon(null)}
                />{' '}
                Cả lệnh · {dsMa.length} mã SP
              </label>
              {dsMa.map(([ma, ten]) => (
                <label key={ma} className="sx-mau-c">
                  <input
                    type="checkbox"
                    checked={chon?.has(ma) ?? false}
                    onChange={() => bat(ma)}
                  />{' '}
                  <span className="num">{ma}</span> <span className="mut">{ten}</span>
                </label>
              ))}
              <span className="mut">
                Bỏ “Cả lệnh” rồi tích sản phẩm nếu chỉ nhập vài mã.
              </span>
            </div>
            <div className="sx-mau-f">
              <b>Khoảng ngày</b>
              <span>
                <input
                  type="date"
                  value={tu}
                  max={den}
                  onChange={(e) => setTu(e.target.value)}
                  aria-label="Từ ngày"
                />
                {' → '}
                <input
                  type="date"
                  value={den}
                  min={tu}
                  max={opt.today}
                  onChange={(e) => setDen(e.target.value)}
                  aria-label="Đến ngày"
                />
              </span>
              <span className="mut">
                {v ? `${v.so_ngay} ngày` : ''} · mặc định 7 ngày gần nhất, tối đa 31 ngày
              </span>
            </div>
            <label className="sx-mau-c">
              <input
                type="checkbox"
                checked={dien}
                onChange={(e) => setDien(e.target.checked)}
              />{' '}
              Điền sẵn số đã ghi (thấy ngay ngày nào còn trống)
            </label>
          </div>

          <div className="sx-mau-ph">
            {tt?.loi && tt.cho === qs ? (
              <Rong
                tieuDe="Không tính được file mẫu"
                lyDo={tt.loi}
                tiep="Đổi lệnh hoặc khoảng ngày rồi thử lại."
              />
            ) : !v ? (
              <p className="mut">
                {dangTinh ? 'Đang tính…' : 'Chọn lệnh và khoảng ngày.'}
              </p>
            ) : v.to.length === 0 ? (
              <Rong
                tieuDe="Lệnh này chưa có công đoạn nào để nhập"
                lyDo="Chưa có bảng chi tiết, hoặc mọi công đoạn đều đếm theo bộ (chưa hỗ trợ trong file mẫu)."
                tiep={<Link href={`/thongke/lsx/${lsxId}`}>Mở Hồ sơ lệnh</Link>}
              />
            ) : (
              <>
                <b>File sẽ có</b>
                <table className="sx-tb">
                  <thead>
                    <tr>
                      <th>Tờ</th>
                      <th>Tổ điền sẵn</th>
                      <th className="r">Dòng</th>
                      <th>Đếm theo</th>
                      <th className="r">Ô đã có số</th>
                      <th>Mã SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.to.map((t) => (
                      <tr key={t.stage} className="r">
                        <td>{t.label}</td>
                        <td className={t.to ? '' : 'warn'}>
                          {t.to ?? 'chưa có tổ — chọn trong file'}
                        </td>
                        <td className="r num">{fmt(t.so_dong)}</td>
                        <td>{t.don_vi}</td>
                        <td className="r num">{fmt(t.so_o_co)}</td>
                        <td className="mut">{t.ma.length} mã</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        <ThanhTT
          left="Mỗi tờ chỉ có dòng của công đoạn đó; sản phẩm không qua công đoạn thì không có mặt ở tờ ấy"
          right="Phiếu nhập bù: không giờ công, không vào Năng suất"
        />
      </div>
    </SxKhung>
  )
}
