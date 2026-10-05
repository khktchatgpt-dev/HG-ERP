'use client'

import { useEffect, useState } from 'react'
import { Btn, Code, NoticeBar, TextInput, Tick } from '@/components/kit'
import { api } from '@/lib/api'

/**
 * PHẦN RIÊNG CỦA "THÊM VẬT TƯ" (05/10/2026, bản vẽ Bản 11 · V1, chủ dự án
 * duyệt). Panel Thêm là CHÍNH panel Sửa (`sua-vat-tu.tsx`, `m = null`) — cùng
 * bộ ô, cùng luật barem / ĐVT lạ — chỉ thêm hai thứ ở đây: ô Mã tự cấp và bước
 * đối chiếu tên gần giống.
 */

/**
 * MÃ TỰ CẤP — xem trước mã server SẼ cấp cho nhóm đang chọn (`GET
 * materials/next-code`, đúng hàm `create` dùng). Gõ mã riêng chỉ khi thật cần
 * (vd. nối tiếp nếp mã cũ BUL0608 của sổ Drive).
 */
export function useMaMoi(enabled: boolean, group: string) {
  const [preview, setPreview] = useState<{ group: string; code: string | null }>({
    group: '',
    code: null,
  })
  const [rieng, setRieng] = useState(false)
  const [code, setCode] = useState('')
  useEffect(() => {
    if (!enabled || !group) return
    let live = true
    api<{ code: string }>(
      `/api/dept/warehouse/materials/next-code?group_name=${encodeURIComponent(group)}`,
    )
      .then((r) => live && setPreview({ group, code: r.code }))
      .catch(() => live && setPreview({ group, code: null }))
    return () => {
      live = false
    }
  }, [enabled, group])
  return {
    /** Mã dự kiến của ĐÚNG nhóm đang chọn (nhóm vừa đổi thì chưa có). */
    preview: group && preview.group === group ? preview.code : null,
    group,
    rieng,
    code,
    setCode,
    goRieng: () => setRieng(true),
    tuCap: () => {
      setRieng(false)
      setCode('')
    },
  } as const
}
export type MaMoi = ReturnType<typeof useMaMoi>

export function MaMoiO({ ma }: { ma: MaMoi }) {
  if (ma.rieng)
    return (
      <span className="flex items-center gap-2">
        <TextInput
          value={ma.code}
          onCommit={ma.setCode}
          label="Mã vật tư gõ riêng"
          placeholder="vd: BUL0609"
        />
        <Btn onClick={ma.tuCap}>Tự cấp mã</Btn>
      </span>
    )
  return (
    <span className="text-k-sm flex items-center gap-2">
      {ma.preview ? (
        <>
          <Code>{ma.preview}</Code>
          <span className="text-[var(--ink-3)]">tự cấp khi lưu</span>
        </>
      ) : (
        <span className="text-[var(--ink-3)]">
          {ma.group ? 'Đang tính mã…' : 'Chọn nhóm để cấp mã'}
        </span>
      )}
      <Btn className="ml-auto" onClick={ma.goRieng}>
        Gõ mã riêng
      </Btn>
    </span>
  )
}

/**
 * ĐỐI CHIẾU TÊN GẦN GIỐNG — có mã gần giống thì phải tick "hàng khác" mới
 * thêm được. Tên trùng HẲN (chỉ khác dấu câu / khoảng trắng) thì server chặn
 * cứng và chỉ ra mã đang có — đây là lớp mềm phía trước.
 */
export function DoiChieuGanGiong({
  similar,
  ok,
  onOk,
  onOpenCode,
}: {
  similar: { code: string; name: string }[]
  ok: boolean
  onOk: (on: boolean) => void
  onOpenCode?: (code: string) => void
}) {
  return (
    <div className="border border-[var(--warn-line)] bg-[var(--warn-wash)]">
      <NoticeBar tag="Gần giống">
        Nhóm này đã có {similar.length} mã gần giống — xem có phải cùng một món không. Hai
        mã một hàng thì đơn và tồn tách làm hai.
      </NoticeBar>
      <div className="text-k-sm grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-[var(--gutter)] py-2">
        {similar.map((x) => (
          <div key={x.code} className="contents">
            <Code>{x.code}</Code>
            <span className="truncate" title={x.name}>
              {x.name}
            </span>
            {onOpenCode ? (
              <Btn onClick={() => onOpenCode(x.code)}>Mở mã này</Btn>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      <label className="text-k-sm flex items-center gap-2 border-t border-[var(--warn-line)] px-[var(--gutter)] py-2">
        <Tick
          checked={ok}
          onChange={onOk}
          label="Đã đối chiếu các mã gần giống — đây là hàng khác"
        />
        <span>
          Tôi đã đối chiếu — đây là <b>hàng khác</b>, vẫn thêm mã mới
        </span>
      </label>
      <p className="text-k-sm px-[var(--gutter)] pb-2 text-[var(--ink-3)]">
        Tên trùng hẳn (chỉ khác dấu câu / khoảng trắng) thì không thêm được — hệ thống chỉ ra
        mã đang có.
      </p>
    </div>
  )
}
