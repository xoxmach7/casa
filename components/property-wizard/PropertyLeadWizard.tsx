"use client";

import { useState } from "react";
import { submitPropertyLead } from "@/lib/api/procasa-client";
import { LocationStep, type LocationStepValue } from "./LocationStep";
import { PriceStep, type PriceStepValue } from "./PriceStep";
import { DetailsStep, type DetailsStepValue } from "./DetailsStep";
import { PhotosStep, type PhotosStepValue } from "./PhotosStep";

type WizardStep = 1 | 2 | 3 | 4;

export function PropertyLeadWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState<LocationStepValue | null>(null);
  const [price, setPrice] = useState<PriceStepValue | null>(null);
  const [details, setDetails] = useState<DetailsStepValue | null>(null);
  const [done, setDone] = useState(false);

  async function handlePhotosSubmit(photos: PhotosStepValue) {
    if (!location || !price || !details) return;

    await submitPropertyLead({
      district: location.district,
      residentialComplex: location.residentialComplex,
      address: location.address,
      houseNumber: location.houseNumber,
      price: price.price,
      negotiable: price.negotiable,
      moveInReady: price.moveInReady,
      furnished: details.furnished,
      hasAppliances: details.hasAppliances,
      rooms: details.rooms,
      area: details.area,
      contactName: photos.contactName,
      contactPhone: photos.contactPhone,
      photoUrls: photos.photoUrls,
    });

    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-card bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Заявка принята!</h2>
        <p className="mt-2 text-ink/70">
          Наш брокер свяжется с вами, чтобы согласовать дальнейшие шаги.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {step === 1 && (
        <LocationStep
          onSubmit={(value) => {
            setLocation(value);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <PriceStep
          onSubmit={(value) => {
            setPrice(value);
            setStep(3);
          }}
        />
      )}
      {step === 3 && (
        <DetailsStep
          onSubmit={(value) => {
            setDetails(value);
            setStep(4);
          }}
        />
      )}
      {step === 4 && <PhotosStep onSubmit={handlePhotosSubmit} />}
    </div>
  );
}
