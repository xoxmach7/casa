"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import { calculateValuation } from "@/lib/mock/valuation";
import type {
  AddressMatchResult,
  ValuationParams,
  ValuationResult,
} from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { ParamsStep } from "./ParamsStep";
import { ResultStep } from "./ResultStep";
import { ContactStep, type ContactInfo } from "./ContactStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult>(() => matchAddress(address));
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [submitted, setSubmitted] = useState<ContactInfo | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={(params: ValuationParams) => {
            const complexName =
              match.status === "matched" ? match.residentialComplex : "";
            setValuation(calculateValuation(complexName, params));
            setStep(3);
          }}
        />
      )}

      {step === 3 && valuation && (
        <ResultStep valuation={valuation} onContinue={() => setStep(4)} />
      )}

      {step === 4 && !submitted && (
        <ContactStep onSubmit={(contact) => setSubmitted(contact)} />
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
