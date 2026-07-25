import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { TERMS } from "@/features/legal/legal-content";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.summary,
};

export default function Page() {
  return <LegalPage document={TERMS} />;
}
