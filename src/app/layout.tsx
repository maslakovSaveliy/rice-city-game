import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "@/lib/fonts";
import "@/styles/global.scss";

export const metadata: Metadata = {
  title: {
    default: "РИСсити — игра",
    template: "%s · РИСсити",
  },
  description:
    "Игра-кликер РИСсити: тапай Рисинку за столом и накапливай скидку на счёт. Только для мобильных устройств.",
  robots: { index: false, follow: false },
  applicationName: "РИСсити",
  formatDetection: { telephone: false, email: false, address: false },
};

/**
 * Зум намеренно НЕ блокируется. Отключение масштабирования ломает доступность
 * юридических страниц, а двойной тап-зум на игровом поле снимается точечно
 * через `touch-action: none` на самой цели тапа.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#442219",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Переменные шрифтов вешаются на <html>, а не на <body>: токены в
    // `_tokens.scss` объявлены на `:root`, и с body они бы не разрешились.
    <html lang="ru" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
