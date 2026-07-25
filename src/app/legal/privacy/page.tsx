import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { PRIVACY } from "@/features/legal/legal-content";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description: PRIVACY.summary,
};

export default function Page() {
  return <LegalPage document={PRIVACY} />;
}
