import { API_URL } from "@/lib/api-client";

export type MortgageCalculationInput = {
  propertyPrice: number;
  downPayment: number;
  termMonths: number;
  rate: number;
  existingDebtPayment: number;
  additionalConfirmedIncome: number;
  baseIncome: number;
};

export type MortgageCalculation = {
  loanAmount: number;
  monthlyPayment: number;
  kdn: number;
  acceptedIncome: number;
  eligibleProgramsCount: number;
};

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось выполнить операцию");
  return body as T;
}

export async function calculateMortgage(input: MortgageCalculationInput): Promise<MortgageCalculation> {
  const response = await fetch(`${API_URL}/mortgage-workspace/whatif`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parse<MortgageCalculation>(response);
}

export async function uploadMortgageDocument(file: File, type: "credit_history" | "enpf_statement") {
  const form = new FormData();
  form.set("file", file);
  form.set("type", type);
  const response = await fetch(`${API_URL}/mortgage-workspace/documents`, { method: "POST", credentials: "include", body: form });
  return parse<{ id: string; fileName: string; status: string }>(response);
}
