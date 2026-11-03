import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import {
  countingOf,
  parseStageMeta,
  defaultStageMeta,
  type Counting,
  type StageMeta,
} from '@/lib/stage-config'
import {
  stageConfigRepo,
  type DefectCodeRow,
  type StageFieldRow,
  type StageRow,
  type TeamRow,
} from './stage-config.repo'
import type { StageConfigPatch, StageCreateInput } from './stage-config.schema'
import type { User } from '@/modules/core/users/users.repo'

/**
 * CẤU HÌNH CÔNG ĐOẠN — B1 của docs/san-xuat-cau-hinh-thiet-ke.md (duyệt 03/11/2026).
 *
 * Một màn cho bốn thứ đang nằm ở bốn bảng: bậc đếm + ô lõi (catalog meta,
 * 0287) · tổ phụ trách (departments.stage_code, 0064) · ô riêng
 * (production_stage_fields, 0207) · mã lỗi (production_defect_codes, 0067).
 * Thêm công đoạn / đổi cách đếm / thêm ô = SỬA DỮ LIỆU, không sửa mã — mục 5
 * và 9 của bản tư vấn 03/11.
 *
 * Quyền: `production.stage.configure` — quản đốc (production.progress.track),
 * manager, admin. Xem cũng gác bằng quyền này: màn này là bàn điều khiển, không
 * phải tra cứu.
 */

export type StageConfigView = {
  id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  meta: StageMeta
  team_ids: string[]
  fields: StageFieldRow[]
  defect_codes: DefectCodeRow[]
  /** Số phiếu PBS đã ghi ở công đoạn — đổi cách đếm khi > 0 là chạm sổ cũ. */
  doc_count: number
}

export type StageConfigPayload = {
  stages: StageConfigView[]
  teams: TeamRow[]
  /** Mã lỗi dùng chung mọi công đoạn (stage_code null). */
  shared_defect_codes: DefectCodeRow[]
  /** Mốc đếm suy ra từ cấu hình — để màn bày "ghép ở Hàn · thành phẩm lắp ráp → hoàn thiện". */
  counting: Counting
}

function buildPayload(
  stages: StageRow[],
  teams: TeamRow[],
  fields: StageFieldRow[],
  codes: DefectCodeRow[],
  docCounts: Record<string, number>,
): StageConfigPayload {
  const active = stages.filter((s) => s.is_active)
  return {
    stages: stages.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      sort_order: s.sort_order,
      is_active: s.is_active,
      meta: parseStageMeta(s.code, s.meta),
      team_ids: teams.filter((t) => t.stage_code === s.code).map((t) => t.id),
      fields: fields.filter((f) => f.stage_code === s.code && f.is_active),
      defect_codes: codes.filter((d) => d.stage_code === s.code && d.is_active),
      doc_count: docCounts[s.code] ?? 0,
    })),
    teams,
    shared_defect_codes: codes.filter((d) => d.stage_code === null && d.is_active),
    counting: countingOf(active),
  }
}

export const stageConfigService = {
  async get(user: User): Promise<StageConfigPayload> {
    await assertAction(user, 'production.stage.configure')
    const [stages, teams, fields, codes, docCounts] = await Promise.all([
      stageConfigRepo.listStagesAll(),
      stageConfigRepo.listTeams(),
      stageConfigRepo.listFieldsAll(),
      stageConfigRepo.listDefectCodesAll(),
      stageConfigRepo.docCountByStage(),
    ])
    return buildPayload(stages, teams, fields, codes, docCounts)
  },

  /**
   * Sửa một công đoạn — từng phần của patch thay trọn phần đó. Trả payload mới
   * để màn vẽ lại từ cùng một nguồn.
   */
  async update(
    user: User,
    code: string,
    patch: StageConfigPatch,
  ): Promise<StageConfigPayload> {
    await assertAction(user, 'production.stage.configure')
    const stage = await stageConfigRepo.findStage(code)
    if (!stage) throw NotFound('Công đoạn không có trong danh mục')

    const stages = await stageConfigRepo.listStagesAll()
    const codes = new Set(stages.filter((s) => s.is_active).map((s) => s.code))

    if (patch.meta?.input_from && !codes.has(patch.meta.input_from)) {
      throw BadRequest('Công đoạn cấp đầu vào không có trong danh mục')
    }
    if (patch.meta?.input_from === code) {
      throw BadRequest('Công đoạn không thể tự cấp đầu vào cho chính nó')
    }
    if (patch.team_ids) {
      const teams = new Set((await stageConfigRepo.listTeams()).map((t) => t.id))
      const la = patch.team_ids.filter((id) => !teams.has(id))
      if (la.length) throw BadRequest('Có tổ không thuộc khu Sản xuất')
    }
    if (patch.is_active === false) {
      const docs = await stageConfigRepo.docCountByStage()
      if ((docs[code] ?? 0) > 0) {
        throw BadRequest(
          `Công đoạn đã có ${docs[code]} phiếu sản lượng — không ngừng dùng được, chỉ bỏ khỏi lộ trình`,
        )
      }
    }

    await stageConfigRepo.updateStage(code, {
      label: patch.label,
      meta: patch.meta,
      is_active: patch.is_active,
    })
    if (patch.team_ids) await stageConfigRepo.setTeams(code, patch.team_ids)
    if (patch.fields) await stageConfigRepo.replaceFields(code, patch.fields)
    if (patch.defect_codes)
      await stageConfigRepo.replaceDefectCodes(code, patch.defect_codes)

    return this.get(user)
  },

  /** Thêm công đoạn mới vào cuối danh mục, meta mặc định đếm chi tiết. */
  async create(user: User, input: StageCreateInput): Promise<StageConfigPayload> {
    await assertAction(user, 'production.stage.configure')
    const stages = await stageConfigRepo.listStagesAll()
    const sort = Math.max(0, ...stages.map((s) => s.sort_order)) + 1
    const created = await stageConfigRepo.createStage({
      code: input.code,
      label: input.label,
      sort_order: sort,
      meta: input.meta ?? defaultStageMeta(input.code),
    })
    if (!created) throw Conflict(`Mã công đoạn "${input.code}" đã có`, 'CODE_TAKEN')
    return this.get(user)
  },
}
