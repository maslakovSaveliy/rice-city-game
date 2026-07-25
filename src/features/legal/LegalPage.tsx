import Image from "next/image";
import Link from "next/link";
import styles from "./LegalPage.module.scss";
import {
  LEGAL_DOCUMENTS,
  LEGAL_TEXTS_APPROVED,
  LEGAL_UPDATED_AT,
  type LegalDocument,
  ORGANIZER,
} from "./legal-content";

/**
 * Общая раскладка юридических страниц.
 *
 * Светлая, в отличие от игровых экранов: это документы, их читают, а не играют
 * в них. Зум страницы здесь работает как обычно — блокировать масштабирование
 * на юридическом тексте недопустимо.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    // Атрибут читает `global.scss`: под светлой страницей холст тоже светлый.
    <div className={styles.root} data-surface="legal">
      <main className={styles.content}>
        <Link className={styles.back} href="/">
          ← К игре
        </Link>

        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.summary}>{document.summary}</p>

        {!LEGAL_TEXTS_APPROVED && (
          <p className={styles.draft} role="note">
            <strong>Черновик.</strong> Текст подготовлен для согласования и не является публичной
            офертой. До утверждения владельцем и юристом на него нельзя опираться.
          </p>
        )}

        {document.sections.map((section) => (
          <section className={styles.section} key={section.title}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p className={styles.paragraph} key={paragraph}>
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className={styles.list}>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className={styles.updated}>Редакция от {LEGAL_UPDATED_AT}</p>
      </main>

      <footer className={styles.footer}>
        {/* Логотип с подписью: юридические страницы — самое место для полной
            версии. Тёмная — фон здесь кремовый. */}
        <Image
          alt="РИСсити"
          className={styles.logo}
          height={152}
          sizes="(max-width: 480px) 58vw, 260px"
          src="/brand/logos/logo-horizontal-tagline-dark-512.png"
          width={512}
        />

        <nav aria-label="Юридические документы" className={styles.nav}>
          {LEGAL_DOCUMENTS.filter((item) => item.slug !== document.slug).map((item) => (
            <Link className={styles.navLink} href={`/legal/${item.slug}`} key={item.slug}>
              {item.title}
            </Link>
          ))}
        </nav>

        <p className={styles.requisites}>
          {ORGANIZER.name} · ИНН {ORGANIZER.inn} · ОГРН {ORGANIZER.ogrn}
          <br />
          {ORGANIZER.address}
          <br />
          <span className={styles.age}>{ORGANIZER.ageRating}</span>
        </p>
      </footer>
    </div>
  );
}
