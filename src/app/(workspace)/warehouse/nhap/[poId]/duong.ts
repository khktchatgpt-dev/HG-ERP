/**
 * Form này có HAI cửa vào (01/10/2026): Kho › Hàng về, và Cung ứng › Đang về
 * khi Cung ứng tạm nhận hàng thay Kho. Cùng một form, cùng đường ghi sổ — chỉ
 * khác đường dẫn quay về, breadcrumb và khung bọc của khu.
 */
export type NoiNhan = 'kho' | 'cung-ung'

export const DUONG: Record<
  NoiNhan,
  {
    home: string
    crumbs: { label: string; href: string }[]
    phieu: (poId: string) => string
    /** Khu Kho nằm trong WorkspaceShell (không gắn .kit) nên phải tự bọc; khu Cung ứng có sẵn. */
    wrap: string
  }
> = {
  kho: {
    home: '/warehouse/nhap',
    crumbs: [
      { label: 'Kho', href: '/warehouse/nhap' },
      { label: 'Hàng về', href: '/warehouse/nhap' },
    ],
    phieu: (id) => `/warehouse/nhap/${id}`,
    wrap: 'theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col',
  },
  'cung-ung': {
    home: '/mua-hang/theo-doi',
    crumbs: [{ label: 'Theo dõi đơn hàng', href: '/mua-hang/theo-doi' }],
    phieu: (id) => `/mua-hang/don/${id}/nhan`,
    wrap: 'contents',
  },
}
