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
  /**
   * Có mặt trên PHIẾU IN nhưng KHÔNG bày ô nhập trong form.
   *
   * Dùng cho "Tồn kho": số tồn đã hiện sẵn dưới tên vật tư ở cột ghim trái
   * ("mã · ĐVT · tồn N"), thêm một ô nữa là nói hai lần cùng một số (phản hồi
   * 08/08/2026). Giá trị vẫn được điền ngầm lúc chọn vật tư (`newLine` chụp
   * `on_hand`) nên gợi ý "SL đặt = nhu cầu − tồn" và cột in không đổi.
   */
  editHidden?: boolean
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
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
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
    { ...n('onhand', 'Tồn kho', 'w-[74px]', 'qty_on_hand'), editHidden: true },
    // MỘT ô "900×605×115" chứ không phải ba ô số (08/08/2026) — xem InnerDimsCell.
    {
      key: 'inner',
      label: 'Lọt lòng D×R×C (mm)',
      width: 'w-[128px]',
      kind: 'inner',
      placeholder: '900×605×115',
    },
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
  /*
   * 3 mẫu 08/08/2026 (đơn thật trên Drive Cung ứng) — tiền đều SL × đơn giá,
   * khác nhau ở cột phụ:
   *   rattan: đơn Vipora có cột "Định mức" (barem g/5m — vd "5m/g = 32-34g");
   *           ghi vào material_grade (đang trống ở nhóm này, nhãn theo mẫu).
   *   paint : đơn sơn không có cột phụ nào ngoài Ghi chú.
   *   foam  : quy cách cuộn/tấm ("8mm x 1.05m x 50m") nằm ngay trong tên/spec.
   */
  rattan: [
    t('spec', 'Quy cách', 'w-[120px]', 'spec', 'Mây dẹp 8mm…'),
    t('dinhmuc', 'Định mức', 'w-[110px]', 'material_grade', '5m/g = 32-34g'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
  ],
  paint: [
    // Đơn sơn thật (Dosa/Việt Sapa/Đắc Vinh/TNP) nhận diện hàng bằng MÃ MÀU
    // của NCC (T67443C (C679-ASA)…) — khác mã vật tư danh mục in ở cột @code.
    t('grade', 'Mã màu NCC', 'w-[130px]', 'material_grade', 'T67443C (C679-ASA)…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
  ],
  chemical: [
    t('spec', 'Quy cách', 'w-[120px]', 'spec', '25kg/can…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
  ],
  foam: [
    t('spec', 'Quy cách', 'w-[140px]', 'spec', '8mm x 1.05m x 50m…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
  ],
  /*
   * MRO (10/08/2026). KHÔNG có "SL đơn hàng · Tồn kho": hàng bảo trì mua lẻ
   * theo nhu cầu hỏng hóc, không có định mức/sp để trừ tồn ra số cần đặt.
   *
   * Bốn cột riêng dùng lại cột DB sẵn có thay vì thêm cột mới — cùng cách mẫu
   * sơn mượn `material_grade` làm "Mã màu NCC" và mẫu mây mượn nó làm "Định
   * mức". Nhãn khác nhau theo mẫu, còn chỗ chứa thì dùng chung.
   */
  mro: [
    t('model', 'Model / Mã hãng', 'w-[130px]', 'material_grade', 'SKF 6204-2RS…'),
    t('spec', 'Quy cách', 'w-[110px]', 'spec', 'Φ20×47×14…'),
    t('dungcho', 'Dùng cho máy / vị trí', 'w-[130px]', 'dimension_text', 'Máy dập 8T…'),
    t('baohanh', 'Bảo hành', 'w-[90px]', 'finish', '12 tháng'),
  ],
  simple: [t('spec', 'Quy cách', 'w-[140px]', 'spec', '25×50×1li…')],
}

/**
 * THỨ TỰ CỘT TRÊN PHIẾU IN gửi NCC — KHÔNG giống form nhập.
 *
 * Trên giấy, cột số lượng chen vào GIỮA phần thông số chứ không dồn về cuối:
 * đơn nhôm là `… dài cây · SỐ CÂY · cây dư · tổng kg`, đơn bao bì là
 * `… pcs/thùng · SỐ THÙNG · lọt lòng`. Cột kỹ thuật là mẫu NCC đang ký nên giữ
 * nguyên từng vị trí; đảo cột là họ phải dò lại.
 *
 * KHUNG CHUẨN 08/2026 (đối chiếu đơn ĐH chuẩn của phòng Cung ứng, đơn sơn
 * 01/26 HG/MĐ): mọi mẫu mở đầu bằng `STT · LSX · Mã sản phẩm · Tên SP/vật tư`.
 * "Mã sản phẩm" ở đây là MÃ VẬT TƯ trong danh mục (trước in nhỏ dưới tên) —
 * khác cột "Mã SP" tự gõ đã bỏ năm 0106 vì không ai điền. Cột LSX lặp số lệnh
 * của đầu đơn xuống từng dòng; đơn NGOÀI LSX thì trang in tự ẩn cột này.
 * Riêng mẫu ít cột (đơn giản — sơn/hoá chất dùng) thêm `Ngày đặt hàng · Thời
 * gian giao hàng` đúng ảnh chuẩn; các mẫu kỹ thuật nhiều cột không nhét thêm
 * được trong khổ giấy — hai ngày đó vẫn nằm ở đầu phiếu.
 *
 * ĐVT: mọi mẫu đều có, và luôn đứng NGAY TRƯỚC cột số lượng (10/08/2026 — trước
 * đó bao bì thiếu hẳn cột này còn phụ kiện in nó sau cột SL). `po-fields.test.ts`
 * khoá quy tắc lại; đơn vị của hàng là thứ NCC đọc cùng lúc với con số.
 *
 * Token `@…` là cột cố định do trang in tự dựng (STT, tên hàng, đơn giá, thành
 * tiền…), còn lại là `key` trong `PO_FIELDS` của mẫu đó.
 * Hao hụt đã BỎ HẲN: không phải cột nhập, không in cho NCC, và cũng không còn
 * cộng vào SL gợi ý (xem `suggestOrderQty`).
 */
export const PO_PRINT_ORDER: Record<PoTemplate, string[]> = {
  accessory: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'grade',
    'spec',
    'demand',
    'onhand',
    // ĐVT đứng TRƯỚC cột số lượng như tám mẫu còn lại (10/08/2026). Trước đây
    // riêng mẫu này in sau, nên NCC nhận hai kiểu bố cục từ cùng một công ty.
    '@unit',
    '@qty',
    '@price',
    '@amount',
    '@note',
  ],
  aluminium: [
    '@stt',
    '@lsx',
    // KHÔNG có "Mã sản phẩm" (bỏ 08/08/2026): phiếu nhôm nhận diện hàng bằng
    // MÃ KHUÔN — in thêm mã danh mục là hai cột mã cạnh nhau, NCC rối.
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
    '@lsx',
    '@code',
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
    '@lsx',
    '@code',
    '@name',
    'open',
    'pcs',
    // Bao bì TỪNG là mẫu duy nhất không in ĐVT, với lý do "bao bì luôn là thùng".
    // Không đúng với danh mục: nhóm bao bì có 24 đơn vị khác nhau (Tấm, Kg, Cuộn,
    // M², Tờ…) và chỉ 259/942 mã là Thùng — phần lớn đơn in ra không nói đang
    // đặt theo gì (10/08/2026).
    '@unit',
    '@qty',
    'inner',
    'area',
    '@price',
    '@amount',
    '@note',
  ],
  // Mây theo form Vipora: … Mã số · ĐVT · SL · giá · tiền · ĐỊNH MỨC · ghi chú.
  rattan: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'spec',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    'dinhmuc',
    '@note',
  ],
  // Sơn theo form Dosa/Việt Sapa: mã màu NCC đứng cạnh tên; ngày đặt/giao cuối.
  paint: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'grade',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    '@orderdate',
    '@delivery',
    '@note',
  ],
  // Hoá chất theo form Kiệm Tâm: tên vật tư + quy cách can/bao, không màu mè.
  chemical: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'spec',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    '@note',
  ],
  foam: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'spec',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    '@note',
  ],
  // MRO: model đứng cạnh tên (NCC dò theo mã hãng), "dùng cho máy" giữ trên
  // giấy để sau này đối chiếu chi phí bảo trì theo thiết bị; bảo hành là điều
  // khoản nên đứng sau tiền, giống cách mẫu mây đặt "Định mức".
  mro: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'model',
    'spec',
    'dungcho',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    'baohanh',
    '@note',
  ],
  simple: [
    '@stt',
    '@lsx',
    '@code',
    '@name',
    'spec',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    '@orderdate',
    '@delivery',
    '@note',
  ],
}

/** Nhãn cột số lượng trên phiếu in — mỗi mẫu gọi một kiểu theo đơn vị mua. */
export const PO_PRINT_QTY_LABEL: Record<PoTemplate, string> = {
  accessory: 'SL đặt',
  aluminium: 'Số cây',
  metal_kg: 'Số lượng',
  carton: 'Số thùng',
  rattan: 'Số lượng',
  paint: 'Số lượng',
  chemical: 'Số lượng',
  foam: 'Số lượng',
  mro: 'Số lượng',
  simple: 'Số lượng',
}

/** Tra khai báo một cột theo key, trong phạm vi mẫu đơn. */
export function poField(template: PoTemplate, key: string): PoField | undefined {
  return PO_FIELDS[template].find((f) => f.key === key)
}
