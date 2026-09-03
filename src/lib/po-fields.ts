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

/** Kiểu ô — phủ hết các mẫu đơn. */
export type PoFieldKind =
  | 'text' // chuỗi tự do: vật liệu, quy cách, kích thước, màu/bề mặt
  | 'number' // số gõ tay: SL đơn hàng, tồn, hao %, kg/m, dài cây…
  | 'calc' // hệ thống tự tính, nền xám, không gõ được: tổng kg
  | 'die' // ô chọn mã khuôn (tra kg/m theo khuôn)
  | 'openStyle' // cách mở thùng AD/MR/ĐK — đổi thì tính lại m²
  | 'inner' // ba ô D×R×C trong một ô — carton: lọt lòng; foam: quy cách D×R×Dày
  | 'area' // m²/thùng·m²/tấm: tự tính (carton) hoặc gõ tay (kính)
  | 'cartonBasis' // cơ sở tính tiền từng dòng — nhãn lấy từ `options` của mẫu
  | 'unit2' // 0182: MỘT ô "17.5 Lít" ghi cặp unit2_per_unit + unit2_label — quy đổi giá tổng quát

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
  /** Riêng kind 'cartonBasis': bộ lựa chọn của mẫu (thùng/m², tấm/m³, SP/kg…). */
  options?: { value: 'ctn' | 'm2' | 'm3' | 'kg'; label: string }[]
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
/**
 * Ô "GIÁ THEO ĐV KHÁC" (0182) — cho mẫu KHÔNG có công thức riêng: sơn NCC chào
 * theo lít nhưng mua theo thùng, hoá chất kg/can, phụ kiện m/cuộn… Gõ "17.5
 * Lít" nghĩa là 1 ĐVT đặt = 17,5 lít và ĐƠN GIÁ nhập theo LÍT; bỏ trống thì
 * dòng tính SL × giá như cũ. Danh mục khai price_unit/unit2_factor thì tự điền.
 */
const UNIT2_FIELD: PoField = {
  key: 'unit2',
  label: 'Giá theo ĐV khác',
  printLabel: 'Quy đổi',
  width: 'w-[110px]',
  kind: 'unit2',
}

export const PO_FIELDS: Record<PoTemplate, PoField[]> = {
  accessory: [
    t('grade', 'Vật liệu', 'w-[110px]', 'material_grade', 'Sắt xi trắng…'),
    t('spec', 'Quy cách', 'w-[110px]', 'spec', '25×50×1li…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    // "Tồn kho" bỏ hẳn khỏi phiếu phụ kiện (user chốt 12/08/2026 khi duyệt cột
    // từng mẫu): tồn là số nội bộ, NCC chỉ cần SL đơn hàng để hiểu con số đặt.
    // `qty_on_hand` vẫn được chụp lúc chọn vật tư nên gợi ý "đặt = nhu cầu − tồn"
    // không đổi.
    UNIT2_FIELD,
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
    // Bao bì thật báo giá THEO m² kèm "Bản in + công" rồi mới ra đơn giá/thùng
    // (= m² × giá/m² + bản in — đơn Hồng Đào Chu Lai, 0134). Hai ô dưới nuôi
    // gợi ý đơn giá/thùng trên form; tính tiền vẫn SL × đơn giá như cũ.
    n('giam2', 'Đơn giá/m²', 'w-[92px]', 'price_per_m2', '1'),
    n('banin', 'Bản in + công', 'w-[88px]', 'print_fee', '1'),
    {
      key: 'basis',
      label: 'Tính theo',
      width: 'w-[92px]',
      kind: 'cartonBasis',
      field: 'carton_basis',
      options: [
        { value: 'ctn', label: 'thùng' },
        { value: 'm2', label: 'm²' },
      ],
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
    UNIT2_FIELD,
  ],
  paint: [
    // Đơn sơn thật (Dosa/Việt Sapa/Đắc Vinh/TNP) nhận diện hàng bằng MÃ MÀU
    // của NCC (T67443C (C679-ASA)…) — khác mã vật tư trong danh mục kho.
    t('grade', 'Mã màu NCC', 'w-[130px]', 'material_grade', 'T67443C (C679-ASA)…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
    UNIT2_FIELD,
  ],
  chemical: [
    t('spec', 'Quy cách', 'w-[120px]', 'spec', '25kg/can…'),
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
    UNIT2_FIELD,
  ],
  foam: [
    t('spec', 'Quy cách', 'w-[140px]', 'spec', '8mm x 1.05m x 50m…'),
    // Xốp TẤM theo KHỐI (0134 — DDH Tân Hoàng Long): D×R×Dày → m³/tấm, đơn
    // giá/m³, chốt "Tính theo m³" từng dòng. Mút cuộn để basis "tấm/cuộn" như cũ.
    {
      key: 'dims',
      label: 'D×R×Dày (mm)',
      width: 'w-[128px]',
      kind: 'inner',
      placeholder: '1520×920×10',
    },
    { key: 'm3total', label: 'Tổng m³', width: 'w-[88px]', kind: 'calc', align: 'right' },
    {
      key: 'basis',
      label: 'Tính theo',
      width: 'w-[96px]',
      kind: 'cartonBasis',
      field: 'carton_basis',
      options: [
        { value: 'ctn', label: 'tấm/cuộn' },
        { value: 'm3', label: 'm³' },
      ],
    },
    n('demand', 'SL đơn hàng', 'w-[92px]', 'qty_demand'),
    { ...n('onhand', 'Tồn kho', 'w-[78px]', 'qty_on_hand'), editHidden: true },
  ],
  // Kính (0134 — DDH Mai Trang): loại kính + quy cách mm + m²/tấm; giá theo TẤM
  // hoặc theo m², chốt từng dòng như bao bì.
  glass: [
    t('loai', 'Loại kính', 'w-[130px]', 'material_grade', 'Kính trắng phun mờ, CL…'),
    t('quycach', 'Quy cách', 'w-[110px]', 'dimension_text', '605x539x5mm'),
    {
      key: 'm2tam',
      label: 'm² / tấm',
      printLabel: 'm²/tấm',
      width: 'w-[84px]',
      kind: 'area',
      field: 'area_m2',
      align: 'right',
      step: '0.0001',
    },
    { key: 'm2total', label: 'Tổng m²', width: 'w-[88px]', kind: 'calc', align: 'right' },
    {
      key: 'basis',
      label: 'Tính theo',
      width: 'w-[84px]',
      kind: 'cartonBasis',
      field: 'carton_basis',
      options: [
        { value: 'ctn', label: 'tấm' },
        { value: 'm2', label: 'm²' },
      ],
    },
  ],
  // Gỗ theo m³ (0134 — ĐH Minh Đạt/Thành Đạt/Đức Toàn): dòng là MÃ SẢN PHẨM
  // (dòng tự do), m³/SP × SL × đơn giá/m³ tinh; loại gỗ + màu + kế hoạch giao
  // THEO TỪNG DÒNG đúng cột đơn thật.
  wood: [
    // m³/SP có CỘT RIÊNG từ 0139 — trước mượn weight_per_unit của mẫu inox
    // (cùng ô, khác đơn vị: đổi mẫu là m³ bị đọc thành kg).
    n('m3sp', 'm³ / SP', 'w-[92px]', 'm3_per_unit', '0.00001'),
    { key: 'm3total', label: 'Tổng m³', width: 'w-[88px]', kind: 'calc', align: 'right' },
    t('loaigo', 'Loại gỗ', 'w-[120px]', 'material_grade', 'Acacia FSC 100%'),
    t('maugo', 'Màu gỗ', 'w-[90px]', 'finish', 'Màu 142'),
    // "KH giao hàng" theo dòng BỎ HẲN khỏi form (03/09/2026, user chốt): hẹn giao
    // đã có ở đầu đơn, cột này chỉ còn là chỗ chuỗi quy cách thùng carton chui
    // vào nhầm. Thay bằng QUY CÁCH — ô `spec` thật, tự đổ từ danh mục như mọi
    // mẫu khác, không phải cột mượn. 43 dòng gỗ cũ có ngày trong dimension_text
    // vẫn nằm nguyên trong DB, chỉ không còn ô trên form.
    t('spec', 'Quy cách', 'w-[130px]', 'spec', 'vd 1200×450×18 mm…'),
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
    // Bảo hành có CỘT RIÊNG từ 0139 — trước mượn finish (màu/bề mặt).
    t('baohanh', 'Bảo hành', 'w-[90px]', 'warranty_text', '12 tháng'),
    UNIT2_FIELD,
  ],
  simple: [t('spec', 'Quy cách', 'w-[140px]', 'spec', '25×50×1li…'), UNIT2_FIELD],
}

/**
 * THỨ TỰ CỘT TRÊN PHIẾU IN gửi NCC — KHÔNG giống form nhập.
 *
 * Trên giấy, cột số lượng chen vào GIỮA phần thông số chứ không dồn về cuối:
 * đơn nhôm là `… dài cây · SỐ CÂY · cây dư · tổng kg`, đơn bao bì là
 * `… pcs/thùng · SỐ THÙNG · lọt lòng`. Cột kỹ thuật là mẫu NCC đang ký nên giữ
 * nguyên từng vị trí; đảo cột là họ phải dò lại.
 *
 * KHUNG CHUẨN 08/2026, chỉnh 12/08/2026 theo form mẫu mới: mọi mẫu mở đầu bằng
 * `STT · Tên SP/vật tư`. LSX và Đơn hàng KHÔNG là cột trong bảng kê — chúng nằm
 * ở KHUNG GÓC PHẢI đầu phiếu (Số ĐH · Theo HD số · LSX · Đơn hàng, xem
 * `PrintMeta refsBoxed`). Cột "Mã sản phẩm" (mã vật tư danh mục) cũng bỏ khỏi
 * mọi mẫu — NCC nhận diện hàng bằng tên + cột riêng của mẫu (mã khuôn, mã màu,
 * quy cách…), mã nội bộ chỉ làm phiếu chật thêm.
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
    '@name',
    'grade',
    'spec',
    'demand',
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
    // Bao bì TỪNG là mẫu duy nhất không in ĐVT, với lý do "bao bì luôn là thùng".
    // Không đúng với danh mục: nhóm bao bì có 24 đơn vị khác nhau (Tấm, Kg, Cuộn,
    // M², Tờ…) và chỉ 259/942 mã là Thùng — phần lớn đơn in ra không nói đang
    // đặt theo gì (10/08/2026).
    '@unit',
    '@qty',
    'inner',
    'area',
    // Đơn bao bì thật in CẢ giá/m² + bản in trước đơn giá/thùng (0134 — Hồng
    // Đào Chu Lai) để NCC đối chiếu được công thức của chính họ.
    'giam2',
    'banin',
    '@price',
    '@amount',
    '@note',
  ],
  // Mây theo form Vipora: … Mã số · ĐVT · SL · giá · tiền · ĐỊNH MỨC · ghi chú.
  rattan: [
    '@stt',
    '@name',
    'spec',
    '@unit',
    '@qty',
    '@price',
    '@amount',
    'dinhmuc',
    '@note',
  ],
  // Sơn theo form Dosa/Việt Sapa: mã màu NCC đứng cạnh tên. Hai cột "Ngày đặt ·
  // Thời gian giao" BỎ 12/08/2026 (duyệt cột từng mẫu) — hai ngày đã nằm ở đầu
  // phiếu, lặp xuống từng dòng chỉ tốn bề ngang.
  paint: ['@stt', '@name', 'grade', '@unit', '@qty', '@price', '@amount', '@note'],
  // Hoá chất theo form Kiệm Tâm: tên vật tư + quy cách can/bao, không màu mè.
  chemical: ['@stt', '@name', 'spec', '@unit', '@qty', '@price', '@amount', '@note'],
  // Xốp: phiếu in CHỈ giữ Quy cách (user chốt 12/08/2026) — D×R×Dày và Tổng m³
  // vẫn là ô trên form để tính m³/gợi ý giá, nhưng không in cho NCC.
  foam: ['@stt', '@name', 'spec', '@unit', '@qty', '@price', '@amount', '@note'],
  // Kính theo form Mai Trang: Loại kính · Quy cách · ĐVT · SL · m²/tấm. "Tổng m²"
  // bỏ khỏi phiếu in 12/08/2026 (duyệt cột từng mẫu) — vẫn tự tính trên form.
  glass: [
    '@stt',
    '@name',
    'loai',
    'quycach',
    '@unit',
    '@qty',
    'm2tam',
    '@price',
    '@amount',
    '@note',
  ],
  // Gỗ theo form Minh Đạt: m³/SP (KL gỗ) · giá/m³ · thành tiền · loại gỗ · màu ·
  // kế hoạch giao từng dòng.
  // "KH giao hàng" theo dòng BỎ khỏi phiếu 12/08/2026 và khỏi cả form 03/09 —
  // hẹn giao dùng chung đầu phiếu. Cột Quy cách mới của form KHÔNG in: bộ cột
  // NCC đang ký giữ nguyên, muốn in thì thêm 'spec' vào đây + sửa test khoá.
  wood: [
    '@stt',
    '@name',
    '@unit',
    '@qty',
    'm3sp',
    'm3total',
    '@price',
    '@amount',
    'loaigo',
    'maugo',
    '@note',
  ],
  // MRO: model đứng cạnh tên (NCC dò theo mã hãng), "dùng cho máy" giữ trên
  // giấy để sau này đối chiếu chi phí bảo trì theo thiết bị; bảo hành là điều
  // khoản nên đứng sau tiền, giống cách mẫu mây đặt "Định mức".
  mro: [
    '@stt',
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
  // "Ngày đặt · Thời gian giao" bỏ 12/08/2026 cùng nhịp với mẫu sơn — hai ngày
  // nằm ở đầu phiếu, 12 mẫu không còn mẫu nào lặp ngày xuống dòng.
  simple: ['@stt', '@name', 'spec', '@unit', '@qty', '@price', '@amount', '@note'],
}

/** Nhãn cột số lượng trên phiếu in — mỗi mẫu gọi một kiểu theo đơn vị mua. */
export const PO_PRINT_QTY_LABEL: Record<PoTemplate, string> = {
  accessory: 'SL đặt',
  // "Số cây" → "Số lượng" (user chốt 12/08/2026 khi duyệt cột từng mẫu) — đồng
  // bộ nhãn với các mẫu khác; đơn vị cây đã nói ở cột ĐVT đứng ngay trước.
  aluminium: 'Số lượng',
  metal_kg: 'Số lượng',
  // "Số thùng" → "Số lượng" (12/08/2026) — bao bì có 24 ĐVT (Tấm/Cuộn/Kg…),
  // đơn vị thật nói ở cột ĐVT ngay trước.
  carton: 'Số lượng',
  rattan: 'Số lượng',
  paint: 'Số lượng',
  chemical: 'Số lượng',
  foam: 'Số lượng',
  glass: 'Số lượng',
  wood: 'Số lượng',
  mro: 'Số lượng',
  simple: 'Số lượng',
}

/**
 * Hậu tố ĐƠN GIÁ trên phiếu in/Excel cho các mẫu chốt CƠ SỞ TÍNH TIỀN từng dòng
 * — NCC phải thấy "70.681/thùng" hay "18.770/m²" mới đối chiếu được báo giá của
 * chính họ. Mẫu tính theo đơn vị cố định (nhôm, inox, gỗ) dùng nhãn cột
 * "Đơn giá (VND/kg)" sẵn có, không đi qua đây.
 */
export function poPriceSuffix(t: PoTemplate, basis: string | null | undefined): string {
  switch (t) {
    case 'carton':
      return basis === 'm2' ? '/m²' : '/thùng'
    case 'glass':
      return basis === 'm2' ? '/m²' : '/tấm'
    case 'foam':
      return basis === 'm3' ? '/m³' : ''
    default:
      return ''
  }
}

/** Mẫu có hậu tố đơn giá theo dòng — phiếu in/Excel rẽ nhánh qua `poPriceSuffix`. */
export const PO_PRICE_SUFFIX_TEMPLATES: readonly PoTemplate[] = [
  'carton',
  'glass',
  'foam',
]

/** Tra khai báo một cột theo key, trong phạm vi mẫu đơn. */
export function poField(template: PoTemplate, key: string): PoField | undefined {
  return PO_FIELDS[template].find((f) => f.key === key)
}

/**
 * BẢNG TRA "CỘT MƯỢN" — một cột DB của dòng đơn mang nghĩa KHÁC NHAU theo mẫu.
 *
 * Đây là nợ thiết kế có chủ đích (thêm cột DB tốn migration nên các đợt
 * 0122→0137 tái dùng cột trống của mẫu khác) — bảng này là chỗ DUY NHẤT ghi
 * nghĩa thật của từng cột theo mẫu, để: (a) ai đọc code/viết báo cáo biết
 * `material_grade` của đơn sơn là mã màu chứ không phải vật liệu; (b) đợt 3 kế
 * hoạch cải thiện (docs/vat-tu-ke-hoach-cai-thien-thiet-ke.md) biết chỗ nào
 * phải trả nợ trước.
 *
 * `po-fields.test.ts` đối chiếu bảng này với PO_FIELDS — thêm/đổi nghĩa một cột
 * mượn mà quên cập nhật bảng là test đỏ.
 *
 * Hai ca SỐ đổi đơn vị theo mẫu ĐÃ TRẢ NỢ ở 0139 (đợt 3): gỗ m³/SP →
 * `m3_per_unit`, mro bảo hành → `warranty_text` — `weight_per_unit` nay chỉ còn
 * nghĩa kg/đơn vị, `finish` chỉ còn màu/bề mặt. Các ca text còn lại chấp nhận
 * mượn tiếp. Từ nay KHÔNG mượn thêm: mẫu mới cần trường mới thì thêm cột DB
 * đúng nghĩa.
 */
export const PO_SHARED_FIELD_MEANING: Record<
  string,
  Partial<Record<PoTemplate, string>>
> = {
  material_grade: {
    accessory: 'Vật liệu',
    metal_kg: 'Vật liệu',
    rattan: 'Định mức',
    paint: 'Mã màu NCC',
    glass: 'Loại kính',
    wood: 'Loại gỗ',
    mro: 'Model / Mã hãng',
  },
  dimension_text: {
    metal_kg: 'Kích thước',
    glass: 'Quy cách',
    mro: 'Dùng cho máy / vị trí',
  },
  finish: {
    metal_kg: 'Màu / bề mặt',
    wood: 'Màu gỗ',
  },
}

/**
 * CỘT MƯỢN NÀO ĐƯỢC ĐỔ SỐ DANH MỤC / LẦN ĐẶT TRƯỚC VÀO (03/09/2026).
 *
 * Lỗi thật: thêm thùng carton BB-0025 (quy cách "950×620×135 mm") vào đơn GỖ
 * thì chuỗi đó chui vào cột "KH GIAO HÀNG" — vì cột ấy mượn `dimension_text`,
 * mà `newLine` đổ `spec` danh mục vào `dimension_text` cho MỌI mẫu. Cùng
 * lỗi ở MRO ("Dùng cho máy / vị trí" nhận quy cách), mây ("Định mức" nhận vật
 * liệu), sơn/MRO ("Mã màu NCC" / "Model" nhận vật liệu).
 *
 * Bảng `PO_SHARED_FIELD_MEANING` đã nói mỗi cột mượn NGHĨA LÀ GÌ ở từng mẫu;
 * bảng này nói tiếp: nghĩa đó có TRÙNG với nghĩa trong danh mục vật tư không
 * (material_grade = "vật liệu / màu" 0124, dimension_text = quy cách/kích
 * thước, finish = màu / bề mặt). Trùng thì điền sẵn cho đỡ gõ; khác thì để
 * TRỐNG — một ô trống người ta sẽ điền, một ô sai người ta ký luôn.
 *
 * Mẫu không có ô nhập cho cột đó cũng KHÔNG điền: giá trị vô hình hôm nay sẽ
 * lộ ra dưới nhãn khác khi đổi mẫu. `po-fields.test.ts` khoá hai bảng phủ
 * đúng cùng một tập (cột, mẫu).
 */
export const PO_SHARED_FIELD_PREFILL: Record<string, Partial<Record<PoTemplate, boolean>>> =
  {
    material_grade: {
      accessory: true,
      metal_kg: true,
      rattan: false, // "Định mức" — barem g/5m, không phải vật liệu
      paint: true, // "Mã màu NCC" — danh mục khai "vật liệu / MÀU", cùng nghĩa
      glass: true,
      wood: true,
      mro: false, // "Model / Mã hãng"
    },
    dimension_text: {
      metal_kg: true,
      glass: true,
      mro: false, // "Dùng cho máy / vị trí"
    },
    finish: {
      metal_kg: true,
      wood: true,
    },
  }

/** Ô mượn ở mẫu này có nhận số danh mục / lần đặt trước không. */
export function prefillsFromCatalog(t: PoTemplate, field: string): boolean {
  return PO_SHARED_FIELD_PREFILL[field]?.[t] ?? false
}
