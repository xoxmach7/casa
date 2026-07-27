"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getValuation, submitLeadForm, type ValuationResponse } from "@/lib/api/procasa-client";
import type { ValuationParams } from "./ParamsStep";
import { DistrictStep, type DistrictStepValue } from "./DistrictStep";
import { ParamsStep } from "./ParamsStep";
import { ResultStep } from "./ResultStep";
import { ContactStep, type ContactInfo } from "./ContactStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

const OTSENKA_FORM_ID = process.env.NEXT_PUBLIC_OTSENKA_FORM_ID ?? "";

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const initialComplex = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState<DistrictStepValue | null>(null);
  const [params, setParams] = useState<ValuationParams | null>(null);
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [submitted, setSubmitted] = useState<ContactInfo | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && (
        <DistrictStep
          initialComplex={initialComplex}
          onConfirm={(value) => {
            setLocation(value);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={async (submittedParams: ValuationParams) => {
            setParams(submittedParams);
            const result = await getValuation({
              district: location!.district,
              rooms: submittedParams.rooms,
              area: submittedParams.areaM2,
            });
            setValuation(result);
            setStep(3);
          }}
        />
      )}

      {step === 3 && valuation && (
        <ResultStep valuation={valuation} onContinue={() => setStep(4)} />
      )}

      {step === 4 && !submitted && (
        <ContactStep
          onSubmit={async (contact) => {
            setSubmitted(contact);
            if (OTSENKA_FORM_ID) {
              await submitLeadForm(OTSENKA_FORM_ID, {
                name: contact.name,
                phone: contact.phone,
                district: location?.district ?? "",
                residentialComplex: location?.residentialComplex ?? "",
                rooms: String(params?.rooms ?? ""),
                area: String(params?.areaM2 ?? ""),
                expectedPrice:
                  valuation?.status === "ready" ? String(valuation.marketPrice) : "",
              });
            }
          }}
        />
      )}

      {step === 4 && submitted && (
        <div className="rounded-card bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Спасибо, {submitted.name}!</h2>
          <p className="mt-2 text-ink/70">
            Мы свяжемся с вами по номеру {submitted.phone} в ближайшее время.
          </p>
        </div>
      )}
    </div>
  );
}
