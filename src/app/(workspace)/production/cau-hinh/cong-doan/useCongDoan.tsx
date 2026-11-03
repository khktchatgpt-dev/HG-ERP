'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import type { StageConfigPayload } from '@/modules/dept/production/stage-config.service'
import type { StageMeta } from '@/lib/stage-config'
import {
  fromView,
  toKey,
  type BanNhap,
  type CongDoanCtx,
  type MaLoi,
  type ORieng,
  type ThemCongDoan,
} from './cong-doan.shared'

/**
 * Toàn bộ trạng thái + xử lý của màn Cấu hình công đoạn.
 *
 * Bản nháp (`nhap`) tách khỏi payload server: sửa bên phải không đụng lưới
 * trái cho tới khi Lưu. Đang có thay đổi chưa lưu thì KHÔNG cho đổi dòng — nói
 * tại chỗ thay vì hỏi hộp thoại (chọn dòng khác rồi mất công sửa là lỗi im
 * lặng nguy nhất của màn cấu hình).
 */
export function useCongDoan(initial: StageConfigPayload): CongDoanCtx {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [code, setCode] = useState<string | null>(initial.stages[0]?.code ?? null)
  const [nhap, setNhap] = useState<BanNhap | null>(
    initial.stages[0] ? fromView(initial.stages[0]) : null,
  )
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [them, setThem] = useState<ThemCongDoan | null>(null)

  const chon = useMemo(
    () => data.stages.find((s) => s.code === code) ?? null,
    [data, code],
  )
  const goc = useMemo(() => (chon ? fromView(chon) : null), [chon])
  const dirty = useMemo(
    () => !!nhap && !!goc && JSON.stringify(nhap) !== JSON.stringify(goc),
    [nhap, goc],
  )

  const apDung = useCallback(
    (payload: StageConfigPayload, keepCode: string | null) => {
      setData(payload)
      const v =
        payload.stages.find((s) => s.code === keepCode) ?? payload.stages[0] ?? null
      setCode(v?.code ?? null)
      setNhap(v ? fromView(v) : null)
      // Sidebar / màn khác đọc cùng danh mục — làm mới RSC.
      router.refresh()
    },
    [router],
  )

  const chonCongDoan = useCallback(
    (c: string) => {
      if (dirty) {
        setLoi(
          `Đang sửa "${nhap?.label}" chưa lưu — bấm Lưu hoặc Huỷ trước khi chọn công đoạn khác`,
        )
        return
      }
      const v = data.stages.find((s) => s.code === c)
      if (!v) return
      setCode(c)
      setNhap(fromView(v))
      setLoi(null)
      setThongBao(null)
      setThem(null)
    },
    [data, dirty, nhap],
  )

  const doiNhap = useCallback((patch: Partial<BanNhap>) => {
    setNhap((n) => (n ? { ...n, ...patch } : n))
    setLoi(null)
  }, [])

  const doiMeta = useCallback((patch: Partial<StageMeta>) => {
    setNhap((n) => (n ? { ...n, meta: { ...n.meta, ...patch } } : n))
    setLoi(null)
  }, [])

  const doiCore: CongDoanCtx['doiCore'] = useCallback((field, mode) => {
    setNhap((n) =>
      n ? { ...n, meta: { ...n.meta, core: { ...n.meta.core, [field]: mode } } } : n,
    )
  }, [])

  const toggleTo = useCallback((teamId: string) => {
    setNhap((n) => {
      if (!n) return n
      const has = n.team_ids.includes(teamId)
      return {
        ...n,
        team_ids: has ? n.team_ids.filter((t) => t !== teamId) : [...n.team_ids, teamId],
      }
    })
  }, [])

  const themORieng = useCallback(() => {
    setNhap((n) =>
      n
        ? {
            ...n,
            fields: [
              ...n.fields,
              {
                id: null,
                field_key: '',
                label: '',
                kind: 'text',
                options_text: '',
                required: false,
                min_value: '',
                max_value: '',
              },
            ],
          }
        : n,
    )
  }, [])

  const suaORieng = useCallback((i: number, patch: Partial<ORieng>) => {
    setNhap((n) => {
      if (!n) return n
      const fields = n.fields.map((f, k) => {
        if (k !== i) return f
        const next = { ...f, ...patch }
        // Khoá tự sinh từ nhãn khi ô còn MỚI (chưa có id) và người dùng chưa gõ khoá tay.
        if (
          patch.label !== undefined &&
          f.id === null &&
          (f.field_key === '' || f.field_key === toKey(f.label))
        ) {
          next.field_key = toKey(patch.label)
        }
        return next
      })
      return { ...n, fields }
    })
  }, [])

  const boORieng = useCallback((i: number) => {
    setNhap((n) => (n ? { ...n, fields: n.fields.filter((_, k) => k !== i) } : n))
  }, [])

  const themMaLoi = useCallback(() => {
    setNhap((n) =>
      n
        ? { ...n, defect_codes: [...n.defect_codes, { id: null, code: '', label: '' }] }
        : n,
    )
  }, [])

  const suaMaLoi = useCallback((i: number, patch: Partial<MaLoi>) => {
    setNhap((n) => {
      if (!n) return n
      const defect_codes = n.defect_codes.map((d, k) => {
        if (k !== i) return d
        const next = { ...d, ...patch }
        if (
          patch.label !== undefined &&
          d.id === null &&
          (d.code === '' || d.code === `${n.code}_${toKey(d.label)}`)
        ) {
          next.code = `${n.code}_${toKey(patch.label)}`
        }
        return next
      })
      return { ...n, defect_codes }
    })
  }, [])

  const boMaLoi = useCallback((i: number) => {
    setNhap((n) =>
      n ? { ...n, defect_codes: n.defect_codes.filter((_, k) => k !== i) } : n,
    )
  }, [])

  const luu = useCallback(async () => {
    if (!nhap || !goc) return
    setBusy(true)
    setLoi(null)
    try {
      const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
      const body: Record<string, unknown> = {}
      if (nhap.label !== goc.label) body.label = nhap.label
      if (JSON.stringify(nhap.meta) !== JSON.stringify(goc.meta)) body.meta = nhap.meta
      if (JSON.stringify(nhap.team_ids) !== JSON.stringify(goc.team_ids))
        body.team_ids = nhap.team_ids
      if (JSON.stringify(nhap.fields) !== JSON.stringify(goc.fields)) {
        body.fields = nhap.fields.map((f, i) => ({
          field_key: f.field_key,
          label: f.label,
          kind: f.kind,
          options:
            f.kind === 'select'
              ? f.options_text
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : null,
          required: f.required,
          min_value: f.kind === 'number' ? num(f.min_value) : null,
          max_value: f.kind === 'number' ? num(f.max_value) : null,
          sort_order: (i + 1) * 10,
        }))
      }
      if (JSON.stringify(nhap.defect_codes) !== JSON.stringify(goc.defect_codes)) {
        body.defect_codes = nhap.defect_codes.map((d, i) => ({
          code: d.code,
          label: d.label,
          sort_order: (i + 1) * 10,
        }))
      }
      const payload = await api<StageConfigPayload>(
        `/api/dept/production/cau-hinh/cong-doan/${encodeURIComponent(nhap.code)}`,
        { method: 'PATCH', body },
      )
      apDung(payload, nhap.code)
      const gio = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      setThongBao(`Đã lưu "${nhap.label}" lúc ${gio}`)
    } catch (e) {
      setLoi(apiErrorText(e, 'Lưu không được, thử lại'))
    } finally {
      setBusy(false)
    }
  }, [nhap, goc, apDung])

  const huy = useCallback(() => {
    if (chon) setNhap(fromView(chon))
    setLoi(null)
  }, [chon])

  const moThem = useCallback(() => {
    if (dirty) {
      setLoi(`Đang sửa "${nhap?.label}" chưa lưu — Lưu hoặc Huỷ trước khi thêm công đoạn`)
      return
    }
    setThem({ code: '', label: '' })
    setLoi(null)
  }, [dirty, nhap])

  const dongThem = useCallback(() => setThem(null), [])

  const doiThem = useCallback((patch: Partial<ThemCongDoan>) => {
    setThem((t) => {
      if (!t) return t
      const next = { ...t, ...patch }
      if (patch.label !== undefined && (t.code === '' || t.code === toKey(t.label))) {
        next.code = toKey(patch.label)
      }
      return next
    })
  }, [])

  const taoCongDoan = useCallback(async () => {
    if (!them) return
    setBusy(true)
    setLoi(null)
    try {
      const payload = await api<StageConfigPayload>(
        '/api/dept/production/cau-hinh/cong-doan',
        {
          method: 'POST',
          body: { code: them.code, label: them.label },
        },
      )
      apDung(payload, them.code)
      setThem(null)
      setThongBao(
        `Đã thêm công đoạn "${them.label}" — khai đếm bằng gì và tổ phụ trách rồi Lưu`,
      )
    } catch (e) {
      setLoi(apiErrorText(e, 'Thêm không được, thử lại'))
    } finally {
      setBusy(false)
    }
  }, [them, apDung])

  const ngungDung = useCallback(
    async (active: boolean) => {
      if (!chon) return
      setBusy(true)
      setLoi(null)
      try {
        const payload = await api<StageConfigPayload>(
          `/api/dept/production/cau-hinh/cong-doan/${encodeURIComponent(chon.code)}`,
          { method: 'PATCH', body: { is_active: active } },
        )
        apDung(payload, chon.code)
        setThongBao(
          active ? `Đã dùng lại "${chon.label}"` : `Đã ngừng dùng "${chon.label}"`,
        )
      } catch (e) {
        setLoi(apiErrorText(e, 'Không đổi được, thử lại'))
      } finally {
        setBusy(false)
      }
    },
    [chon, apDung],
  )

  return {
    data,
    stages: data.stages,
    chon,
    nhap,
    dirty,
    busy,
    loi,
    thongBao,
    them,
    chonCongDoan,
    doiNhap,
    doiMeta,
    doiCore,
    toggleTo,
    themORieng,
    suaORieng,
    boORieng,
    themMaLoi,
    suaMaLoi,
    boMaLoi,
    luu,
    huy,
    moThem,
    dongThem,
    doiThem,
    taoCongDoan,
    ngungDung,
  } as const
}
