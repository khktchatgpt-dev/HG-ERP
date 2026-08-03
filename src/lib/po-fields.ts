import type { PoTemplate } from './po-template'

/**
 * KHAI BÁO Ô NHẬP CỦA DÒNG ĐƠN THEO MẪU — một nguồn cho cả form nhập lẫn phiếu in.
 *
 * Trước đây bộ cột nằm rải ba chỗ: `COLS` trong `PoLineTable` (nhãn + bề rộng),
 * một chuỗi nhánh `c.key === '…'` trong JSX của chính nó (kiểu ô), và
 * `columnsFor()` bên trang in. Thêm mẫu đơn thứ sáu phải sửa đủ ba nơi cộng với
 * `po-template.ts` — quên chỗ nào thì phiếu in thiếu cột mà không ai thấy.
 *
 * Ở đây khai một lần: mẫu nào có cột nào, cột đó là kiểu ô gì, ghi vào trường nào
 * của dòng. Bảng nhập map khai báo → 8 kiểu ô; phiếu in đọc cùng danh sách.
 */

/** Kiểu ô — đúng 8 kiểu phủ hết 5 mẫu đơn. */
export type PoFieldKind =
  | 'text' // chuỗi tự do: vật liệu, quy cách, kích thước, màu/bề mặt
  | 'number' // số gõ tay: SL đơn hàng, tồn, hao %, kg/m, dài cây…
  | 'calc' // hệ thống tự tính, nền xám, không gõ được: tổng kg
  | 'die' // ô chọn mã khuôn (tra kg/m theo khuôn)
  | 'openStyle' // cách mở thùng AD/MR — đổi thì tính lại m²
  | 'inner' // ba ô D×R×C lọt lòng — đổi thì tính lại m²
  | 'area' // m²/thùng: tự tính từ lọt lòng nhưng SỬA được khi NCC chào khác
  | 'cartonBasis' // tính tiền theo thùng hay theo m² (chốt từng dòng)

export type PoField = {
  key: string
  label: string
  /** Class bề rộng cột trong bảng nhập. */
  width: string
  kind: PoFieldKind
  /** Trường của `Line` mà ô ghi vào — 'inner' ghi ba trường nên để trống. */
  field?: string
  align?: 'right'
  placeholder?: string
  /** Bước nhảy cho ô số. */
  step?: string
  max?: string
  /** Nhãn trên PHIẾU IN khi khác nhãn trong form (giấy in hẹp hơn). */
  printLabel?: string
}

const t = (
  key: string,
  label: string,
  width: string,
  field: string,
  placeholder?: string,
): PoField => ({ key, label, width, kind: 'text', field, placeholder })

const n = (
  key: string,
  label: string,
  width: string,
  field: string,
  step = '0.01',
  max?: string,
): PoField => ({ key, label, width, kind: 'number', field, align: 'right', step, max })

/**
 * Bộ cột riêng của từng mẫu — nằm GIỮA hai đầu cố định của hàng
 * (`# · Mã SP · Vật tư · … · SL đặt · Đơn giá · Thành tiền · Ghi chú`).
 * Mã SP và Ghi chú không khai ở đây vì mẫu nào cũng có và luôn đứng cố định.
 *
 * Nguồn: 8 file đơn thật của phòng Cung ứng — xem `po-template.ts` cho bảng đối
 * chiếu mẫu ↔ nhà cung cấp.
 *
 * "SL ĐƠN HÀNG" nuôi gợi ý "SL đặt = nhu cầu − tồn" — có ở phụ kiện, nhôm, bao bì
 * (inox/sắt và đơn giản không có: đơn thật của ba NCC inox chỉ ghi "Số lượng
 * (cây)", hàng đó đặt theo bảng cân từng lệnh chứ không trừ tồn).
 *
 * KHÔNG có cột "Tồn kho" riêng ở mẫu nhôm: tồn đã hiện sẵn ngay dưới tên vật tư
 * ở cột ghim trái ("mã · ĐVT · tồn N"), bày thêm một cột nữa là nói hai lần cùng
 * một số. Số tồn vẫn được điền ngầm vào dòng lúc chọn vật tư nên gợi ý vẫn trừ
 * tồn đúng — chỉ là không còn ô để gõ đè.
 */
export const PO_FIELDS: Record<PoTemplate, PoField[]> = {
  accessory: [
    t('grade', 'Vật liệu', 'w-[110px]', 'material_grade', 'Sắt xi trắng…'),
    t('spec', 'Quy cách', 'w-[110px]', 'spec', '25×50×1li…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'),
  ],
  aluminium: [
    { key: 'die', label: 'Mã khuôn', width: 'w-[120px]', kind: 'die', field: 'die_code' },
    n('kgm', 'kg/m', 'w-[80px]', 'weight_per_m', '0.0001'),
    n('barlen', 'Dài cây (m)', 'w-[92px]', 'bar_length_m'),
    n('demand', 'SL đơn hàng', 'w-[84px]', 'qty_demand'),
    { key: 'kgtotal', label: 'Tổng kg', width: 'w-[92px]', kind: 'calc', align: 'right' },
  ],
  metal_kg: [
    t('grade', 'Vật liệu', 'w-[100px]', 'material_grade', 'Sắt xi trắng…'),
    t('dim', 'Kích thước', 'w-[130px]', 'dimension_text', 'Inox phi 15.9x1.5li'),
    t('finish', 'Màu / bề mặt', 'w-[100px]', 'finish', 'inox bóng'),
    n('kgunit', 'kg / đơn vị', 'w-[92px]', 'weight_per_unit', '0.0001'),
    { key: 'kgtotal', label: 'Tổng kg', width: 'w-[92px]', kind: 'calc', align: 'right' },
  ],
  carton: [
    {
      key: 'open',
      label: 'Cách mở',
      width: 'w-[74px]',
      kind: 'openStyle',
      field: 'open_style',
    },
    n('pcs', 'Pcs/thùng', 'w-[78px]', 'pcs_per_ctn', '1'),
    n('demand', 'SL đơn hàng', 'w-[84px]', 'qty_demand'),
    n('onhand', 'Tồn kho', 'w-[74px]', 'qty_on_hand'),
    { key: 'inner', label: 'Lọt lòng D×R×C (mm)', width: 'w-[168px]', kind: 'inner' },
    {
      key: 'area',
      label: 'm² / thùng',
      printLabel: 'm²/thùng', // giấy in hẹp, bỏ khoảng trắng cho gọn cột
      width: 'w-[88px]',
      kind: 'area',
      field: 'area_m2',
      align: 'right',
      step: '0.0001',
    },
    {
      key: 'basis',
      label: 'Tính theo',
      width: 'w-[92px]',
      kind: 'cartonBasis',
      field: 'carton_basis',
    },
  ],
  simple: [t('spec', 'Quy cách', 'w-[140px]', 'spec', '25×50×1li…')],
}

/**
 * THỨ TỰ CỘT TRÊN PHIẾU IN gửi NCC — KHÔNG giống form nhập.
 *
 * Trên giấy, cột số lượng chen vào GIỮA phần thông số chứ không dồn về cuối:
 * đơn nhôm là `… dài cây · SỐ CÂY · cây dư · tổng kg`, đơn bao bì là
 * `… pcs/thùng · SỐ THÙNG · lọt lòng`. Đây là mẫu NCC đang ký nên giữ nguyên
 * từng vị trí; đảo cột là họ phải dò lại.
 *
 * Token `@…` là cột cố định do trang in tự dựng (STT, tên hàng, đơn giá, thành
 * tiền…), còn lại là `key` trong `PO_FIELDS` của mẫu đó.
 * Hao hụt đã BỎ HẲN: không phải cột nhập, không in cho NCC, và cũng không còn
 * cộng vào SL gợi ý (xem `suggestOrderQty`).
 */
export const PO_PRINT_ORDER: Record<PoTemplate, string[]> = {
  accessory: [
    '@stt',
    '@name',
    'grade',
    'spec',
    'demand',
    'onhand',
    '@qty',
    '@unit',
    '@price',
    '@amount',
    '@note',
  ],
  aluminium: [
    '@stt',
    '@name',
    'die',
    'kgm',
    'barlen',
    // ĐVT có ở MỌI sheet nhôm của form đặt hàng mới (Tiến Đạt, Việt ECO, Việt Ý,
    // Cát Tường, Taiwan, Sơn Thịnh) — nằm ngay trước cột số lượng. Thiếu nó thì
    // phiếu nhôm là mẫu duy nhất không nói đặt theo cây hay theo tấm.
    '@unit',
    '@qty',
    'kgtotal',
    '@price',
    '@amount',
    '@note',
  ],
  metal_kg: [
    '@stt',
    '@name',
    'grade',
    'dim',
    'finish',
    '@unit',
    '@qty',
    'kgunit',
    'kgtotal',
    '@price',
    '@amount',
    '@note',
  ],
  carton: [
    '@stt',
    '@name',
    'open',
    'pcs',
    '@qty',
    'inner',
    'area',
    '@price',
    '@amount',
    '@note',
  ],
  simple: ['@stt', '@name', 'spec', '@unit', '@qty', '@price', '@amount', '@note'],
}

/** Nhãn cột số lượng trên phiếu in — mỗi mẫu gọi một kiểu theo đơn vị mua. */
export const PO_PRINT_QTY_LABEL: Record<PoTemplate, string> = {
  accessory: 'SL đặt',
  aluminium: 'Số cây',
  metal_kg: 'Số lượng',
  carton: 'Số thùng',
  simple: 'Số lượng',
}

/** Tra khai báo một cột theo key, trong phạm vi mẫu đơn. */
export function poField(template: PoTemplate, key: string): PoField | undefined {
  return PO_FIELDS[template].find((f) => f.key === key)
}
