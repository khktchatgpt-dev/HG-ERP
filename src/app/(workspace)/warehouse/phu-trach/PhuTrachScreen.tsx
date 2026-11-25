'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Save } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { thayDoi, type PhanCong } from '@/lib/kho-phu-trach'
import type { TrangPhuTrach } from '@/modules/dept/warehouse/phu-trach.service'
import { ApNhom, ApNut, DauTrang, KhoKhung, Rong, ThanhLoc, ThanhTT } from '../_erp/khung'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * PHỤ TRÁCH NHÓM VẬT TƯ — bản vẽ https://claude.ai/artifact/27qPqf6oxKKaU1XuAwy1in
 * (duyệt 24/11/2026: "thủ kho phân bổ"). Câu màn trả lời: nhóm vật tư nào do ai
 * trong Kho giữ? Đổi người là áp ngay cho mọi đơn / phiếu / mã của nhóm, không sửa
 * phiếu cũ. Nhóm chưa gán thuộc thủ kho. Nhân viên Kho chỉ xem.
 */
export function PhuTrachScreen({ data }: { data: TrangPhuTrach }) {
  const router = useRouter()
  const goc: PhanCong = useMemo(
    () => Object.fromEntries(data.nhom.filter((n) => n.user_id).map((n) => [n.group_name, n.user_id!])), // prettier-ignore
    [data.nhom],
  )
  const [nhap, setNhap] = useState<PhanCong>(goc)
  const [loc, setLoc] = useState<string>('tat_ca')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [bao, setBao] = useState<string | null>(null)

  // Server trả phân công mới sau `router.refresh()` → bản nháp theo về (mẫu "điều chỉnh state theo prop").
  const [gocCu, setGocCu] = useState(goc)
  if (gocCu !== goc) {
    setGocCu(goc)
    setNhap(goc)
  }

  const doi = thayDoi(goc, nhap)
  const tenCua = (id: string | null) => data.nguoi.find((n) => n.id === id)?.name ?? '—'
  const thuKhoTen = data.thu_kho ? tenCua(data.thu_kho) : null
  const giuCua = (g: string) => nhap[g] ?? data.thu_kho
  // Số trên nút người = nhóm người đó GIỮ, kể cả nhóm chưa gán (thuộc thủ kho) — cùng `giuCua` lọc bảng.
  const ganCua = (id: string) => data.nhom.filter((n) => giuCua(n.group_name) === id).length
  const chuaGan = data.nhom.filter((n) => !nhap[n.group_name]).length

  const khopQ = (g: string) =>
    !q.trim() || g.toLowerCase().includes(q.trim().toLowerCase())
  const ds = data.nhom.filter(
    (n) =>
      khopQ(n.group_name) &&
      (loc === 'tat_ca' ||
        (loc === 'chua' ? !nhap[n.group_name] : giuCua(n.group_name) === loc)),
  )

  const luu = async () => {
    if (doi.length === 0 || busy) return
    setBusy(true)
    setLoi(null)
    try {
      await api('/api/dept/warehouse/phu-trach', { method: 'PUT', body: { items: doi } })
      setBao(`Đã lưu ${doi.length} nhóm. Danh sách "Của tôi" ở Nhận hàng đổi theo ngay.`)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const khoaLuu = !data.can_manage
    ? 'Chỉ thủ kho phân nhóm vật tư'
    : doi.length === 0
      ? 'Chưa đổi nhóm nào'
      : busy
        ? 'Đang lưu…'
        : null

  return (
    <KhoKhung label="Phụ trách nhóm vật tư">
      <DauTrang
        crumb="Kho › Danh mục"
        title="Phụ trách nhóm vật tư"
        ctx={
          <>
            <b>{fmt(data.nhom.length)}</b> nhóm · <b>{fmt(data.nguoi.length)}</b> người
            {thuKhoTen && <> · nhóm chưa gán thuộc thủ kho {thuKhoTen}</>}
          </>
        }
        actions={
          data.can_manage ? (
            <ApNhom>
              <ApNut
                primary
                icon={<Save size={15} aria-hidden />}
                onClick={luu}
                why={khoaLuu}
              >
                {doi.length > 0 ? `Lưu · ${doi.length} nhóm đổi` : 'Lưu'}
              </ApNut>
              <ApNut
                icon={<RotateCcw size={15} aria-hidden />}
                onClick={() => setNhap(goc)}
                why={doi.length === 0 ? 'Chưa đổi nhóm nào' : null}
              >
                Bỏ thay đổi
              </ApNut>
            </ApNhom>
          ) : undefined
        }
      />

      {loi && (
        <div className="kh-note" role="alert">
          <span className="tag">Chưa lưu</span>
          <span>{loi}</span>
        </div>
      )}
      {bao && !loi && (
        <div className="kh-note ok" role="status">
          <span className="tag">Đã lưu</span>
          <span>{bao}</span>
          <button
            type="button"
            className="dong"
            onClick={() => setBao(null)}
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}
      {!data.can_manage && (
        <div className="kh-note mut">
          <span className="tag">Chỉ xem</span>
          <span>
            Thủ kho{thuKhoTen ? ` (${thuKhoTen})` : ''} phân nhóm vật tư. Cần đổi thì báo
            thủ kho.
          </span>
        </div>
      )}

      <ThanhLoc>
        <div className="kh-seg" role="radiogroup" aria-label="Lọc theo người">
          {[
            { k: 'tat_ca', t: 'Tất cả', n: data.nhom.length },
            ...data.nguoi.map((p) => ({ k: p.id, t: p.name, n: ganCua(p.id) })),
            { k: 'chua', t: 'Chưa gán', n: chuaGan },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={loc === o.k}
              onClick={() => setLoc(o.k)}
            >
              {o.t}
              <span className="kh-num" style={{ marginLeft: 5 }}>
                {fmt(o.n)}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm nhóm vật tư…"
          aria-label="Tìm nhóm vật tư"
        />
        <span className="sp">
          Đổi người là áp cho mọi đơn, phiếu, mã của nhóm · không sửa phiếu cũ
        </span>
      </ThanhLoc>

      {data.nguoi.length === 0 ? (
        <Rong
          tieuDe="Chưa có nhân viên Kho nào"
          lyDo="Danh sách người lấy từ tài khoản có quyền phòng Kho. Nhờ quản trị cấp quyền phòng Kho cho nhân viên rồi quay lại đây."
        />
      ) : ds.length === 0 ? (
        <Rong
          tieuDe="Không có nhóm nào khớp"
          lyDo={`Trong ${fmt(data.nhom.length)} nhóm, không nhóm nào khớp bộ lọc hiện tại.`}
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() => {
                setLoc('tat_ca')
                setQ('')
              }}
            >
              Xem cả {fmt(data.nhom.length)} nhóm
            </button>
          }
        />
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Phụ trách nhóm vật tư">
            <colgroup>
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 260 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nhóm vật tư</th>
                <th className="r">Mã</th>
                <th className="r">Đơn đang về</th>
                <th>Phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((n) => {
                const daDoi = (goc[n.group_name] ?? null) !== (nhap[n.group_name] ?? null)
                return (
                  <tr key={n.group_name} className="d">
                    <td title={n.group_name}>{n.group_name}</td>
                    <td className="r kh-num">{fmt(n.so_ma)}</td>
                    <td className="r kh-num">
                      {n.don_ve > 0 ? fmt(n.don_ve) : <span className="kh-empty">·</span>}
                    </td>
                    <td style={{ paddingBlock: 2 }}>
                      {data.can_manage ? (
                        <select
                          className="kh-o"
                          value={nhap[n.group_name] ?? ''}
                          aria-label={`Người phụ trách nhóm ${n.group_name}`}
                          style={{
                            width: '100%',
                            ...(daDoi ? { outline: '2px solid var(--kh-act)', outlineOffset: -2 } : {}), // prettier-ignore
                          }}
                          onChange={(e) => {
                            const v = e.target.value
                            setBao(null)
                            setNhap((cu) => {
                              const m = { ...cu }
                              if (v) m[n.group_name] = v
                              else delete m[n.group_name]
                              return m
                            })
                          }}
                        >
                          <option value="">
                            Chưa gán{thuKhoTen ? ` — thủ kho ${thuKhoTen}` : ''}
                          </option>
                          {data.nguoi.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.thu_kho ? ' (thủ kho)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : nhap[n.group_name] ? (
                        tenCua(nhap[n.group_name])
                      ) : (
                        <span className="kh-mut">
                          chưa gán{thuKhoTen ? ` — ${thuKhoTen}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  {fmt(ds.length)} nhóm
                  {data.ma_khong_nhom > 0 &&
                    ` · ${fmt(data.ma_khong_nhom)} mã chưa có nhóm thuộc thủ kho`}
                  {doi.length > 0 && ` · ${doi.length} nhóm đổi, chưa lưu (viền xanh)`}
                </td>
                <td className="r kh-num">{fmt(ds.reduce((s, n) => s + n.so_ma, 0))}</td>
                <td className="r kh-num">{fmt(data.tong_don_ve)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="“Đơn đang về” đếm đơn có ít nhất một dòng thuộc nhóm — đơn nhiều nhóm đếm ở mỗi nhóm; chân bảng là số đơn khác nhau"
        right={
          <>
            {data.nguoi
              .map(
                (p) =>
                  `${p.name}: ${fmt(data.nhom.filter((n) => giuCua(n.group_name) === p.id).length)} nhóm`,
              )
              .join(' · ')}
          </>
        }
      />
    </KhoKhung>
  )
}
