'use client'

import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
/*
  Toast của KIT (Radix, B2 — 24/09/2026) đứng SONG SONG với toast hệ cũ: hai
  context khác nhau nên không giẫm nhau. Màn kit gọi `useToast` từ
  `@/components/kit`, màn hệ cũ vẫn gọi từ `@/components/ui/Toast`.

  Import thẳng file con, KHÔNG qua cửa `@/components/kit`: đây là layout GỐC,
  mọi trang đều tải nó. Đi qua cửa chung là kéo cả bộ kit (bảng, điều hướng,
  chứng từ…) vào gói JS của mọi trang chỉ để lấy một provider. Luật "chỉ import
  từ cửa chung" là cho MÀN nghiệp vụ, không cho hạ tầng.
*/
import { ToastProvider as KitToastProvider } from '@/components/kit/Toast'

/** Single client-side providers wrapper used in root layout. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <KitToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </KitToastProvider>
    </ToastProvider>
  )
}
