import fs from 'node:fs';
const ed = (p, pairs) => { let s = fs.readFileSync(p, 'utf8'); for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error('miss in ' + p + ': ' + a.slice(0, 70)); s = s.split(a).join(b); } fs.writeFileSync(p, s); };
const N = 'src/app/(mua-hang)/mua-hang/don/[id]/nhan';
const K = 'src/app/(workspace)/warehouse/phieu/[id]';
// 1. Form nhận hàng riêng của Cung ứng
ed(`${N}/NhanHangScreen.tsx`, [
  ['export function PhieuNhapScreen({', 'export function NhanHangScreen({'],
  ["/**\n * PHIẾU NHẬP THEO ĐƠN — màn chứng từ + lưới (Bước 1 Kho).", "/**\n * NHẬN HÀNG Ở CỬA CUNG ỨNG — bản RIÊNG của khu Mua hàng (12/10/2026, chủ dự án:\n * \"không dùng chung giao diện giữa 2 phòng\"). Chép từ form phiếu nhập của Kho\n * đúng bản trên main trước ngày 12/10; từ đây hai bản đi riêng: Kho đổi màn của\n * Kho không làm đổi màn của Cung ứng. DÙNG CHUNG chỉ còn tầng dữ liệu và luật\n * (`taiPhieuNhap`, `lib/kho-phieu-nhap`, POST `docs/receipt`) để số hai bên khớp.\n *\n * PHIẾU NHẬP THEO ĐƠN — màn chứng từ + lưới (Bước 1 Kho)."],
]);
ed(`${N}/page.tsx`, [["import { PhieuNhapScreen } from '@/app/(workspace)/warehouse/nhap/[poId]/PhieuNhapScreen'", "import { NhanHangScreen } from './NhanHangScreen'"], ['  return <PhieuNhapScreen {...r.props} />', '  return <NhanHangScreen {...r.props} />']]);
// 2. Hộp sửa phiếu riêng của Kho
ed(`${K}/sua-phieu.tsx`, [
  ['router.push(`/mua-hang/don/${row.po_id}/nhan?sua=${row.doc_id}`)', '// Bản của KHO: lập lại ngay trong khu Kho (12/10/2026).\n      router.push(`/warehouse/nhap/${row.po_id}?sua=${row.doc_id}`)'],
  ['/**\n * SỬA PHIẾU NHẬP ĐÃ GHI SỔ', '/**\n * BẢN CỦA KHO (12/10/2026) — chép từ hộp Sửa phiếu của Cung ứng (`theo-doi/da-ve/\n * sua-phieu.tsx`) để hai phòng không dùng chung giao diện; cùng route ghi, cùng luật.\n *\n * SỬA PHIẾU NHẬP ĐÃ GHI SỔ'],
]);
ed(`${K}/kg-can-sheet.tsx`, [['/**', '/** BẢN CỦA KHO (12/10/2026) — chép từ hộp Ghi kg của Cung ứng; cùng route `docs/[id]/kg-can`. */\n/**']]);
ed(`${K}/dieu-chinh-bang.tsx`, [["import { Code } from '@/components/kit'", "// BẢN CỦA KHO (12/10/2026) — chép từ bảng điều chỉnh của Cung ứng.\nimport { Code } from '@/components/kit'"]]);
ed(`${K}/PhieuChiTietScreen.tsx`, [
  ["import { SuaPhieuSheet, type Kieu } from '@/app/(mua-hang)/mua-hang/theo-doi/da-ve/sua-phieu'\nimport { KgCanSheet } from '@/app/(mua-hang)/mua-hang/theo-doi/da-ve/kg-can-sheet'", "import { SuaPhieuSheet, type Kieu } from './sua-phieu'\nimport { KgCanSheet } from './kg-can-sheet'"],
  ["          lapLaiHref={`/warehouse/nhap/${row.po_id}?sua=${row.doc_id}`}\n", ''],
  ["Dùng lại đúng hộp\n * của Cung ứng (`SuaPhieuSheet`, `KgCanSheet`) và đúng route ghi", "Hộp sửa là BẢN\n * RIÊNG của Kho (chép từ Cung ứng — hai phòng không dùng chung giao diện) và đúng route ghi"],
]);
// 3. Dải "Đã ghi sổ" riêng của Cung ứng
ed('src/app/(mua-hang)/mua-hang/theo-doi/DangVeScreen.tsx', [["import { DaGhiSoBar } from '@/components/warehouse/DaGhiSoBar'", "import { DaGhiSoBar } from './da-ghi-so-bar'"]]);
