import { Suspense } from "react";
import { OtsenkaWizard } from "@/components/wizard/OtsenkaWizard";

export default function OtsenkaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Suspense fallback={null}>
        <OtsenkaWizard />
      </Suspense>
    </main>
  );
}
