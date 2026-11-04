/**
 * Phiếu giao tổ (PGT) — vị từ "chờ TÔI nhận", dùng chung cho tab "Chờ tôi nhận"
 * của màn Giao nhận và badge sidebar (04/11/2026). Một hàm hai nơi: badge nói 3
 * mà mở màn thấy 2 là hỏng niềm tin vào cả sidebar.
 */
export type PgtTabDoc = {
  status: string
  reverses_doc_id: string | null
  to_team_id: string | null
}

/** Phiếu đã giao, chưa nhận, không phải phiếu đảo, gửi tới tổ của người xem. */
export function choNhan(d: PgtTabDoc, teamId: string | null): boolean {
  return (
    teamId != null &&
    d.status === 'da_giao' &&
    !d.reverses_doc_id &&
    d.to_team_id === teamId
  )
}
