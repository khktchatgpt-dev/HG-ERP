import type {
  StageConfigPayload,
  StageConfigView,
} from '@/modules/dept/production/stage-config.service'
import type { StageMeta } from '@/lib/stage-config'

/**
 * Kiểu dùng chung giữa `CongDoanScreen` · `useCongDoan` · `bang-cau-hinh`.
 * Chỉ `import type` từ `@/modules/*` (luật hg/client-server-boundary).
 */

export type ORieng = {
  /** id dòng thật, hoặc null khi vừa thêm trên màn. */
  id: string | null
  field_key: string
  label: string
  kind: 'text' | 'number' | 'select'
  /** Lựa chọn gõ một ô, cách nhau bằng dấu phẩy — tách lúc gửi. */
  options_text: string
  required: boolean
  min_value: string
  max_value: string
}

export type MaLoi = { id: string | null; code: string; label: string }

/** Bản nháp của công đoạn đang sửa — so với bản gốc để biết "đã đổi gì". */
export type BanNhap = {
  code: string
  label: string
  meta: StageMeta
  team_ids: string[]
  fields: ORieng[]
  defect_codes: MaLoi[]
}

export type ThemCongDoan = { code: string; label: string }

export type CongDoanCtx = {
  data: StageConfigPayload
  stages: StageConfigView[]
  chon: StageConfigView | null
  nhap: BanNhap | null
  dirty: boolean
  busy: boolean
  loi: string | null
  /** Thông báo tại chỗ sau khi lưu (không toast). */
  thongBao: string | null
  them: ThemCongDoan | null
  chonCongDoan: (code: string) => void
  doiNhap: (patch: Partial<BanNhap>) => void
  doiMeta: (patch: Partial<StageMeta>) => void
  doiCore: (
    field: keyof StageMeta['core'],
    mode: StageMeta['core'][keyof StageMeta['core']],
  ) => void
  toggleTo: (teamId: string) => void
  themORieng: () => void
  suaORieng: (i: number, patch: Partial<ORieng>) => void
  boORieng: (i: number) => void
  themMaLoi: () => void
  suaMaLoi: (i: number, patch: Partial<MaLoi>) => void
  boMaLoi: (i: number) => void
  luu: () => Promise<void>
  huy: () => void
  moThem: () => void
  dongThem: () => void
  doiThem: (patch: Partial<ThemCongDoan>) => void
  taoCongDoan: () => Promise<void>
  ngungDung: (active: boolean) => Promise<void>
}

export function fromView(v: StageConfigView): BanNhap {
  return {
    code: v.code,
    label: v.label,
    meta: {
      count_level: v.meta.count_level,
      core: { ...v.meta.core },
      input_from: v.meta.input_from,
    },
    team_ids: [...v.team_ids],
    fields: v.fields.map((f) => ({
      id: f.id,
      field_key: f.field_key,
      label: f.label,
      kind: f.kind,
      options_text: (f.options ?? []).join(', '),
      required: f.required,
      min_value: f.min_value == null ? '' : String(f.min_value),
      max_value: f.max_value == null ? '' : String(f.max_value),
    })),
    defect_codes: v.defect_codes.map((d) => ({ id: d.id, code: d.code, label: d.label })),
  }
}

/** Khoá/mã tự sinh từ nhãn: "Loại máy hàn" → "loai_may_han". */
export function toKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}
