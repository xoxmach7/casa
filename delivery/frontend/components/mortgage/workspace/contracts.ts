/** Контракт действий рабочего экрана: оркестратор (page.tsx) реализует, секции вызывают. */

import type { WhatIfInputs, WorkspaceState } from "@/lib/mortgage/types";

export interface WorkspaceHandlers {
  // Секция 1 — клиент и согласие
  openClientPicker: () => void;
  openConsent: () => void;
  revokeConsent: () => void;

  // Секция 2 — документы и ИИН. fileName/fileSize — реального выбранного файла.
  uploadDocument: (doc: "creditHistory" | "enpf", fileName?: string, fileSize?: number) => void;
  confirmDocument: (doc: "creditHistory" | "enpf") => void;
  correctField: (doc: "creditHistory" | "enpf", key: string, value: string) => void;
  runIinCheck: () => void;

  // Секция 3 — анализ
  runAnalysis: () => void;
  confirmSnapshot: () => void;

  // Секция 4 — сценарии
  selectScenario: (id: string) => void;
  acceptCurrentCase: () => void;

  // Секция 5 — что если
  changeWhatIf: (patch: Partial<WhatIfInputs>) => void;
  saveWhatIfScenario: () => void;

  // Секция 6 — квартиры
  matchProperties: () => void;
  toggleSelection: (id: string) => void;

  // Секция 7 — заключение
  saveNextAction: (action: string, dueDate?: string) => void;
  generateLink: () => void;
  generatePdf: () => void;
}

export interface SectionProps {
  state: WorkspaceState;
  h: WorkspaceHandlers;
}
