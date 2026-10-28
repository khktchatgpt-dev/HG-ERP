'use client'

import { useState } from 'react'
import { parsePoPaste } from '@/lib/po-paste'
import { HopThoai, INPUT, Nhan, Nut, O } from '../_erp/ui'
import type { TraGiaCtx } from './useTraGia'

const MAU = `Tên vật tư\tSL\tĐVT
Nhôm phi 25 x1.0 dài 5.8m\t650\tkg
Bulon 6x20x13 xi trắng\t5.000\tcon`

/**
 * DÁN DANH SÁCH TỪ EXCEL — dùng lại bộ đọc dán của form soạn đơn (`parsePoPaste`):
 * nhận cột theo tiêu đề (Tên / Mã · SL…) hoặc tự đoán, đọc số kiểu Việt Nam
 * ("5.000" = năm nghìn). Bỏ dòng tổng / dòng trống và NÓI RA số dòng bỏ.
 */
export function HopDan({ d }: { d: TraGiaCtx }) {
  const [text, setText] = useState('')
  const r = text.trim() ? parsePoPaste(text, 200) : null
  const n = r?.lines.length ?? 0
  const them = () => {
    if (!r) return
    d.dan(r.lines)
    d.setHopDan(false)
  }
  return (
    <HopThoai
      title="Dán danh sách từ Excel"
      aside="Ctrl+V vào ô dưới"
      width={620}
      onClose={() => d.setHopDan(false)}
      footer={
        <>
          <Nut onClick={() => d.setHopDan(false)}>Thôi</Nut>
          <Nut
            chinh
            khoa={
              n ? undefined : 'Chưa đọc được dòng nào — dán vùng bảng có cột tên vật tư'
            }
            onClick={them}
          >
            {n ? `Thêm ${n} món` : 'Thêm'}
          </Nut>
        </>
      }
    >
      <O
        label="Dữ liệu dán"
        help={
          <>
            Nhận cột theo tiêu đề: <b>Tên vật tư</b> (hoặc <b>Mã</b>) · <b>SL</b>. Số đọc
            kiểu Việt Nam: “1.200” là một nghìn hai trăm. Tối đa 200 món một lượt.
          </>
        }
      >
        <textarea
          aria-label="Dữ liệu dán từ Excel"
          className={`${INPUT} h-[160px] resize-y font-mono text-[12px] leading-relaxed`}
          spellCheck={false}
          value={text}
          placeholder={MAU}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </O>
      {r && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <Nhan tone={n ? 'done' : 'warn'}>{n} món đọc được</Nhan>
          {r.skipped > 0 && (
            <Nhan tone="warn">{r.skipped} dòng bỏ (tổng / trống tên)</Nhan>
          )}
          <span className="text-[var(--ink-3)]">
            {r.headerDetected
              ? 'Đọc theo hàng tiêu đề.'
              : 'Không thấy hàng tiêu đề — đang đoán cột.'}
          </span>
        </div>
      )}
      {r && n > 0 && (
        <div className="max-h-[140px] overflow-auto border border-[var(--hair)] text-[12px]">
          {r.lines.slice(0, 8).map((l, i) => (
            <div
              key={i}
              className="flex gap-3 border-b border-[var(--hair)] px-2 py-1 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">{l.name || l.code}</span>
              <span className="font-mono text-[var(--ink-3)]">{l.qty ?? ''}</span>
            </div>
          ))}
          {n > 8 && (
            <div className="px-2 py-1 text-[var(--ink-3)]">… và {n - 8} món nữa</div>
          )}
        </div>
      )}
    </HopThoai>
  )
}
