// NẠP 10 ĐƠN ĐẶT HÀNG anh Truyền (Cung ứng) ký, tập scan dh-09182026013924.pdf.
//
//   node scripts/don-truyen-0918.mjs            # DRY-RUN
//   node scripts/don-truyen-0918.mjs --apply    # ghi thật
//
// Tập scan 14 trang = 11 đơn: trang 6 là bản scan lại của trang 1 (Thép Visa) và
// trang 14 của trang 5 (Tiến Đạt) — cùng số liệu, chỉ khác nét bút ghi lệnh. Trang
// 3 (Thép Asia) KHÔNG nạp ở đây: đơn đó đã nằm trong hệ thống là PO-2026-0068,
// chỉ thiếu giá — xem scripts/don-truyen-0918-gia-asia.mjs.
//
// CHỐT VỚI CHỦ DỰ ÁN (18/09/2026):
//   · vat_rate theo ĐÚNG TỜ ĐƠN. Tám tờ in sẵn ô "10%" nhưng dòng TỔNG THANH TOÁN
//     lại bằng đúng tiền hàng ⇒ ghi 0. Chỉ ba tờ thật sự cộng thuế thì ghi 10.
//   · status 'ordered' — đã ký Giám đốc, đã phát hành cho NCC.
//   · mã đơn dùng bộ sinh của hệ thống (PO-2026-00xx), số ghi tay trên tờ đưa vào note.
//   · dòng Ghế Relax MERXX 10 của Tiến Đạt lấy SL 160 (nét tay đè lên số in 207).
//
// ĐƠN GIÁ GỐC LÀ ĐỒNG/KG ở hầu hết các tờ, nhưng qty_ordered của hệ thống giữ SỐ
// CÂY. Nên unit_price được quy về đồng/cây (giá_kg × kg mỗi cây); giá gốc theo kg
// giữ lại trong note để đối chiếu. Cách này giống hệt đơn Asia đã nạp.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const NGUON = 'Nạp từ tập scan đơn đặt hàng anh Truyền ký, nhận 18/09/2026.'

// Lệnh sản xuất. MX = MERXX; IBIZA nằm trong lệnh ROSCO 02.
// Người ký ô NGƯỜI ĐẶT HÀNG trên cả 11 tờ. Phải gắn vào đơn, nếu không danh sách
// hiện "chưa giao ai": đơn thành vô chủ, không lọt bộ lọc "Của tôi" của chính người
// đang giữ nó và không ai bị nhắc khi NCC trễ hẹn.
const TRUYEN = 'e99f2f40-7965-46de-9d38-2989f73cb81f' // Trương Thanh Truyền · Cung ứng

const LSX = {
  MX09: 'f547e535-48c8-40a6-8426-8e23d88bc39b', // 09/26-27 - MX
  MX10: '278873c2-bfc7-43eb-8aaf-21fb0b3835b9', // 10/26-27 - MX
  ROSCO02: 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c', // 02/26-27 - ROSCO (IBIZA)
}

const NCC = {
  VISA: { id: 'e8a22500-0763-418c-bcd3-707b65b58be7' },
  TIENDAT: { id: 'a6a6710d-ad56-4874-acaf-59113590f65f' },
  DOANGIA: { id: '546266d5-42fb-41d8-86c7-b5dc9079e522' },
  CATTUONG: { id: 'ae39ff5b-b00e-461c-9be0-04cea2f45966' },
  VIETECO: { id: '55630a18-66ea-4c48-882f-5ff3dabd99a0' },
  QUANGMINH: { id: '323888a2-1d5d-4c27-aca7-a4196cf24560' },
  // Hai hồ sơ này do scripts/ncc-truyen-0918.mjs mở; tra id theo mã lúc chạy.
  KIMTUAN: { tra: 'KT' },
  ONGMAI: { tra: 'KOM' },
}

/* Mỗi dòng khai:
     sp   tên sản phẩm      ten  tên chi tiết       ma  mã vật tư ghi trên đơn
     dai  độ dài (m)        sl   số lượng (cây/tấm) kgc kg mỗi cây/tấm
     kg   tổng kg           gkg  đơn giá đồng/kg    tt  thành tiền
     tim  từ khoá dò danh mục (bậc cuối)            kgm kg/m để đối chiếu
   Dòng nào giá tính thẳng trên cây/tấm thì dùng gcay thay cho gkg. */
const DON = [
  {
    key: 'VISA',
    ncc: NCC.VISA,
    ngay: '15/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'Đơn IBIZA + MERXX 09',
    lsx: LSX.ROSCO02,
    lsx_them: [LSX.MX09],
    template: 'metal_kg',
    vat: 0,
    tong: 116313300,
    lines: [
      {
        sp: 'Ghế 1 xoay',
        ten: 'Chống tựa',
        ma: 'Ống Tròn Kẽm 13.8 (6Dem0) 5m',
        dai: 5.9,
        sl: 855,
        kgc: 1.21,
        kg: 1034.55,
        gcay: 25900,
        tt: 22144500,
        tim: ['13.8'],
        kgm: 0.205,
      },
      {
        sp: 'Ghế 1-2',
        ten: 'Cụm thanh mê/thanh chống',
        ma: 'Ống Tròn Kẽm 15.9 (6Dem0) 5m',
        dai: 5.85,
        sl: 802,
        kgc: 1.4,
        kg: 1122.8,
        gcay: 29800,
        tt: 23899600,
        tim: ['15.9'],
        kgm: 0.239,
      },
      {
        sp: 'Ghế 1 xoay',
        ten: 'Đỡ sau',
        ma: 'Ống Tròn Kẽm 21 (8 Dem) 5m',
        dai: 5.32,
        sl: 1602,
        kgc: 2.21,
        kg: 3540.42,
        gcay: 43100,
        tt: 69046200,
        tim: ['21'],
        kgm: 0.415,
      },
      {
        sp: 'Ghế Atrani MERXX 09',
        ten: 'Giằng',
        ma: 'Ống Tròn Kẽm 15.9 (6Dem0) lẻ',
        dai: 6.0,
        sl: 10,
        kgc: 1.45,
        kg: 14.5,
        gcay: 31200,
        tt: 312000,
        tim: ['15.9'],
        kgm: 0.242,
      },
      {
        sp: 'Ghế Atrani MERXX 09',
        ten: 'La bạ tựa',
        ma: 'Ống Tròn Kẽm 25.4 (1Li2) lẻ',
        dai: 6.0,
        sl: 10,
        kgc: 4.44,
        kg: 44.4,
        gcay: 91100,
        tt: 911000,
        tim: ['25.4'],
        kgm: 0.74,
      },
    ],
  },
  {
    key: 'KIMTUAN',
    ncc: NCC.KIMTUAN,
    ngay: '09/09/2026',
    so_to: 'ĐH SỐ 02/2026',
    lsx_ghi: 'ĐƠN HÀNG IBIZA THÁNG 10',
    lsx: LSX.ROSCO02,
    template: 'metal_kg',
    vat: 0,
    tong: 95010000,
    lines: [
      {
        sp: 'Đơn hàng IBIZA tháng 10',
        ten: 'Thép tấm 2.5x1250x2500',
        ma: 'Thép tấm 2.5x1250x2500',
        dvt: 'Tấm',
        sl: 2,
        gcay: 1160000,
        tt: 2320000,
        tim: ['tấm', '2.5', '1250'],
      },
      {
        sp: 'Đơn hàng IBIZA tháng 10',
        ten: 'Thép tấm 3x1500x3000',
        ma: 'Thép tấm 3x1500x3000',
        dvt: 'Tấm',
        sl: 13,
        gcay: 1918000,
        tt: 24934000,
        tim: ['tấm', '3', '1500'],
      },
      {
        sp: 'Đơn hàng IBIZA tháng 10',
        ten: 'Thép tấm 4x1500x3000',
        ma: 'Thép tấm 4x1500x3000',
        dvt: 'Tấm',
        sl: 4,
        gcay: 2557000,
        tt: 10228000,
        tim: ['tấm', '4', '1500'],
      },
      {
        sp: 'Đơn hàng IBIZA tháng 10',
        ten: 'Thép tấm 5x1500x3000',
        ma: 'Thép tấm 5x1500x3000',
        dvt: 'Tấm',
        sl: 18,
        gcay: 3196000,
        tt: 57528000,
        tim: ['tấm', '5', '1500'],
      },
    ],
  },
  {
    key: 'TIENDAT_A',
    ncc: NCC.TIENDAT,
    ngay: '16/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'Đơn MERXX 09 JAWOLL + MERXX 10',
    lsx: LSX.MX09,
    lsx_them: [LSX.MX10],
    template: 'aluminium',
    vat: 0,
    tong: 363968000,
    uoc_luong: true, // tờ ghi: "khối lượng dự kiến, thanh toán theo cân thực tế"
    lines: [
      {
        sp: 'Ghế 5pos Verona Tựa đầu nan Polywood',
        ten: 'Tay vịn',
        ma: 'TD-HG-17',
        dai: 5.53,
        sl: 141,
        kgm: 0.385,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['hg17', 'hg-17'],
      },
      {
        sp: 'Ghế 5pos Verona Tựa đầu nan Polywood',
        ten: 'Dọc tựa/ Dọc ngồi',
        ma: 'TD-A648',
        dai: 6.0,
        sl: 103,
        kgm: 0.485,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['a648'],
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Diềm dọc khung',
        ma: 'TD-B107',
        dai: 6.0,
        sl: 75,
        kgm: 0.674,
        kg: 303,
        gkg: 121000,
        tt: 36663000,
        tim: ['b107'],
      },
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Chân trước',
        ma: 'TD-B58',
        dai: 5.81,
        sl: 142,
        kgm: 0.363,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['b58'],
      },
      {
        sp: 'Ghế Amafi',
        ten: 'Chân+tay',
        ma: 'TD-HG08',
        dai: 4.8,
        sl: 166,
        kgm: 0.376,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['hg08'],
      },
      {
        sp: 'Ghế Amafi',
        ten: 'Tựa + mê ngồi/ Dọc mê/ Dọc tựa',
        ma: 'TD-HG11',
        dai: 5.77,
        sl: 134,
        kgm: 0.389,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['hg11'],
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Nối chân',
        ma: 'B106',
        dai: 6.0,
        sl: 34,
        kgm: 1.461,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['106'],
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Chân',
        ma: 'B108',
        dai: 5.37,
        sl: 75,
        kgm: 0.757,
        kg: 305,
        gkg: 121000,
        tt: 36905000,
        tim: ['b108'],
      },
      {
        sp: 'Ghế Relax MERXX 10',
        ten: 'Đỡ trước',
        ma: 'Phi 25 (1,2)',
        dai: 5.98,
        sl: 160,
        kgm: 0.314,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['25'],
        ghi: 'Bản in ghi SL 207, sửa tay đè lên thành 160 — lấy 160 theo nét sửa.',
      },
      {
        sp: 'Ghế 5pos Verona Tựa đầu nan Polywood',
        ten: 'Chân trước / Chân sau',
        ma: '25x50(1)',
        dai: 5.44,
        sl: 139,
        kgm: 0.396,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['25x50'],
      },
    ],
  },
  {
    key: 'TIENDAT_B',
    ncc: NCC.TIENDAT,
    ngay: '16/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'Đơn MERXX 09 JAWOLL',
    lsx: LSX.MX09,
    template: 'aluminium',
    vat: 0,
    tong: 72600000,
    uoc_luong: true,
    lines: [
      {
        sp: 'Ghế Bank 2 gỗ Jawoll',
        ten: 'Tay vịn',
        ma: 'TD-HG16',
        dai: 5.72,
        sl: 203,
        kgm: 0.258,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['hg16'],
      },
      {
        sp: 'Ghế Bank 2 gỗ Jawoll',
        ten: 'Chân trước',
        ma: 'DTBD05',
        dai: 5.81,
        sl: 125,
        kgm: 0.416,
        kg: 300,
        gkg: 121000,
        tt: 36300000,
        tim: ['bd05', 'dtbd'],
      },
    ],
  },
  {
    key: 'DOANGIA_MX10',
    ncc: NCC.DOANGIA,
    ngay: '17/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'LSX MERXX 10',
    lsx: LSX.MX10,
    template: 'aluminium',
    vat: 0,
    tong: 48409200,
    lines: [
      {
        sp: 'Ghế Relax',
        ten: 'Dọc ngồi, dọc hông, đỡ dưới',
        ma: '20*20*1.0',
        dai: 6.0,
        sl: 90,
        kg: 110.16,
        gkg: 113000,
        tt: 12448080,
        tim: ['20x20'],
        stt_to: 3,
      },
      {
        sp: 'Ghế Relax',
        ten: 'Đỡ sau',
        ma: 'P25*1.0',
        dai: 6.0,
        sl: 260,
        kg: 318.24,
        gkg: 113000,
        tt: 35961120,
        tim: ['25'],
        stt_to: 7,
      },
    ],
  },
  {
    key: 'DOANGIA_MX09',
    ncc: NCC.DOANGIA,
    ngay: '17/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'LSX MERXX 09 JAWOLL',
    lsx: LSX.MX09,
    template: 'aluminium',
    vat: 0,
    tong: 252414880,
    lines: [
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Dọc tựa',
        ma: '12*25*1.0',
        dai: 6.0,
        sl: 200,
        kg: 243.6,
        gkg: 113000,
        tt: 27526800,
        tim: ['12x25'],
        stt_to: 1,
      },
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Chống giữa tựa',
        ma: '12*25*1.0',
        dai: 5.9,
        sl: 50,
        kg: 59.885,
        gkg: 113000,
        tt: 6767005,
        tim: ['12x25'],
        stt_to: 2,
      },
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Dọc ngồi',
        ma: '15*35*1.0',
        dai: 5.7,
        sl: 220,
        kg: 319.77,
        gkg: 113000,
        tt: 36134010,
        tim: ['15x35'],
        stt_to: 3,
      },
      {
        sp: 'Ghế 5pos Verona Tựa đầu nan Polywood',
        ten: 'Giang chân trước + sau',
        ma: '20*40*1.0',
        dai: 6.0,
        sl: 100,
        kg: 176.4,
        gkg: 113000,
        tt: 19933200,
        tim: ['20x40'],
        stt_to: 4,
      },
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Chân sau',
        ma: '20*40*1.0*GÂN',
        dai: 5.3,
        sl: 175,
        kg: 333.9,
        gkg: 113000,
        tt: 37730700,
        tim: ['20x40'],
        stt_to: 5,
      },
      {
        sp: 'Ghế Atrani',
        ten: 'Giằng tay',
        ma: 'P16*1.0',
        dai: 6.0,
        sl: 350,
        kg: 266.7,
        gkg: 113000,
        tt: 30137100,
        tim: ['16'],
        stt_to: 6,
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Viền dọc cánh',
        ma: '20*20*1.0',
        dai: 5.9,
        sl: 85,
        kg: 102.306,
        gkg: 113000,
        tt: 11560578,
        tim: ['20x20'],
        stt_to: 9,
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Viền ngang cánh',
        ma: '20*20*1.0',
        dai: 5.3,
        sl: 58,
        kg: 62.71,
        gkg: 113000,
        tt: 7086230,
        tim: ['20x20'],
        stt_to: 10,
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Viền dài O giữa',
        ma: '20*20*1.0',
        dai: 5.6,
        sl: 48,
        kg: 54.835,
        gkg: 113000,
        tt: 6196355,
        tim: ['20x20'],
        stt_to: 11,
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Giang cánh giữa 1',
        ma: '20*20*1.0',
        dai: 5.7,
        sl: 47,
        kg: 54.652,
        gkg: 113000,
        tt: 6175676,
        tim: ['20x20'],
        stt_to: 12,
      },
      {
        sp: 'Bàn 150(200)x90 Nan Polywood',
        ten: 'Giang cánh giữa 2',
        ma: '20*20*1.0',
        dai: 5.4,
        sl: 223,
        kg: 245.657,
        gkg: 113000,
        tt: 27759241,
        tim: ['20x20'],
        stt_to: 13,
      },
      {
        sp: 'Bàn NK CNKG Semi 150(220)x90',
        ten: 'Viền dọc cánh',
        ma: '25*25*1.0',
        dai: 5.3,
        sl: 170,
        kg: 229.755,
        gkg: 113000,
        tt: 25962315,
        tim: ['25x25'],
        stt_to: 15,
      },
      {
        sp: 'Bàn NK CNKG Semi 150(220)x90',
        ten: 'Viền ngang cánh',
        ma: '25*25*1.0',
        dai: 5.9,
        sl: 43,
        kg: 64.694,
        gkg: 113000,
        tt: 7310422,
        tim: ['25x25'],
        stt_to: 16,
      },
      {
        sp: 'Bàn NK CNKG Semi 150(220)x90',
        ten: 'Viền dọc O giữa',
        ma: '25*25*1.0',
        dai: 5.7,
        sl: 13,
        kg: 18.896,
        gkg: 113000,
        tt: 2135248,
        tim: ['25x25'],
        stt_to: 17,
      },
    ],
  },
  {
    key: 'CATTUONG',
    ncc: NCC.CATTUONG,
    ngay: '17/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'LSX MERXX 09 JAWOLL',
    lsx: LSX.MX09,
    template: 'aluminium',
    vat: 0,
    tong: 9960000,
    lines: [
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Nan Mê',
        ma: 'Nhôm tấm 1.75 (1200x2400)',
        dvt: 'Tấm',
        sl: 6,
        kgc: 13.83,
        kg: 83.0,
        gkg: 120000,
        tt: 9960000,
        tim: ['1,75', '1.75'],
      },
    ],
  },
  {
    key: 'VIETECO',
    ncc: NCC.VIETECO,
    ngay: '17/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'LSX MERXX 09',
    lsx: LSX.MX09,
    template: 'aluminium',
    vat: 10,
    tong: 49089180,
    tong_tt: 53998098,
    lines: [
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Đỡ trước',
        ma: '13.5x50',
        dai: 5.76,
        sl: 86,
        kgm: 0.384,
        kg: 190.22,
        gkg: 98000,
        tt: 18641560,
        tim: ['13,5x50', '13.5x50'],
      },
      {
        sp: 'Ghế Bank 2 Gỗ Jawoll',
        ten: 'Đỡ sau',
        ma: '13.5x50',
        dai: 5.58,
        sl: 145,
        kgm: 0.384,
        kg: 310.69,
        gkg: 98000,
        tt: 30447620,
        tim: ['13,5x50', '13.5x50'],
      },
    ],
  },
  {
    key: 'QUANGMINH',
    ncc: NCC.QUANGMINH,
    ngay: '17/09/2026',
    so_to: '(ô ĐH SỐ để trống)',
    lsx_ghi: 'KHUÔN MẪU',
    lsx: null, // khuôn không gắn lệnh sản xuất nào
    template: 'mro',
    vat: 10,
    tong: 3996000,
    tong_tt: 4395600,
    lines: [
      {
        sp: 'Khuôn mẫu',
        ten: 'QM - HGGL-5858R10',
        ma: 'QM-HGGL-5858R10',
        dai: 3.0,
        sl: 20,
        kgc: 1.85,
        kg: 37.0,
        gkg: 108000,
        tt: 3996000,
        tim: ['hggl', '5858'],
        khuon: 1,
      },
    ],
  },
]

// Đơn Khu Ông Mai để RIÊNG: con số đơn giá trên tờ đọc không chắc (xem cảnh báo
// khi chạy). Tiền hàng và thuế thì chắc vì chúng tự kiểm nhau.
const ONGMAI = {
  key: 'ONGMAI',
  ncc: NCC.ONGMAI,
  ngay: '07/09/2026',
  so_to: 'ĐH SỐ 01/2026',
  lsx_ghi: 'Lsx 02 - ROSCO/IBIZA (T10)',
  lsx: LSX.ROSCO02,
  template: 'metal_kg',
  vat: 10,
  tong: 112358552,
  tong_tt: 123594407,
  can_xac_nhan:
    'Đơn giá in trên tờ đọc được là ~438.883đ/tấm, nhưng 256 × 438.883 = 112.354.048đ,' +
    ' lệch 4.504đ so với dòng Cộng tiền hàng 112.358.552đ. Tiền hàng và thuế thì tự kiểm' +
    ' nhau đúng (112.358.552 + 11.235.855 = 123.594.407), nên tổng là chắc. Đơn giá dưới' +
    ' đây được QUY NGƯỢC TỪ TỔNG, cần đối chiếu lại bản gốc.',
  lines: [
    {
      sp: 'Ghế 1 Xoay',
      ten: 'Mặt mê ngồi khoét Lazer',
      ma: 'I-TAM-1.3LI-1000X2300',
      dvt: 'Tấm',
      sl: 256,
      kgc: 25.276,
      kg: 6470.91,
      tt: 112358552,
      tim: ['tấm', '1,4', '1.4'],
    },
  ],
}

// ── kiểm số TRƯỚC khi đụng vào cơ sở dữ liệu ────────────────────────────────
// Mỗi tờ đơn tự mang bằng chứng: kg × giá/kg (hoặc SL × giá/cây) = thành tiền,
// cộng dồn ra đúng dòng "Cộng tiền hàng", thuế đúng suất. Lệch là đọc sai ảnh.
let hong = 0
for (const d of DON) {
  let cong = 0
  for (const l of d.lines) {
    const tt = l.gkg != null ? Math.round(l.kg * l.gkg) : Math.round(l.sl * l.gcay)
    if (tt !== l.tt) {
      const cach = l.gkg != null ? `${l.kg}kg × ${l.gkg}` : `${l.sl} × ${l.gcay}`
      console.error(`✗ ${d.key} "${l.ten}": ${cach} = ${tt} ≠ ${l.tt}`)
      hong++
    }
    if (l.kgm != null && l.dai != null && l.kg != null) {
      const kg = l.sl * l.dai * l.kgm
      if (Math.abs(kg - l.kg) / l.kg > 0.02) {
        console.error(
          `✗ ${d.key} "${l.ten}": ${l.sl} cây × ${l.dai}m × ${l.kgm}kg/m = ${kg.toFixed(2)}kg ≠ ${l.kg}kg`,
        )
        hong++
      }
    }
    cong += l.tt
  }
  if (cong !== d.tong) {
    console.error(`✗ ${d.key}: cộng dòng ${cong} ≠ tiền hàng ${d.tong}`)
    hong++
  }
  const thue = Math.round((d.tong * d.vat) / 100)
  const tt = d.tong + thue
  if (d.tong_tt != null && tt !== d.tong_tt) {
    console.error(
      `✗ ${d.key}: ${d.tong} + thuế ${thue} = ${tt} ≠ tổng thanh toán ${d.tong_tt}`,
    )
    hong++
  }
}
{
  const thue = Math.round((ONGMAI.tong * ONGMAI.vat) / 100)
  if (ONGMAI.tong + thue !== ONGMAI.tong_tt) {
    console.error(`✗ ONGMAI: ${ONGMAI.tong} + ${thue} ≠ ${ONGMAI.tong_tt}`)
    hong++
  }
}
if (hong) {
  console.error(`\nDừng: ${hong} chỗ số không khớp tờ đơn.`)
  process.exit(1)
}
const soDong = DON.reduce((a, d) => a + d.lines.length, 0) + ONGMAI.lines.length
const soTien = DON.reduce((a, d) => a + (d.tong_tt ?? d.tong), 0) + ONGMAI.tong_tt
console.log(
  `✓ Phép kiểm số: ${DON.length + 1} đơn, ${soDong} dòng, tổng ${soTien.toLocaleString('vi-VN')}đ — khớp chứng từ.\n`,
)

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

// Hai nhà cung cấp mở bằng scripts/ncc-truyen-0918.mjs — lấy id theo mã.
{
  const { data: ncc } = await db.from('supply_suppliers').select('id, code, name')
  for (const n of Object.values(NCC)) {
    if (!n.tra) continue
    const co = (ncc ?? []).find((s) => s.code === n.tra)
    if (!co)
      throw new Error(
        `chưa có hồ sơ NCC mã ${n.tra} — chạy scripts/ncc-truyen-0918.mjs trước`,
      )
    n.id = co.id
    n.name = co.name
  }
}

/* ── BẢNG CHỐT MÃ (rà tay 18/09/2026) ──────────────────────────────────────
   Khoá là chuỗi ghi ở cột "Mã VT" trên tờ đơn. Máy chỉ tự nhận 8 dòng (kg/m
   khít VÀ tên trùng); 33 quy cách còn lại chốt ở đây, mỗi dòng kèm lý do.

   Cách đọc cột lệch: kg/m "đo được" = tổng kg trên tờ ÷ (số cây × độ dài) —
   số NCC thật sự cân, nên nó là bằng chứng mạnh hơn tên gọi. */
const CHOT = {
  // — Thép Visa. Ống tròn mạ kẽm; "6Dem0" = 0,60mm, "8 Dem" = 0,80, "1Li2" = 1,20.
  'Ống Tròn Kẽm 13.8 (6Dem0) 5m': ['SAT0541', 'đúng quy cách 13.8×0.6'],
  'Ống Tròn Kẽm 21 (8 Dem) 5m': [
    'ST-0190',
    'phi 21×0.8 mạ kẽm; 0,4045 so với 0,415 đo được',
  ],
  // — Nhôm Tiến Đạt. Danh mục có nhiều bản trùng tên; lấy bản kg/m gần nhất.
  'TD-HG-17': [
    'NH-0237',
    'bản HG17 gần nhất: 0,373 so với 0,385 (các bản kia 0,428/0,311)',
  ],
  'TD-A648': ['NH-0016', 'mã duy nhất mang tên A648; 0,457 so với 0,485'],
  'TD-B107': ['NH-0164', 'gần nhất: 0,665 so với 0,674 (bản NH-0019 là 0,697)'],
  'TD-B58': ['NHO0107', 'tên trùng đúng mã NCC — B58, KHÔNG phải B583/B582'],
  B108: ['NH-0011', 'tên và kg/m trùng khít 0,757'],
  'Phi 25 (1,2)': [
    'NH-0388',
    'ø25×1.2 TRƠN chỉ nặng 0,242 kg/m mà tờ đơn cân 0,314 — phần dôi ra là GÂN; bản có gân đo 0,317',
  ],
  '25x50(1)': ['NH-0006', 'kg/m trùng khít 0,396'],
  DTBD05: ['NHO0184', 'tên trùng đúng mã NCC'],
  // — Nhôm Đoàn Gia.
  '20*20*1.0': ['NH-0513', 'vuông 20×20 T1.0: 0,202 so với 0,204'],
  'P25*1.0': ['NH-0003', 'phi 25×1.0: 0,203 so với 0,204 — đúng cả lý thuyết (0,204)'],
  '15*35*1.0': ['NH-0143', 'bốn bản cùng 0,255; lấy bản tên chuẩn nhất'],
  '20*40*1.0': ['NH-0127', 'hộp 20×40 T1.0: 0,310 so với 0,294'],
  '20*40*1.0*GÂN': [
    'NH-0480',
    'LỆCH ĐÁNG KỂ: tờ đơn ghi GÂN nên lấy bản có gân T1.0 (0,415), nhưng tờ cân 0,360 —' +
      ' sát bản NH-0476 "20x40R T1.0 R1.5" (0,358) hơn. Lấy theo CHỮ trên đơn vì gắn nhầm' +
      ' loại thì xưởng lĩnh sai thanh; cần người biết hàng xác nhận lại.',
  ],
  // — Cát Tường.
  'Nhôm tấm 1.75 (1200x2400)': ['NH-0077', 'tên trùng nguyên văn cả độ dày lẫn khổ'],
}

/* Cùng một thứ, hai cách ghi trên tờ. Tờ Visa phân biệt cây "5m" (hàng theo
   đợt) với cây "lẻ" (mua lẻ 10 cây) nhưng quy cách 15.9×0.6 thì y hệt — và
   kg/m cân được xác nhận: 0,239 với 0,242. Gộp về một mã. */
const GOP = { 'Ống Tròn Kẽm 15.9 (6Dem0) lẻ': 'Ống Tròn Kẽm 15.9 (6Dem0) 5m' }

/* ── VẬT TƯ MỞ MỚI ─────────────────────────────────────────────────────────
   Chỉ mở khi danh mục THẬT SỰ không có — đã tra cả biến thể tên. Mã cấp nối
   tiếp đúng tiền tố mà họ hàng của chúng đang dùng. */
const VT_MOI = {
  'Ống Tròn Kẽm 15.9 (6Dem0) 5m': {
    pre: 'SAT',
    name: 'Thép ống kẽm phi 15.9x0.6x6m',
    unit: 'Cây',
    spec: '15.9×0.6×6m',
    kg_per_m: 0.239,
    group_name: 'Sắt thép - tôn - tấm',
    vi: 'danh mục có 15.9×0.65 và 15.9×0.8 thép, còn 15.9×0.6 thì chỉ có bản INOX (IX-0033) — khác vật liệu',
  },
  'Ống Tròn Kẽm 25.4 (1Li2) lẻ': {
    pre: 'SAT',
    name: 'Thép ống kẽm phi 25.4x1.2x6m',
    unit: 'Cây',
    spec: '25.4×1.2×6m',
    kg_per_m: 0.74,
    group_name: 'Sắt thép - tôn - tấm',
    vi: '25.4×1.2 trong danh mục chỉ có bản INOX (SAT0816); bản thép chỉ tới 25.4×1.0',
  },
  'Thép tấm 2.5x1250x2500': {
    pre: 'SAT',
    name: 'Thép tấm 2.5x1250x2500',
    unit: 'Tấm',
    spec: '2.5×1250×2500',
    group_name: 'Sắt thép - tôn - tấm',
    vi: 'danh mục có "Thép tấm 2.5li" nhưng ĐVT Kg và không ghi khổ; đơn này mua nguyên tấm, giá theo tấm',
  },
  'Thép tấm 3x1500x3000': {
    pre: 'SAT',
    name: 'Thép tấm 3x1500x3000',
    unit: 'Tấm',
    spec: '3×1500×3000',
    group_name: 'Sắt thép - tôn - tấm',
    vi: 'như trên — bản theo Kg là SAT0442',
  },
  'Thép tấm 4x1500x3000': {
    pre: 'SAT',
    name: 'Thép tấm 4x1500x3000',
    unit: 'Tấm',
    spec: '4×1500×3000',
    group_name: 'Sắt thép - tôn - tấm',
    vi: 'danh mục KHÔNG có thép tấm 4 li ở bất kỳ dạng nào',
  },
  'Thép tấm 5x1500x3000': {
    pre: 'SAT',
    name: 'Thép tấm 5x1500x3000',
    unit: 'Tấm',
    spec: '5×1500×3000',
    group_name: 'Sắt thép - tôn - tấm',
    vi: 'như trên — bản theo Kg là SAT0445',
  },
  'I-TAM-1.3LI-1000X2300': {
    pre: 'SAT',
    name: 'Thép tấm 1.4 li, khổ 1000x2300',
    unit: 'Tấm',
    spec: '1.4×1000×2300',
    group_name: 'Sắt thép - tôn - tấm',
    vi:
      'ĐỘ DÀY LẤY THEO CÂN, KHÔNG THEO MÃ NCC: mã ghi "1.3LI" nhưng tờ đơn cân 25,276 kg/tấm —' +
      ' tấm 1000×2300 dày 1,4mm ra đúng 25,277 kg, còn 1,3mm chỉ 23,47 kg. Tên tờ đơn cũng ghi "1.4 li".',
  },
  '12*25*1.0': {
    pre: 'NH-',
    name: 'Nhôm hộp 12 x 25 T1.0',
    unit: 'Cây',
    spec: '12×25×1.0',
    kg_per_m: 0.203,
    group_name: 'Nhôm định hình - tấm',
    vi: 'danh mục chỉ có NH-0453 hộp 12×25 T0.4 (0,057 kg/m) — sai hẳn độ dày',
  },
  '13.5x50': {
    pre: 'NH-',
    name: 'Nhôm hộp 13.5 x 50',
    unit: 'Cây',
    spec: '13.5×50',
    kg_per_m: 0.384,
    group_name: 'Nhôm định hình - tấm',
    vi: 'không có mã nào 13.5×50; tờ đơn không ghi độ dày nên để trống, kg/m lấy theo cân (0,384)',
  },
  'QM-HGGL-5858R10': {
    pre: 'NH-',
    name: 'Nhôm QM-HGGL-5858R10',
    unit: 'Cây',
    spec: 'HGGL-5858R10',
    kg_per_m: 0.6167,
    group_name: 'Nhôm định hình - tấm',
    vi:
      'hàng ép từ khuôn mới, chưa từng có mã. Tờ ghi "1.850" ở cột kg/6m nhưng cây dài 3m và' +
      ' 20 cây cân 37 kg ⇒ 1,85 là kg MỖI CÂY, tức 0,6167 kg/m.',
  },
}

const mats = []
for (let f = 0; ; f += 1000) {
  const { data } = await db
    .from('warehouse_materials')
    .select('id, code, name, unit, kg_per_m, group_name')
    .range(f, f + 999)
  if (!data?.length) break
  mats.push(...data)
  if (data.length < 1000) break
}
const chuan = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[*×]/g, 'x')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')

// Vật liệu suy từ tiền tố mã danh mục. Lọc bước này là bắt buộc: kg/m của một
// thanh thép và một thanh nhôm hoàn toàn có thể trùng nhau, mà gắn nhầm thì sai
// cả giá thành lẫn trừ tồn.
const vatLieu = (m) => {
  const c = String(m.code ?? '')
  if (/^(NH|NHO)/i.test(c)) return 'nhôm'
  if (/^(ST|SAT)/i.test(c)) return 'thép'
  if (/^IX/i.test(c)) return 'inox'
  return null
}

/* Khớp CHẶT — chỉ nhận khi CẢ HAI bằng chứng cùng trúng: kg/m khít trong 1,5g và
   tên mang từ khoá của mã ghi trên đơn, và đúng vật liệu. Bản lỏng trước đó (nhận
   riêng kg/m) đã gán "Ống Tròn Kẽm 21" vào "Nhôm hộp 20x40" và "Thép tấm 4 ly"
   vào "Tấm nhựa GPPS" — một bằng chứng đơn lẻ là không đủ. Không trúng thì trả
   danh sách ỨNG VIÊN để người soát chốt, KHÔNG tự chọn hộ. */
function khop(l, vl) {
  const kgm = l.kgm ?? (l.dai && l.kg && l.sl ? l.kg / (l.sl * l.dai) : null)
  const cungVl = mats.filter((m) => !vl || vatLieu(m) === null || vatLieu(m) === vl)
  const hopTen = (m) => l.tim.some((t) => chuan(m.name).includes(chuan(t)))

  if (kgm != null) {
    const khit = cungVl.filter(
      (m) => m.kg_per_m != null && Math.abs(Number(m.kg_per_m) - kgm) < 0.0015,
    )
    const caHai = khit.filter(hopTen)
    if (caHai.length === 1)
      return { m: caHai[0], vi: 'chắc: kg/m + tên', kgm, ungVien: [] }
    if (caHai.length > 1)
      return { m: null, vi: `${caHai.length} bản cùng khớp`, kgm, ungVien: caHai }
  }
  // Chưa chắc ⇒ gom ứng viên để người chốt: cùng vật liệu, tên hợp, xếp theo
  // khoảng cách kg/m (thiếu kg/m thì xuống cuối).
  const gan = cungVl
    .filter(hopTen)
    .map((m) => ({
      m,
      lech: m.kg_per_m != null && kgm != null ? Math.abs(Number(m.kg_per_m) - kgm) : null,
    }))
    .sort((a, b) => (a.lech ?? 9) - (b.lech ?? 9))
    .slice(0, 6)
  return {
    m: null,
    vi: gan.length ? 'cần chốt' : 'KHÔNG CÓ ỨNG VIÊN',
    kgm,
    ungVien: gan.map((x) => x.m),
  }
}

const theoMa = new Map(mats.map((m) => [m.code, m]))
const soCuoi = (pre) =>
  Math.max(
    0,
    ...mats
      .filter((m) => String(m.code ?? '').startsWith(pre))
      .map((m) => Number(String(m.code).slice(pre.length)))
      .filter(Number.isFinite),
  )

// ── vật tư mở mới ───────────────────────────────────────────────────────────
console.log('── VẬT TƯ MỞ MỚI ──\n')
const dem = {}
const maMoi = new Map()
for (const [khoa, v] of Object.entries(VT_MOI)) {
  const trung = mats.find((m) => m.name.trim().toLowerCase() === v.name.toLowerCase())
  if (trung) {
    console.log(`  = đã có, dùng lại: ${trung.code}  ${trung.name}`)
    maMoi.set(khoa, trung)
    continue
  }
  dem[v.pre] = (dem[v.pre] ?? soCuoi(v.pre)) + 1
  const code = v.pre + String(dem[v.pre]).padStart(4, '0')
  console.log(`  + ${code.padEnd(9)} ${v.name.padEnd(34)} [${v.unit}]`)
  console.log(`      vì: ${v.vi}`)
  if (!APPLY) {
    maMoi.set(khoa, { id: null, code, name: v.name, unit: v.unit })
    continue
  }
  const { data, error } = await db
    .from('warehouse_materials')
    .insert({
      code,
      name: v.name,
      unit: v.unit,
      spec: v.spec ?? null,
      kg_per_m: v.kg_per_m ?? null,
      group_name: v.group_name,
      po_template: v.pre === 'NH-' ? 'aluminium' : 'metal_kg',
      min_stock: 0,
      is_active: true,
      needs_review: true,
      note: NGUON + ' Mở mã vì: ' + v.vi,
    })
    .select('id, code, name, unit')
    .single()
  if (error) throw new Error(`vật tư ${code}: ${error.message}`)
  maMoi.set(khoa, data)
}

// ── gán mã cho từng dòng ────────────────────────────────────────────────────
console.log('\n── ĐỐI CHIẾU VẬT TƯ ──\n')
let thieu = 0
for (const d of [...DON, ONGMAI]) {
  const vl = d.template === 'metal_kg' ? 'thép' : 'nhôm'
  console.log(`  ${d.key} · ${d.ngay} · ${d.lsx_ghi}   [${vl}]`)
  for (const l of d.lines) {
    const khoa = GOP[l.ma] ?? l.ma
    let m = null
    let vi = ''
    if (CHOT[khoa]) {
      const [code, ly] = CHOT[khoa]
      m = theoMa.get(code)
      if (!m) throw new Error(`bảng CHOT trỏ tới ${code} nhưng danh mục không có mã đó`)
      vi = 'chốt tay — ' + ly
    } else if (maMoi.has(khoa)) {
      m = maMoi.get(khoa)
      vi = 'mã MỚI mở' + (GOP[l.ma] ? ' (gộp với dòng cây 5m)' : '')
    } else {
      const k = khop(l, vl)
      m = k.m
      vi = k.vi
    }
    l._m = m
    l._vi = vi
    if (!m) thieu++
    console.log(
      `    ${String(l.ma).slice(0, 26).padEnd(28)} ${(m ? `${m.code} ${m.name}` : '— CHƯA CÓ —').slice(0, 40).padEnd(42)} ${vi.slice(0, 60)}`,
    )
  }
  console.log()
}
if (thieu) {
  console.error(`Dừng: còn ${thieu} dòng chưa có mã vật tư.`)
  process.exit(1)
}
console.log(`✓ Cả ${soDong} dòng đều đã có mã vật tư.\n`)

if (!APPLY) {
  console.log('── ĐƠN SẼ TẠO ──\n')
  for (const d of [...DON, ONGMAI])
    console.log(
      `  ${d.key.padEnd(14)} ${d.ngay}  ${String(d.lines.length).padStart(2)} dòng  VAT ${String(d.vat).padStart(2)}%  ` +
        `${(d.tong_tt ?? d.tong).toLocaleString('vi-VN').padStart(13)}đ  ${d.lsx_ghi}`,
    )
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

// ── ghi đơn ─────────────────────────────────────────────────────────────────
// Mã đơn do hệ thống cấp (PO-2026-00xx) — số ghi tay trên tờ vào note.
const { data: daCo } = await db.from('supply_purchase_orders').select('code')
const daDung = new Set((daCo ?? []).map((p) => p.code))
console.log('\n── GHI ĐƠN ──\n')
for (const d of [...DON, ONGMAI]) {
  const { data: soMoi, error: eCode } = await db.rpc('next_doc_code', { p_kind: 'PO' })
  if (eCode) throw new Error('cấp mã đơn: ' + eCode.message)
  if (daDung.has(soMoi)) throw new Error(`mã ${soMoi} đã dùng`)
  daDung.add(soMoi)

  const thue = Math.round((d.tong * d.vat) / 100)
  const note =
    NGUON +
    ` Ngày trên tờ đơn: ${d.ngay}. Số ghi trên tờ: ${d.so_to}.` +
    ` Lệnh ghi trên đơn: "${d.lsx_ghi}".` +
    ` Chứng từ: tiền hàng ${d.tong.toLocaleString('vi-VN')}` +
    (d.vat
      ? ` + thuế ${d.vat}% ${thue.toLocaleString('vi-VN')}`
      : ' (tờ in ô thuế 10% nhưng dòng TỔNG THANH TOÁN bằng đúng tiền hàng ⇒ ghi VAT 0)') +
    ` = ${(d.tong_tt ?? d.tong).toLocaleString('vi-VN')}đ.` +
    ` Giá gốc trên tờ tính theo KG, hệ thống giữ số lượng theo ${d.lines[0].dvt ?? 'cây'} nên đơn giá đã quy đổi.` +
    (d.uoc_luong ? ' Tờ ghi: khối lượng dự kiến, thanh toán theo cân thực tế.' : '') +
    (d.can_xac_nhan ? ' CẦN XÁC NHẬN: ' + d.can_xac_nhan : '')

  const { data: po, error: e1 } = await db
    .from('supply_purchase_orders')
    .insert({
      code: soMoi,
      production_order_id: d.lsx,
      supplier_id: d.ncc.id,
      status: 'ordered',
      currency: 'VND',
      vat_rate: d.vat,
      price_includes_vat: false,
      template: d.template,
      assigned_to: TRUYEN,
      created_by: TRUYEN,
      note,
    })
    .select('id, code')
    .single()
  if (e1) throw new Error(`${d.key}: ${e1.message}`)

  const rows = d.lines.map((l, i) => ({
    po_id: po.id,
    material_id: l._m.id,
    qty_ordered: l.sl,
    unit_price: Math.round((l.tt / l.sl) * 100) / 100,
    line_name: `${l.sp} — ${l.ten}`,
    line_unit: l.dvt ?? 'Cây',
    spec: l.ma,
    weight_per_unit:
      l.kgc ?? (l.kg != null ? Math.round((l.kg / l.sl) * 10000) / 10000 : null),
    bar_length_m: l.dai ?? null,
    price_basis: 'unit',
    qty_basis: 'manual',
    sort_order: i,
    note:
      (l.stt_to ? `STT ${l.stt_to} trên tờ. ` : '') +
      (l.gkg ? `Tờ ghi ${l.gkg.toLocaleString('vi-VN')}đ/kg × ${l.kg}kg. ` : '') +
      (l._vi.startsWith('chốt tay') ? l._vi.slice(10) : '') +
      (l.ghi ? ' ' + l.ghi : ''),
  }))
  const { error: e2 } = await db.from('supply_purchase_order_lines').insert(rows)
  if (e2) throw new Error(`${d.key} dòng: ${e2.message}`)

  if (d.lsx_them?.length) {
    const { error: e3 } = await db
      .from('supply_po_extra_lsx')
      .insert(d.lsx_them.map((id) => ({ po_id: po.id, production_order_id: id })))
    if (e3) throw new Error(`${d.key} lệnh phụ: ${e3.message}`)
  }
  console.log(
    `  + ${po.code}  ${d.key.padEnd(14)} ${rows.length} dòng  ${(d.tong_tt ?? d.tong).toLocaleString('vi-VN').padStart(13)}đ`,
  )
  d._po = po.code
}

// ── đối chiếu lại sau khi ghi ───────────────────────────────────────────────
console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const d of [...DON, ONGMAI]) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, status, vat_rate')
    .eq('code', d._po)
    .maybeSingle()
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('qty_ordered, unit_price')
    .eq('po_id', po.id)
  const cong = Math.round(
    ln.reduce((a, b) => a + Number(b.qty_ordered) * Number(b.unit_price), 0),
  )
  const thue = Math.round((cong * Number(po.vat_rate)) / 100)
  const ok = cong === d.tong && cong + thue === (d.tong_tt ?? d.tong)
  console.log(
    `  ${ok ? '✓' : '✗'} ${po.code} [${po.status}] ${ln.length} dòng · hàng ${cong.toLocaleString('vi-VN')}` +
      ` · thuế ${thue.toLocaleString('vi-VN')} · tổng ${(cong + thue).toLocaleString('vi-VN')}đ`,
  )
  if (!ok)
    console.log(
      `      tờ đơn: ${d.tong.toLocaleString('vi-VN')} / ${(d.tong_tt ?? d.tong).toLocaleString('vi-VN')}`,
    )
}
console.log('\n✓ Xong.\n')
