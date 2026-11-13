'use client'

import { TAT_CA_MA } from '@/lib/ghi-nhom'
import { fmt, isTyped } from './ghi.shared'
import { ThongTinMa } from './luoi-ghi'
import type { GhiCtx } from './useGhi'

/**
 * THANH CHỌN MÃ HÀNG (bản vẽ 12/11/2026 bản 3, https://claude.ai/artifact/6j48VVVcNEvMie7iNnbd3v,
 * Q11 + Q13): "Mã hàng ‹ [ô chọn] › 2/8 · phải làm … · đủ … bộ · hạn …".
 *
 * Bày MỘT mã thay vì cả 8 (chủ dự án: "cho phép chọn sản phẩm thay vì hiện
 * hết"); có "Tất cả mã hàng". Thanh nói luôn thông tin của mã nên đầu nhóm trong
 * bảng bỏ — không tốn thêm hàng. Gõ dở ở mã khác vẫn giữ (một phiếu ghi cả), ô
 * chọn đánh dấu mã đang có số. Chỉ hiện khi công đoạn có ≥ 2 mã hàng.
 */
export function ThanhMaHang({ d }: { d: GhiCtx }) {
  const { sheet, spChon } = d
  if (!d.nhieuMa) return null
  const list = sheet.groups
  const idx = list.findIndex((g) => g.product_code === spChon)
  const dangGo = (code: string) =>
    list
      .find((g) => g.product_code === code)
      ?.lines.filter((l) => isTyped(d.drafts[l.component_id])).length ?? 0
  const tongGo = d.typed.length
  const go = (i: number) => {
    const g = list[i]
    if (g) d.chonSp(g.product_code)
  }

  return (
    <div className="sx-spbar">
      <span className="lbl">Mã hàng</span>
      <button
        type="button"
        className="nav"
        onClick={() => go(idx - 1)}
        disabled={!d.motMa || idx <= 0}
        aria-label="Mã hàng trước"
      >
        ‹
      </button>
      <select
        className={d.motMa ? 'pick on' : 'pick'}
        value={spChon}
        onChange={(e) => d.chonSp(e.target.value)}
        aria-label="Chọn mã hàng"
      >
        {list.map((g) => {
          const n = dangGo(g.product_code)
          return (
            <option key={g.product_code} value={g.product_code}>
              {g.product_code} · {g.product_name}
              {n > 0 ? ` · ● đang gõ ${n}` : ''}
            </option>
          )
        })}
        <option value={TAT_CA_MA}>Tất cả mã hàng ({list.length})</option>
      </select>
      <button
        type="button"
        className="nav"
        onClick={() => go(idx + 1)}
        disabled={!d.motMa || idx >= list.length - 1}
        aria-label="Mã hàng sau"
      >
        ›
      </button>
      {d.motMa && d.nhomChon ? (
        <>
          <span className="mut num">
            {idx + 1} / {list.length}
          </span>
          <span className="sep" aria-hidden="true" />
          <span className="info">
            <ThongTinMa d={d} g={d.nhomChon} lead={false} />
          </span>
        </>
      ) : (
        <span className="mut">mọi mã hàng của lệnh, mỗi mã một nhóm</span>
      )}
      {tongGo > 0 && <span className="dg">● đang gõ {fmt(tongGo)} dòng</span>}
    </div>
  )
}
