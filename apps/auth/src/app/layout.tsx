import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | TNC Shift Scheduling",
  description: "เข้าสู่ระบบจัดตารางกะ TNC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
