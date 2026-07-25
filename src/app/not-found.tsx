import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/features/status/StatusScreen";
import styles from "@/features/status/StatusScreen.module.scss";

export const metadata: Metadata = {
  title: "Страница не найдена",
};

export default function NotFound() {
  return (
    <StatusScreen
      action={
        <Link className={styles.linkAction} href="/">
          Вернуться к игре
        </Link>
      }
      description="Возможно, ссылка устарела или в адресе опечатка. Игра ждёт на главной."
      title="Такой страницы нет"
    />
  );
}
