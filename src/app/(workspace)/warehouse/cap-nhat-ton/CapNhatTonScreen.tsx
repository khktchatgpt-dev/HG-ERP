'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { ngayGioVn } from '@/lib/date-vn'
import {
  LY_DO_CAP_NHAT,
  cauChan,
  kiemTruocGhi,
  taoDong,
  thanGui,
  themDongCapNhat,
  tomTat,
  type DauCapNhat,
  type DongCapNhat,
  type LenhCuaMa,
  type MaLyDoCapNhat,
} from '@/lib/kho-cap-nhat-ton'
import { Boxes, ClipboardCheck } from 'lucide-react'
import { ApNhom, ApNut, DauTrang, KhoKhung, Rong, ThanhTT } from '../_erp/khung'
import { OChu } from '../_erp/o-nhap'
import { OTim } from '../_erp/o-tim'
import { useCtrlEnter } from '../_erp/useCtrlEnter'
import { LuoiCapNhat } from './luoi-cap-nhat'
import { BU_LOI } from './hoi-lenh'
import './cap-nhat-ton.css'

type VatTu = { id: string; code: string; name: string; unit: string }

/** Một lần cập nhật đang chờ trưởng kho duyệt. */
export type ChoDuyet = {
  id: string
  code: string
  nguoi: string | null
  so_ma: number
  luc: string
}

type KetQua =
  | { trang_thai: 'cho_duyet'; id: string; code: string }
  | {
      trang_thai: 'da_ghi'
      id: string
      code: string
      doc_id: string
      doc_code: string
      applied: number
      xuat_bu: { id: string; code: string; lsx_code: string }[]
    }

const DAU_MOI: DauCapNhat = { ly_do_chung: 'giao_kho', ghi_chu: '' }

/**
 * CẬP NHẬT SỐ THỰC TẾ — khuôn F (bảng nhập liệu), Kho lối ERP không kit. Bản
 * vẽ C1–C3 ở https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z (duyệt Q1–Q6
 * 27/10/2026). Thủ kho gõ số đếm được của vài mã; ghi là MỘT POST
 * `cap-nhat-ton` — server tạo đợt kiểm kê theo danh sách mã, tính lại chênh.
 * Trưởng kho: đổi tồn ngay. Người khác: chờ trưởng kho duyệt (Q2).
 * Thông báo (trùng mã, tra tồn lỗi, lỗi ghi) hiện TẠI CHỖ, không toast.
 */
export function CapNhatTonScreen({
  nguoiGhi,
  laTruong,
  canEdit,
  lenhTheoMa,
  banDau,
  maKhongThay,
  choDuyet,
}: {
  nguoiGhi: string
  laTruong: boolean
  canEdit: boolean
  /** Lệnh đang được chia tồn của từng mã (Q3). */
  lenhTheoMa: Record<string, LenhCuaMa[]>
  /** Mã mở sẵn từ `?ma=` (Tồn kho dẫn sang). */
  banDau: DongCapNhat[]
  maKhongThay: string[]
  choDuyet: ChoDuyet[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(banDau)
  const [dau, setDau] = useState<DauCapNhat>(DAU_MOI)
  const [busy, setBusy] = useState(false)
  const [dangTra, setDangTra] = useState(false)
  const [daThu, setDaThu] = useState(false)
  const [loiGhi, setLoiGhi] = useState<string | null>(null)
  const [ketQua, setKetQua] = useState<KetQua | null>(null)
  const [bao, setBao] = useState<string | null>(
    maKhongThay.length > 0
      ? `Không thấy mã ${maKhongThay.join(', ')} trong danh mục.`
      : null,
  )

  const patch = (i: number, p: Partial<DongCapNhat>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const loi = useMemo(() => kiemTruocGhi(dau, rows), [dau, rows])
  const tong = useMemo(() => tomTat(rows), [rows])

  async function timVatTu(q: string): Promise<VatTu[]> {
    const res = await api<{ rows: VatTu[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  const focusO = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null
    el?.focus()
    el?.select?.()
  }

  /*
    Thêm dòng phải biết SỐ TRÊN MÁY — không tra được thì KHÔNG thêm: một dòng
    "trên máy ?" thì chênh vô nghĩa, và người gõ không biết mình đang sửa gì.
  */
  async function chonVatTu(vt: VatTu) {
    setDangTra(true)
    setBao(null)
    try {
      const res = await api<{ rows: { material_id: string; on_hand: number }[] }>(
        `/api/dept/warehouse/stock/ton?ids=${vt.id}`,
      )
      const r = themDongCapNhat(
        rows,
        taoDong(vt, res.rows[0]?.on_hand ?? 0, lenhTheoMa[vt.id] ?? []),
      )
      if (r.trung) setBao(`${vt.code} đã có ở dòng ${r.index + 1} — một mã một dòng.`)
      else setRows(r.rows)
      setKetQua(null)
      setTimeout(() => focusO(`cn-tt-${r.index}`), 40)
    } catch (e) {
      setBao(`Không tra được số trên máy của ${vt.code}: ${apiErrorText(e)} — thử lại.`)
    } finally {
      setDangTra(false)
    }
  }

  const nhayToi = () => {
    const l = loi[0]
    if (!l) return
    if (l.i < 0) return focusO('cn-tim')
    focusO(
      l.reason === 'thieu_ghi_chu'
        ? `cn-gc-${l.i}`
        : BU_LOI.includes(l.reason)
          ? `cn-bu-${l.i}-0`
          : `cn-tt-${l.i}`,
    )
  }

  async function ghi() {
    setBusy(true)
    setLoiGhi(null)
    try {
      const r = await api<KetQua>('/api/dept/warehouse/cap-nhat-ton', {
        method: 'POST',
        body: thanGui(dau, rows),
      })
      setKetQua(r)
      setRows([])
      setDau(DAU_MOI)
      setDaThu(false)
      router.refresh()
    } catch (e) {
      setLoiGhi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : busy
      ? 'Đang ghi…'
      : (cauChan(loi) ?? undefined)
  /** Bấm Ghi: được thì ghi, chưa được thì nhảy tới chỗ phải sửa. */
  const bamGhi = () => {
    if (!canEdit || busy) return
    // Lỗi server của lần ghi trước đè lên câu chặn mới — bấm lại là xoá nó.
    setLoiGhi(null)
    setDaThu(true)
    if (loi.length > 0) nhayToi()
    else void ghi()
  }
  const phimGhi = useCtrlEnter(bamGhi)

  return (
    <KhoKhung label="Cập nhật số thực tế" onKeyDown={phimGhi}>
      <DauTrang
        title="Cập nhật số thực tế"
        ctx={
          <>
            gõ số đếm được · máy tự ghi phần thừa / thiếu thành một phiếu kiểm kê ·{' '}
            {laTruong ? (
              <b>bạn là trưởng kho: ghi là đổi tồn ngay</b>
            ) : (
              <b>ghi xong chờ trưởng kho duyệt mới đổi tồn</b>
            )}
          </>
        }
        actions={
          <ApNhom>
            <ApNut icon={<Boxes size={15} aria-hidden />} href="/warehouse/ton">
              Tồn kho
            </ApNut>
            <ApNut
              icon={<ClipboardCheck size={15} aria-hidden />}
              href="/warehouse/kiem-ke"
            >
              Kiểm kê định kỳ
            </ApNut>
          </ApNhom>
        }
      />

      {ketQua?.trang_thai === 'da_ghi' && (
        <div className="kh-note ok" role="status">
          <span className="tag">Đã ghi</span>
          <span>
            Phiếu <b className="kh-num">{ketQua.doc_code}</b> · {ketQua.applied} mã thừa /
            thiếu
            {ketQua.xuat_bu.length > 0 &&
              ` · xuất bù ${ketQua.xuat_bu.map((p) => `${p.code} cho ${p.lsx_code}`).join(', ')}`}{' '}
            · tồn đã đổi.
          </span>
          <Link href={`/print/warehouse/${ketQua.doc_id}`} className="kh-btn">
            In biên bản 05-VT
          </Link>
          <Link href={`/warehouse/phieu/${ketQua.doc_id}`} className="kh-btn">
            Xem phiếu
          </Link>
          {ketQua.xuat_bu.map((p) => (
            <Link key={p.id} href={`/warehouse/phieu/${p.id}`} className="kh-btn">
              {p.code}
            </Link>
          ))}
          <button type="button" className="kh-btn dong" onClick={() => setKetQua(null)}>
            Đóng
          </button>
        </div>
      )}
      {ketQua?.trang_thai === 'cho_duyet' && (
        <div className="kh-note" role="status">
          <span className="tag">Đã gửi</span>
          <span>
            Đợt <b className="kh-num">{ketQua.code}</b> chờ trưởng kho duyệt — tồn CHƯA
            đổi.
          </span>
          <Link href={`/warehouse/kiem-ke/${ketQua.id}`} className="kh-btn">
            Mở đợt
          </Link>
          <button type="button" className="kh-btn dong" onClick={() => setKetQua(null)}>
            Đóng
          </button>
        </div>
      )}
      {choDuyet.length > 0 && (
        <div className="kh-note mut">
          <span className="tag">
            {laTruong ? 'Chờ bạn duyệt' : 'Chờ trưởng kho duyệt'}
          </span>
          <span className="cn-cho">
            {choDuyet.map((c) => (
              <Link key={c.id} href={`/warehouse/kiem-ke/${c.id}`} className="kh-lnk">
                {c.code} · {c.nguoi ?? '?'} · {c.so_ma} mã · {ngayGioVn(c.luc)}
              </Link>
            ))}
          </span>
        </div>
      )}

      <div className="kh-hc" role="group" aria-label="Đầu phiếu cập nhật">
        <div>
          <span className="k">Người ghi</span>
          <span className="v">
            {nguoiGhi} · {laTruong ? 'trưởng kho' : 'NV kho'}
          </span>
        </div>
        <div>
          <span className="k">Ngày đếm</span>
          <span className="v mut">hôm nay · số trên máy chốt lúc bấm ghi</span>
        </div>
        <div>
          <span className="k">Lý do chung</span>
          <select
            id="cn-ly-chung"
            className="kh-o"
            value={dau.ly_do_chung}
            onChange={(e) =>
              setDau((d) => ({ ...d, ly_do_chung: e.target.value as MaLyDoCapNhat }))
            }
            aria-label="Lý do chung"
            disabled={busy}
            style={{ width: 240 }}
          >
            {LY_DO_CAP_NHAT.map((x) => (
              <option key={x.ma} value={x.ma}>
                {x.nhan}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 260px' }}>
          <span className="k">Ghi chú chung</span>
          <OChu
            id="cn-gc-chung"
            value={dau.ghi_chu}
            onCommit={(v) => setDau((d) => ({ ...d, ghi_chu: v }))}
            placeholder="không bắt buộc · in lên biên bản"
            label="Ghi chú chung"
            disabled={busy}
          />
        </div>
      </div>

      {/* Ô tìm đứng NGOÀI khung cuộn của lưới — gợi ý rơi xuống lưới, không bị cắt. */}
      <div className="kh-them">
        <span className="lbl">+ Thêm mã</span>
        <OTim<VatTu>
          id="cn-tim"
          search={timVatTu}
          onPick={(vt) => void chonVatTu(vt)}
          keyOf={(m) => m.id}
          render={(m) => (
            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b className="kh-ma">{m.code}</b>
              <span>{m.name}</span>
              <span className="kh-mut" style={{ marginLeft: 'auto' }}>
                {m.unit}
              </span>
            </span>
          )}
          placeholder={
            dangTra
              ? 'Đang tra số trên máy…'
              : 'Gõ mã hoặc tên vật tư · Enter để thêm dòng'
          }
          label="Tìm vật tư để thêm dòng"
          disabled={dangTra || busy}
          width={420}
          rong="Không có vật tư nào khớp"
        />
        {bao && (
          <span className="bao kh-warn" role="status">
            {bao}
          </span>
        )}
        <span className="kh-mut" style={{ marginLeft: 'auto' }}>
          Tab sang số · Ctrl+Enter ghi
        </span>
      </div>

      {rows.length === 0 ? (
        <Rong
          tieuDe="Chưa có mã nào để cập nhật"
          lyDo="Gõ mã ở ô “Thêm mã” phía trên, hoặc vào Tồn kho, chọn mã rồi bấm “Cập nhật số thực tế”. Đếm cả một nhóm vật tư thì dùng Kiểm kê định kỳ."
          tiep={
            <Link href="/warehouse/ton" className="kh-btn">
              Mở Tồn kho
            </Link>
          }
        />
      ) : (
        <LuoiCapNhat
          rows={rows}
          dau={dau}
          loi={loi}
          daThu={daThu}
          patch={patch}
          xoa={(i) => setRows((rs) => rs.filter((_, j) => j !== i))}
          tong={tong}
          busy={busy}
        />
      )}

      {/* THANH CHỐT ĐÁY — nói vì sao chưa ghi được bằng câu BẤM ĐƯỢC. */}
      <div className="kh-commit" role="group" aria-label="Ghi cập nhật">
        <span className="m">
          <span className="k">Mã</span>
          <span className="v">{tong.dong}</span>
        </span>
        <span className="m">
          <span className="k">Thừa</span>
          <span className="v">{tong.thua}</span>
        </span>
        <span className="m">
          <span className="k">Thiếu</span>
          <span className="v">{tong.thieu}</span>
        </span>
        <span className="m">
          <span className="k">Xuất bù cho lệnh</span>
          <span className="v">{tong.xuat_bu}</span>
        </span>
        {loiGhi ? (
          <span className="why" role="alert">
            Chưa ghi được: {loiGhi}
          </span>
        ) : blocked && !busy && (daThu || !canEdit) ? (
          <button type="button" className="why" onClick={bamGhi}>
            Chưa ghi được: {blocked}
          </button>
        ) : (
          <span className="why" />
        )}
        <span className="ghi">
          <span className="kh-kbd">Ctrl + Enter</span>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={!canEdit || busy || undefined}
            title={blocked}
            onClick={bamGhi}
          >
            {busy ? 'Đang ghi…' : laTruong ? 'Ghi cập nhật' : 'Gửi trưởng kho duyệt'}
          </button>
        </span>
      </div>

      <ThanhTT
        left="Trên máy = tồn lúc thêm dòng, máy tính lại lúc ghi · thừa ghi N4, thiếu ghi X5, tổ đã lấy ghi phiếu xuất cho lệnh"
        right="Kiểm kê định kỳ (đếm mù, cả nhóm) ở mục Kiểm kê"
      />
    </KhoKhung>
  )
}
