import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Central Authentication",
  description: "Central authentication service for trusted scheduling applications",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
