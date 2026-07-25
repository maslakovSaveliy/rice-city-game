import { Golos_Text, Marck_Script, Unbounded } from "next/font/google";

/**
 * ЕДИНСТВЕННАЯ точка подмены шрифтов.
 *
 * Оригиналы бренда — ANGRY, GROTESK и Ceremonious one — переданы только
 * картинками в PDF: ни файлов, ни веб-лицензий нет. До их получения стоят
 * метрически близкие OFL-замены с кириллицей. Когда оригиналы придут,
 * меняется этот файл и больше ничего: весь код обращается к CSS-переменным.
 *
 * Статус замен: pending approval (см. MEMORY.md).
 */

/** Замена ANGRY — заголовки, названия, крупные акценты. */
const display = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

/** Замена GROTESK — основной текст, интерфейс, юридические страницы. */
const body = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Замена Ceremonious one. Marck Script — фломастерный, а не каллиграфический;
 * это заведомый компромисс. Использовать строго на одной акцентной фразе,
 * не на абзацах.
 */
const script = Marck_Script({
  subsets: ["cyrillic", "latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const fontVariables = [display.variable, body.variable, script.variable].join(" ");
