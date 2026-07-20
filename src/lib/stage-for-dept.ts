/**
 * Công đoạn mặc định theo TÊN TỔ của người nhập: "Tổ Hàn" → stage Hàn — thống
 * kê mở màn nhập là đứng sẵn ở công đoạn của tổ mình. So label dài trước để
 * "Sơn tĩnh điện" (nếu có) không bị "Sơn" cướp match.
 */
export function stageForDept(
  deptName: string | null,
  stages: { code: string; label: string }[],
): string | null {
  if (!deptName) return null
  const name = deptName.toLowerCase()
  const byLen = [...stages].sort((a, b) => b.label.length - a.label.length)
  return byLen.find((s) => name.includes(s.label.toLowerCase()))?.code ?? null
}

/**
 * Công đoạn CHÍNH THỨC của tổ (0064, đóng OI-14): ưu tiên departments.stage_code
 * do admin gán; tổ chưa gán (giai đoạn chuyển tiếp) fallback đoán theo tên như
 * cũ. stage_code lạ (đã xoá khỏi danh mục) coi như chưa gán.
 */
export function resolveTeamStage(
  dept: { stage_code: string | null; name: string } | null,
  stages: { code: string; label: string }[],
): string | null {
  if (!dept) return null
  if (dept.stage_code && stages.some((s) => s.code === dept.stage_code)) {
    return dept.stage_code
  }
  return stageForDept(dept.name, stages)
}
