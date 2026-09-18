/**
 * CHẶNG THÀNH PHẨM — bốn công đoạn sau sơn, đếm theo BỘ SẢN PHẨM.
 *
 * Chốt 18/09/2026 (chủ dự án): xưởng TÁCH ĐẾM RIÊNG cả bốn bước — lắp ráp,
 * bao bì & tem nhãn, đóng gói, hoàn thiện. Đóng gói xong thì hàng xếp chờ
 * container, KHÔNG nhập kho thành phẩm — nên chặng này kết thúc bằng một con
 * số trên lệnh ("đã hoàn thiện N bộ"), không đẻ thêm chứng từ kho nào.
 *
 * VÌ SAO PHẢI CÓ FILE NÀY. Lộ trình theo nhóm vật tư (`lib/stage-route`) dừng
 * ở `son`: FRAME đi phôi→hàn→nguội→mài→sơn, WOOD đi mộc→sơn, FABRIC đi may.
 * Bốn công đoạn cuối của danh mục vì thế KHÔNG có dòng việc nào — đo 18/09:
 * 875 chi tiết đã định hình, 0 dòng thuộc nhóm PACKAGING/CUSHION/LABEL. Hệ quả
 * là câu hỏi quan trọng nhất của một lệnh — "xong bao nhiêu BỘ để giao?" —
 * không trả lời được, vì sơn xong không phải là giao được.
 *
 * ĐẾM THEO BỘ, KHÔNG THEO CHI TIẾT. Không ai báo "hôm nay lắp 35 chân ghế";
 * họ báo "lắp xong 35 bộ". Nên chặng này gắn vào DÒNG SP chứ không vào chi
 * tiết, và tổng cần = SL đặt của dòng.
 *
 * CARTON VÀ MÀNG PE KHÔNG THUỘC ĐÂY. Hồ sơ SP có 426 dòng nhóm PACKAGING
 * (Carton, Màng PE, Lót góc V, Tem bảo hành…) nhưng chúng là VẬT TƯ TIÊU HAO ở
 * bước đóng gói, không phải thứ tổ nào gia công. Chúng đi đường tiêu hao vật
 * tư; đưa vào sổ sản lượng là bắt thống kê ghi "hôm nay làm được 200 cái
 * carton".
 *
 * SẢN LƯỢNG GHI THẲNG, KHÔNG SUY. Khác hẳn cụm mặc nhiên
 * ([[lib/default-assembly]]) vốn suy sản lượng = min theo chi tiết chậm nhất:
 * ở đây không có chi tiết nào để suy, thống kê gõ thẳng số bộ. Trước lượt ghi
 * đầu tiên dòng này là ẢO (id có tiền tố riêng); ghi phát đầu thì service vật
 * chất hoá nó thành một dòng `production_components` thật, y hệt đường cụm mặc
 * nhiên đã đi.
 */

/**
 * Bốn công đoạn sau sơn, ĐÚNG THỨ TỰ chạy. Mã khớp catalog `production_stage`
 * (sort_order 9→12).
 */
export const FINISH_STAGES: readonly string[] = [
  'lap_rap',
  'bao_bi',
  'dong_goi',
  'hoan_thien',
]

/** Tên dòng thành phẩm hiện trên sổ. */
export const FINISH_ROW_NAME = 'Bộ thành phẩm'

/** id ảo — KHÔNG trỏ vào bảng nào; service ghi sổ vật chất hoá khi cần. */
const FINISH_ROW_ID_PREFIX = 'finish:'

export function finishRowId(orderLineId: string): string {
  return `${FINISH_ROW_ID_PREFIX}${orderLineId}`
}

export function isFinishRowId(id: string): boolean {
  return id.startsWith(FINISH_ROW_ID_PREFIX)
}

/** id dòng SP nằm trong id ảo; null nếu không phải id dòng thành phẩm. */
export function finishRowLineId(id: string): string | null {
  return isFinishRowId(id) ? id.slice(FINISH_ROW_ID_PREFIX.length) : null
}

export function isFinishStage(stage: string | null | undefined): boolean {
  return !!stage && FINISH_STAGES.includes(stage)
}

/** Dòng component đủ để nhận diện một dòng thành phẩm đã vật chất hoá. */
export type FinishRowLike = {
  kind: 'part' | 'assembly'
  first_stage?: string | null
}

/**
 * Dòng thành phẩm ĐÃ vật chất hoá của một dòng SP.
 *
 * Nhận diện bằng `first_stage` chứ không bằng tên: tên sửa được ở màn định
 * hình, mốc công đoạn thì không — dòng nào bắt đầu ở lắp ráp là dòng thành
 * phẩm. Phân biệt được với cụm mặc nhiên (cũng `kind='assembly'`,
 * `cluster=null`, nhưng bắt đầu ở hàn) là điều BẮT BUỘC: hai dòng đó nằm cùng
 * một dòng SP và tra nhầm nhau thì sổ hàn ghi vào thành phẩm.
 */
export function isFinishRow(c: FinishRowLike): boolean {
  return c.kind === 'assembly' && isFinishStage(c.first_stage)
}

/**
 * Lộ trình ÉP của dòng thành phẩm, hoặc null nếu không phải dòng thành phẩm.
 *
 * Cần vì dòng thành phẩm không có `group_code` (nó không làm từ vật tư nào
 * cả), mà lộ trình mặc định suy theo nhóm — để nguyên thì nó trả rỗng và dòng
 * biến mất khỏi mọi tab công đoạn.
 */
export function finishRouteOverride(c: FinishRowLike): string[] | null {
  return isFinishRow(c) ? [...FINISH_STAGES] : null
}
