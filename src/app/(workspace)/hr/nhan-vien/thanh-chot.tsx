'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { LoiO } from '@/lib/nhan-su/sua-bang'
import type { DsCtx } from './useNhanVienDs'

/**
 * Thanh chốt đáy của Sửa trên bảng (bản vẽ B): bao nhiêu ô / người đã đổi, ô sai đầu tiên là
 * câu BẤM ĐƯỢC nhảy tới đúng ô, Bỏ thay đổi hỏi lại tại chỗ, Lưu khoá kèm lý do khi còn ô sai.
 */
export function ThanhChot({ d }: { d: DsCtx }) {
  const { tong, luuDang, coChu } = d.sb
  const [hoiBo, setHoiBo] = useState(false)
  const l = tong.loi[0]
  const ma = l && d.h.nv.ds.find((n) => n.id === l.id)?.code
  const why = luuDang
    ? 'Đang lưu…'
    : tong.loi.length
      ? `Còn ${tong.loi.length} ô sai — sửa hoặc Esc trả ô về cũ trước khi lưu`
      : !tong.o
        ? 'Chưa có ô nào đổi'
        : null

  /** Ô sai nằm trong nhóm đang thu gọn thì mở nhóm rồi mới nhảy tới. */
  function toi(x: LoiO) {
    const n = d.h.nv.ds.find((y) => y.id === x.id)
    const k = n?.boPhan ?? '__trong'
    if (d.nhom && d.dong.has(k)) {
      d.batDong(k)
      setTimeout(() => d.sb.toi(x), 50)
    } else d.sb.toi(x)
  }

  return (
    <div className="ns-chot" role="status">
      <span>
        Đã sửa <b className="num">{tong.o}</b> ô · <b className="num">{tong.nguoi}</b>{' '}
        người
      </span>
      {l && (
        <button type="button" className="ns-lnk why" onClick={() => toi(l)}>
          {tong.loi.length} ô sai: {ma} — {l.loi}. Bấm để tới ô đó
        </button>
      )}
      {d.bao && <span className={d.bao.ok ? 'ok' : 'loi'}>{d.bao.text}</span>}
      <span className="sp">
        {coChu && (
          <button
            type="button"
            className="ns-btn"
            onClick={() => {
              if (!hoiBo) return setHoiBo(true)
              d.sb.boHet()
              setHoiBo(false)
            }}
            onBlur={() => setHoiBo(false)}
          >
            {hoiBo
              ? `Bấm lần nữa để bỏ ${tong.o + tong.loi.length} ô đã gõ`
              : 'Bỏ thay đổi'}
          </button>
        )}
        <button
          type="button"
          className="ns-btn p"
          aria-disabled={why ? 'true' : undefined}
          title={why ?? undefined}
          onClick={() => (why ? d.setBao({ ok: false, text: why }) : d.sb.luu())}
        >
          <Check className="ico" aria-hidden />
          {luuDang ? 'Đang lưu…' : `Lưu ${tong.o} ô`}
        </button>
      </span>
    </div>
  )
}
