'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'
import type { ChuanBiMoDot } from '@/modules/dept/warehouse/stocktakes.service'
import { HopThoai } from '../_erp/o-nhap'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * HỘP MỞ ĐỢT KIỂM KÊ (Kho B7a, bản vẽ KK-2 duyệt 19/10/2026).
 *
 * - Q3: cảnh báo "hàng của lệnh chưa ghi xuất" đứng ĐẦU hộp, chặn mềm — đếm lúc
 *   đó thì phần đã vào sản phẩm thành X5 thiếu và rời khỏi giá thành lệnh.
 * - Q1: "Sẽ đếm" = có tồn ∪ có phiếu 180 ngày, lấy từ CHÍNH hàm sinh dòng đếm,
 *   nên số trên nút "Mở đợt · N dòng" là đúng số dòng phiếu đếm sẽ có.
 * - Đếm mù mặc định bật (chốt 15/09/2026); người mở đợt bỏ được.
 */
export function MoDotHop({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (bao: string) => void
}) {
  const [d, setD] = useState<ChuanBiMoDot | null>(null)
  const [loiTai, setLoiTai] = useState<string | null>(null)
  const [chon, setChon] = useState<ReadonlySet<string>>(new Set())
  const [nguoi, setNguoi] = useState('')
  const [mu, setMu] = useState(true)
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    let huy = false
    api<ChuanBiMoDot>('/api/dept/warehouse/stocktakes/chuan-bi')
      .then((x) => !huy && setD(x))
      .catch((e) => !huy && setLoiTai(apiErrorText(e, 'Không tải được danh sách nhóm')))
    return () => {
      huy = true
    }
  }, [])

  const seDem = (d?.nhom ?? []).filter((n) => chon.has(n.group_name)).reduce((s, n) => s + n.se_dem, 0) // prettier-ignore
  const thieu =
    chon.size === 0 ? 'Chọn ít nhất một nhóm vật tư' : !nguoi ? 'Chọn người đếm' : null

  const doi = (g: string) =>
    setChon((s) => {
      const n = new Set(s)
      if (n.has(g)) n.delete(g)
      else n.add(g)
      return n
    })

  async function mo() {
    if (thieu) {
      setLoi(thieu)
      return
    }
    setBusy(true)
    setLoi(null)
    try {
      const r = await api<{ id: string; code: string; scope_count: number }>(
        '/api/dept/warehouse/stocktakes',
        {
          method: 'POST',
          body: {
            scope: { kind: 'group', groups: [...chon] },
            blind_count: mu,
            assigned_to: nguoi,
            note: ghiChu.trim() || null,
          },
        },
      )
      onDone(`Đã mở ${r.code} · ${fmt(r.scope_count)} dòng. Sổ chưa chốt — chốt khi người đếm bắt đầu đếm.`) // prettier-ignore
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <HopThoai
      title="Mở đợt kiểm kê"
      subtitle="mã đợt cấp khi lưu · sổ chốt khi bắt đầu đếm, không chốt lúc mở"
      onClose={onClose}
      width={660}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={!!thieu || busy}
            onClick={() => void mo()}
          >
            {busy ? 'Đang mở…' : `Mở đợt${seDem ? ` · ${fmt(seDem)} dòng` : ''}`}
          </button>
        </>
      }
    >
      {d && d.lenhChuaXuat.so_lenh > 0 && (
        <div className="kh-note kk-canh" role="note">
          <span className="tag">Nên ghi xuất trước</span>
          <span>
            {d.lenhChuaXuat.so_lenh} lệnh còn <b>{fmt(d.lenhChuaXuat.so_ma)} mã</b> đã về
            mà chưa ghi xuất. Đếm bây giờ, phần đã vào sản phẩm sẽ thành <b>X5 thiếu</b>{' '}
            và rời khỏi giá thành lệnh.{' '}
            <Link href="/warehouse/ton?xem=lenh" className="kh-lnk">
              Xem hàng của lệnh
            </Link>
            {' · '}
            <Link href="/warehouse/xuat" className="kh-lnk">
              Sang Xuất hàng
            </Link>
          </span>
        </div>
      )}

      <div className="kk-dong">
        <span className="kk-nhan">Phạm vi</span>
        <div className="kk-nhom" role="group" aria-label="Nhóm vật tư sẽ đếm">
          <div className="h" aria-hidden>
            <span />
            <span>Nhóm vật tư</span>
            <span className="r">Có tồn</span>
            <span className="r">Sẽ đếm</span>
            <span className="r">Kiểm lần cuối</span>
          </div>
          {loiTai ? (
            <p className="kh-stop" style={{ padding: 8 }}>
              {loiTai}
            </p>
          ) : !d ? (
            <p className="kh-mut" style={{ padding: 8 }}>
              Đang tính số mã từng nhóm…
            </p>
          ) : d.nhom.length === 0 ? (
            <p className="kh-mut" style={{ padding: 8 }}>
              Không nhóm nào có mã còn tồn hoặc có phiếu trong 180 ngày — chưa có gì để
              đếm.
            </p>
          ) : (
            d.nhom.map((n) => (
              <label
                key={n.group_name}
                className={chon.has(n.group_name) ? 'on' : undefined}
              >
                <input
                  type="checkbox"
                  checked={chon.has(n.group_name)}
                  onChange={() => doi(n.group_name)}
                />
                <span>{n.group_name}</span>
                <span className="r kh-num">{n.co_ton ? fmt(n.co_ton) : '·'}</span>
                <span className="r kh-num kh-b">{fmt(n.se_dem)}</span>
                <span className="r kh-mut">
                  {n.kiem_cuoi ? isoToVn(todayVn(new Date(n.kiem_cuoi))) : 'chưa bao giờ'}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
      <p className="kh-mut" style={{ fontSize: 12, margin: 0 }}>
        “Sẽ đếm” = mã đang có tồn trên sổ + mã có phiếu trong 180 ngày (bắt cả mã sổ ghi 0
        mà ngoài kệ còn hàng). Không lấy cả nhóm danh mục.
      </p>

      <label className="kk-dong">
        <span className="kk-nhan">Người đếm</span>
        <select
          className="kh-o"
          value={nguoi}
          onChange={(e) => setNguoi(e.target.value)}
          aria-label="Người đếm"
        >
          <option value="">— chọn —</option>
          {(d?.nguoi ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className="kk-dong">
        <span className="kk-nhan">Đếm mù</span>
        <span className="kk-chk">
          <input type="checkbox" checked={mu} onChange={(e) => setMu(e.target.checked)} />
          Người đếm không thấy số sổ {mu ? '(mặc định)' : '— số sổ hiện khi đếm'}
        </span>
      </label>
      <label className="kk-dong">
        <span className="kk-nhan">Ghi chú</span>
        <input
          className="kh-o"
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          placeholder="VD: Kiểm cuối tháng 10"
          aria-label="Ghi chú đợt"
          maxLength={2000}
        />
      </label>
      {loi && (
        <span className="kh-stop" role="alert">
          {loi}
        </span>
      )}
    </HopThoai>
  )
}
