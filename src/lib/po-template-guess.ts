import { isPoTemplate, type PoTemplate } from './po-template'

/**
 * ĐOÁN MẪU ĐƠN TỪ TÊN VẬT TƯ.
 *
 * BẢN GỐC DUY NHẤT — `scripts/materials-drive-lib.mjs` import lại file này
 * (Node chạy .ts nhờ type-stripping). Hai bản lệch nhau nghĩa là vật tư nạp
 * hàng loạt mang mẫu khác vật tư khai tay, mà mẫu quyết định BỘ CỘT và CÁCH
 * TÍNH TIỀN của dòng đơn.
 *
 * Vì sao đoán theo TÊN chứ không theo NHÓM: đợt nạp sổ Cung ứng 02/08 gán theo
 * nhóm và sai nặng — cụm "Nhôm - thanh & tấm" có 548 dòng nhưng chỉ 180 là nhôm
 * cây/tấm thật. `Cromate nhôm` là hoá chất, `Dây hàn mig nhôm` là vật tư hàn,
 * `Cân treo nhôm 150kg` là cái cân. Gán cả cụm thành `aluminium` là 2/3 mang bộ
 * cột kg/m × dài cây mà chẳng liên quan gì.
 *
 * Đây là GỢI Ý, không phải phán quyết: form hiện đề xuất kèm lý do và cho đổi.
 */
export type TemplateGuess = {
  template: PoTemplate
  /** Vì sao đoán vậy — hiện thẳng cho người dùng, đừng bắt họ tin mù. */
  reason: string
}

/**
 * @param name       tên vật tư đang gõ
 * @param subGroup   nhóm phụ (chỗ dựa cuối khi tên không nói lên gì)
 * @param derivedKg  kg/m máy đọc được từ tên — xem `metal-weight.ts`
 */
export function guessTemplate(
  name: string,
  subGroup?: string | null,
  derivedKg?: number | null,
): TemplateGuess {
  const n = String(name ?? '').toLowerCase()
  const s = String(subGroup ?? '').toLowerCase()

  if (/cromate|thụ động|hoá chất|hóa chất|dung môi|sơn |dầu |nhớt|mỡ |keo /.test(n))
    return { template: 'simple', reason: 'hoá chất / sơn / dầu mỡ — tính theo SL × giá' }
  if (/dây hàn|que hàn|đá cắt|đá mài|béc |chụp khí/.test(n))
    return { template: 'simple', reason: 'vật tư hàn — bán theo cuộn/kg, SL × giá' }

  /*
   * NGŨ KIM XÉT TRƯỚC VẬT LIỆU. "Bu lông LGC 6x20x15 sắt xi 7 màu" có chữ "sắt"
   * và có tiết diện, nhưng "sắt xi" là lớp mạ chứ không phải mặt hàng sắt cây.
   * Xét vật liệu trước thì bu lông mang mẫu metal_kg, tức bị đòi khai kg/đơn-vị
   * mới gửi được đơn, trong khi NCC chào theo con.
   */
  if (
    /vít|bu ?lon|bu ?lông|tán |đinh |lđn|lđs|long đền|lông đền|pát|pat |ty ren|ty sắt|\beru\b|chốt |ốc /.test(
      n,
    )
  )
    return {
      template: 'accessory',
      reason: 'ngũ kim / liên kết — đặt theo con, có đm/sp',
    }
  if (/^thùng\b|carton/.test(n))
    return { template: 'carton', reason: 'thùng carton — tính theo thùng hoặc m²' }
  if (/\btem\b|nhãn|thẻ treo|logo|mạc |góc nhựa|góc giấy/.test(n))
    return { template: 'accessory', reason: 'tem / nhãn — tiêu hao theo sản phẩm' }
  if (/nút nhựa|bánh xe|gót chân|bịt chân|nắp bịt|tay nắm|bản lề|khoá |khóa /.test(n))
    return { template: 'accessory', reason: 'phụ kiện nội thất — đặt theo cái' }

  const tietDien = /\d+\s*[x×]\s*\d+|phi\s*\d+|\bd\d+\b/.test(n)
  if (/^\s*nh[ôo]m\b/.test(n) && tietDien) {
    /*
     * Mẫu nhôm CHỈ chọn được khi đã có kg/m: thiếu thì `lineReady` chặn không
     * cho gửi dòng, người soạn đơn kẹt rồi gõ đại một số cho qua.
     */
    return derivedKg
      ? { template: 'aluminium', reason: `nhôm định hình, đọc được ${derivedKg} kg/m` }
      : {
          template: 'simple',
          reason: 'nhôm nhưng chưa có kg/m — để SL × giá cho khỏi kẹt',
        }
  }
  if (/\b(thép|sắt|inox|tôn|kẽm)\b/.test(n) && tietDien)
    return { template: 'metal_kg', reason: 'sắt / inox theo quy cách — tính theo kg' }

  if (/bulon|vít|đinh|lông đền|kẹp|chốt/.test(s))
    return { template: 'accessory', reason: `theo nhóm phụ "${subGroup}"` }
  if (/tem|nhãn|thẻ|logo|mạc/.test(s))
    return { template: 'accessory', reason: `theo nhóm phụ "${subGroup}"` }
  if (/nút nhựa|bánh xe|gót chân|lót ghế|nắp|tay nắm/.test(s))
    return { template: 'accessory', reason: `theo nhóm phụ "${subGroup}"` }

  return { template: 'simple', reason: 'không suy được từ tên — SL × giá' }
}

/** Giữ mẫu người dùng đã chọn nếu hợp lệ, không thì lấy mẫu đoán. */
export function resolveTemplate(
  chosen: string | null | undefined,
  guess: TemplateGuess,
): PoTemplate {
  return isPoTemplate(chosen) ? chosen : guess.template
}
