import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/LegalPage";
import { COOKIES } from "@/features/legal/legal-content";

export const metadata: Metadata = {
  title: COOKIES.title,
  description: COOKIES.summary,
};

export default function Page() {
  return <LegalPage document={COOKIES} />;
}
