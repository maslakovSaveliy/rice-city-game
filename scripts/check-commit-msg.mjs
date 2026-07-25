#!/usr/bin/env node
import { readFileSync } from "node:fs";

/**
 * Проверка формата коммита.
 *
 * Написано на Node, а не на grep, по конкретной причине: `grep -E` с шаблоном
 * `.{1,72}` считает БАЙТЫ. Русский заголовок из 58 символов занимает 105 байт
 * и отклонялся, хотя укладывался в лимит с запасом. Здесь длина считается
 * в символах.
 */

const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

const MAX_SUBJECT_LENGTH = 72;
const PATTERN = new RegExp(`^(${TYPES.join("|")})(\\([^)]+\\))?!?: .+$`);

const path = process.argv[2];
if (!path) {
  console.error("Не передан путь к файлу сообщения коммита.");
  process.exit(1);
}

const subject = readFileSync(path, "utf8")
  .split("\n")
  .find((line) => line.trim() !== "" && !line.startsWith("#"));

if (subject === undefined) {
  fail("Сообщение коммита пустое.");
}

// Слияния формирует git, их формат не наш.
if (subject.startsWith("Merge ") || subject.startsWith("Revert ")) {
  process.exit(0);
}

if (!PATTERN.test(subject)) {
  fail(
    `Заголовок не соответствует Conventional Commits.\n` +
      `Получено: ${subject}\n` +
      `Ожидается: <type>(<scope>): <описание>\n` +
      `Типы: ${TYPES.join(" ")}`,
  );
}

if ([...subject].length > MAX_SUBJECT_LENGTH) {
  fail(
    `Заголовок длиннее ${MAX_SUBJECT_LENGTH} символов (сейчас ${[...subject].length}).\n` +
      `Получено: ${subject}`,
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
