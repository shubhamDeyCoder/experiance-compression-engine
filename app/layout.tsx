import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experience Compression Engine",
  description:
    "Expert-guided industry scenarios for practical decision-making practice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
