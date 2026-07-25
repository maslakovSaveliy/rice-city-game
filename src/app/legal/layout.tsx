import type { Viewport } from "next";
import type { ReactNode } from "react";

/**
 * Свой цвет панелей браузера для юридических страниц.
 *
 * Корневой макет объявляет тёмно-коричневый — под игру. Документы светлые, и с
 * коричневыми панелями сверху и снизу страница выглядела бы вставленной в
 * чужую рамку. Значение обязано совпадать с `--rc-cream` из `_tokens.scss`:
 * держать цвет в двух местах приходится потому, что мета-теги собираются на
 * сервере и до CSS-переменных не дотягиваются.
 */
export const viewport: Viewport = {
  themeColor: "#eae5da",
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return children;
}
