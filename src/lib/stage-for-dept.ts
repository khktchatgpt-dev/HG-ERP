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
