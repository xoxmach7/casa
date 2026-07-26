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
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult>(() => matchAddress(address));
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

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
    </div>
  );
}
