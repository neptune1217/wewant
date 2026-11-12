import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// 시청 내부망에서 운영하므로 외부 웹폰트(Google Fonts)를 쓰지 않고 시스템 글꼴을 쓴다.
// (shadcn 설치 시 Geist 웹폰트가 자동으로 추가되면 이 원칙에 맞게 다시 제거한다)

export const metadata: Metadata = {
  title: "춘천시 위원회·위원 통합관리",
  description: "춘천시 위원회와 위원 정보를 통합 관리하는 시스템 (프로토타입, 가상 데이터)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
