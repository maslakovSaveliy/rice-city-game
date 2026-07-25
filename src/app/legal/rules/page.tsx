import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { RULES } from "@/features/legal/legal-content";

export const metadata: Metadata = {
  title: RULES.title,
  description: RULES.summary,
};

export default function Page() {
  return <LegalPage document={RULES} />;
}
