import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { CommandPalette } from '@/components/erp/CommandPalette'
import { NumberWheelGuard } from './NumberWheelGuard'
import type { WorkspaceConfig } from '@/workspaces/workspaces.config'

/**
 * Khung workspace: sidebar + topbar + vùng nội dung.
 *
 * Đặt trong LAYOUT (không phải từng page) để sidebar/topbar giữ nguyên khi
 * điều hướng — chỉ vùng `children` được thay bằng loading.tsx skeleton.
 * Sidebar tự highlight theo pathname (NavLink), nên không cần prop `current`.
 */
export async function WorkspaceShell({
  workspace,
  title,
  subtitle,
  actions,
  bare,
  children,
}: {
  workspace: WorkspaceConfig
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  /**
   * VÙNG NỘI DUNG TRỐNG KHUNG — cho màn dựng bằng `@/components/kit`.
   *
   * Màn kit tự lo mép, tự chốt chiều cao bằng `ScreenFrame` và cuộn BÊN TRONG
   * bảng (để tiêu đề cột và chân tổng dính được). Vùng mặc định của vỏ thì
   * ngược lại: có đệm 24px, chặn bề ngang 1600px, và tự cuộn — ba thứ đó cộng
   * lại làm `ScreenFrame` không bao giờ chốt nổi chiều cao. Đây đúng là bẫy
   * ghi ở CLAUDE.md ("cha đặt min-h-screen thì bảng không cuộn trong khung").
   *
   * Màn kit LẺ nằm trong khu cũ tự chữa bằng `-m-6` (xem `PoDetailScreen`);
   * cả một KHU thì khai ở đây, đừng bắt mỗi trang tự huỷ đệm của vỏ.
   */
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    // `theme-v3` "HG Ledger" đặt ở GỐC shell (duyệt 15/08/2026, thay theme-v2
    // stone/emerald): token xám-xanh + royal cobalt phủ cả sidebar + topbar +
    // nội dung. Kit dùng chung đã ăn token nên mọi màn tự khớp; trang cũ còn
    // gọi zinc trực tiếp vẫn đọc được (zinc ~ xám-xanh v3).
    // `h-screen` + `overflow-hidden` chứ KHÔNG `min-h-screen`: min-h chỉ đặt
    // SÀN, nên trang dài bao nhiêu thì cả shell cao bấy nhiêu — sidebar kéo dài
    // theo nội dung và cuộn mất khỏi tầm nhìn, đúng lỗi user báo 09/09/2026.
    // Chốt trần ở chiều cao màn hình thì điều hướng LUÔN đứng yên, chỉ vùng
    // nội dung cuộn — đúng nếp ERP: menu là mốc cố định, không phải phần đầu
    // của một trang giấy dài.
    <div className="theme-v3 bg-background text-foreground flex h-screen overflow-hidden">
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar
          workspace={workspace}
          title={title}
          subtitle={subtitle}
          actions={actions}
        />
        {/* Vùng cuộn DUY NHẤT của app. Trang v3 cuộn trong đây y như trước;
            trang v4 dùng ScreenFrame thì tự chốt chiều cao và cuộn trong bảng.
            `min-h-0` bắt buộc ở chế độ bare: thiếu nó thì ScreenFrame của màn
            con không chốt được chiều cao (bẫy đã dính 08/09/2026). */}
        <main
          className={
            bare
              ? 'min-h-0 w-full flex-1 overflow-auto'
              : 'mx-auto w-full max-w-[1600px] flex-1 overflow-auto p-4 sm:px-6 sm:py-6'
          }
        >
          {children}
        </main>
      </div>
      <CommandPalette />
      <NumberWheelGuard />
    </div>
  )
}
