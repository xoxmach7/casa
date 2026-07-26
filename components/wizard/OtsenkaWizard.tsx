"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import type { AddressMatchResult } from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult | null>(null);

  useEffect(() => {
    setMatch(matchAddress(address));
  }, [address]);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && match && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
