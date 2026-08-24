import { db } from '@/server/db'
import { NotFound } from '@/server/http'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  DEFAULT_DOC_TEMPLATES,
  DOC_KINDS,
  isDocKind,
  type DocKind,
  type DocTemplate,
  type SignatureCol,
} from '@/lib/doc-templates'
import type { DocTemplateUpdate } from './doc-templates.schema'

/**
 * MẪU CHỨNG TỪ (0164) — đọc/ghi quy tắc đánh số + khuôn mẫu in.
 *
 * NGUYÊN TẮC "MẶC ĐỊNH AN TOÀN": mọi lượt đọc đều PHỦ bản ghi DB lên mặc định
 * trong code, và lỗi đọc DB thì trả nguyên mặc định. Sáu trang in gọi hàm này ở
 * mỗi lần render; bảng chưa áp migration, mất mạng một nhịp, hay ai đó xoá một
 * hàng — phiếu vẫn phải in ra đúng như trước chứ không được trắng tiêu đề.
 *
 * Quyền GHI: `system.settings.manage` (admin) — cùng chìa với cấu hình công ty.
 * Quyền ĐỌC: không gác. Đây là khuôn giấy tờ, mọi phiếu in đều cần.
 */

type Row = {
  kind: string
  label: string | null
  prefix: string | null
  pattern: string | null
  seq_pad: number | null
  reset_scope: string | null
  title_vi: string | null
  title_en: string | null
  national_heading: boolean | null
  form_no: string | null
  signatures: unknown
  default_terms: string | null
  updated_at: string | null
  updated_by: string | null
}

export type DocTemplateView = DocTemplate & {
  updated_at: string | null
  updated_by_name: string | null
}

/**
 * Ô chữ ký từ DB là jsonb — lọc lấy đúng phần dùng được, bỏ rác im lặng.
 *
 * PHẢI GIỮ `slot`: đó là chỗ MÓC tên người từ chứng từ (người lập / người
 * duyệt / người giao-nhận). Bản đầu bỏ sót nó, hậu quả là phiếu nhập-xuất kho
 * in ra mất tên người lập và tên người giao hàng — nét ký trống trơn mà không
 * ai báo lỗi gì.
 */
const SLOTS = ['creator', 'approver', 'counterparty'] as const
function parseSignatures(raw: unknown, fallback: SignatureCol[]): SignatureCol[] {
  if (!Array.isArray(raw)) return fallback
  const out: SignatureCol[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: unknown }).role
    if (typeof role !== 'string' || !role.trim()) continue
    const hint = (item as { hint?: unknown }).hint
    const slot = (item as { slot?: unknown }).slot
    out.push({
      role: role.trim(),
      ...(typeof hint === 'string' && hint.trim() ? { hint: hint.trim() } : {}),
      ...((SLOTS as readonly unknown[]).includes(slot)
        ? { slot: slot as SignatureCol['slot'] }
        : {}),
    })
  }
  return out
}

/** Bản ghi DB PHỦ lên mặc định — thiếu trường nào thì lấy mặc định trường đó. */
function merge(kind: DocKind, row: Row | undefined): DocTemplate {
  const d = DEFAULT_DOC_TEMPLATES[kind]
  if (!row) return d
  const reset = row.reset_scope
  return {
    ...d,
    label: row.label ?? d.label,
    prefix: 'prefix' in row ? row.prefix : d.prefix,
    pattern: row.pattern ?? d.pattern,
    seq_pad: row.seq_pad ?? d.seq_pad,
    reset_scope:
      reset === 'year' || reset === 'month' || reset === 'never' ? reset : d.reset_scope,
    title_vi: row.title_vi ?? d.title_vi,
    title_en: 'title_en' in row ? row.title_en : d.title_en,
    national_heading: row.national_heading ?? d.national_heading,
    form_no: 'form_no' in row ? row.form_no : d.form_no,
    signatures: parseSignatures(row.signatures, d.signatures),
    default_terms: row.default_terms ?? d.default_terms,
  }
}

async function fetchRows(): Promise<Map<string, Row>> {
  try {
    const { data, error } = await db().from('doc_templates').select('*')
    if (error) throw new Error(error.message)
    return new Map((data ?? []).map((r) => [(r as Row).kind, r as Row]))
  } catch (err) {
    // NUỐT LỖI có chủ ý: phiếu in phải ra giấy kể cả khi bảng cấu hình hỏng.
    console.error('[doc-templates] đọc cấu hình lỗi, dùng mặc định:', err)
    return new Map()
  }
}

export const docTemplatesService = {
  /** Khuôn của MỘT loại chứng từ — trang in gọi hàm này. */
  async get(kind: DocKind): Promise<DocTemplate> {
    const rows = await fetchRows()
    return merge(kind, rows.get(kind))
  },

  /** Khuôn của mọi loại — màn cấu hình. */
  async list(): Promise<DocTemplateView[]> {
    const rows = await fetchRows()
    const names = await userNames([...rows.values()].map((r) => r.updated_by))
    return DOC_KINDS.map((kind) => {
      const row = rows.get(kind)
      return {
        ...merge(kind, row),
        updated_at: row?.updated_at ?? null,
        updated_by_name: row?.updated_by ? (names.get(row.updated_by) ?? null) : null,
      }
    })
  },

  /**
   * Sửa một mẫu. Ghi kèm NGƯỜI SỬA — cấu hình công ty (`settings`) đang không
   * ghi vết ai đổi gì, và đó chính là chỗ đáng sợ nhất khi số tài khoản ngân
   * hàng trên hợp đồng đổi mà không ai biết. Bảng này không lặp lại lỗi đó.
   */
  async update(user: User, kind: string, patch: DocTemplateUpdate): Promise<DocTemplate> {
    await assertAction(user, 'system.settings.manage')
    if (!isDocKind(kind)) throw NotFound(`Không có loại chứng từ "${kind}"`)

    const d = DEFAULT_DOC_TEMPLATES[kind]
    const { error } = await db()
      .from('doc_templates')
      .upsert({
        kind,
        // `label` không cho sửa: nó là tên gọi của loại chứng từ trong code.
        label: d.label,
        title_vi: patch.title_vi ?? d.title_vi,
        ...patch,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
    if (error) throw new Error(error.message)
    return this.get(kind)
  },

  /** Trả một mẫu về đúng giá trị gốc trong code. */
  async reset(user: User, kind: string): Promise<DocTemplate> {
    await assertAction(user, 'system.settings.manage')
    if (!isDocKind(kind)) throw NotFound(`Không có loại chứng từ "${kind}"`)
    const d = DEFAULT_DOC_TEMPLATES[kind]
    const { error } = await db().from('doc_templates').upsert({
      kind,
      label: d.label,
      prefix: d.prefix,
      pattern: d.pattern,
      seq_pad: d.seq_pad,
      reset_scope: d.reset_scope,
      title_vi: d.title_vi,
      title_en: d.title_en,
      national_heading: d.national_heading,
      form_no: d.form_no,
      signatures: d.signatures,
      default_terms: d.default_terms,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return d
  },

  /**
   * Số kế tiếp của từng loại — màn cấu hình bày để người sửa thấy ngay "đơn tới
   * sẽ mang mã gì", không phải lập thử một phiếu rồi xoá.
   */
  async nextSeqs(): Promise<Record<string, number>> {
    try {
      const { data } = await db().from('doc_counters').select('kind, year, last_no')
      const now = new Date()
      const out: Record<string, number> = {}
      for (const r of (data ?? []) as { kind: string; year: number; last_no: number }[]) {
        // Chỉ lấy bộ đếm của KỲ hiện tại; kỳ cũ để đó, không nói gì về mã tới.
        const isNow =
          r.year === now.getFullYear() ||
          r.year === now.getFullYear() * 100 + now.getMonth() + 1 ||
          r.year === 0
        if (isNow) out[r.kind] = Math.max(out[r.kind] ?? 0, r.last_no + 1)
      }
      return out
    } catch {
      return {}
    }
  },
}

/** Tên người sửa cuối — query nhẹ, thiếu tên thì thôi. */
async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))]
  if (!list.length) return new Map()
  const { data } = await db().from('users').select('id, name, email').in('id', list)
  return new Map(
    (data ?? []).map((u) => [
      u.id as string,
      (u.name as string | null) ?? (u.email as string),
    ]),
  )
}
