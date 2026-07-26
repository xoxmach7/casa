import type { AddressMatchResult, BuildingClass } from "./types";

interface ResidentialComplexSeed {
  name: string;
  district: string;
  buildingClass: BuildingClass;
  aliases: string[];
  pricePerM2ByRooms: Partial<Record<number, number>>;
}

export const RESIDENTIAL_COMPLEXES: ResidentialComplexSeed[] = [
  {
    name: "Prime Garden",
    district: "Есиль",
    buildingClass: "comfort_plus",
    aliases: ["Жошы хана 27", "Жошы хана, 27"],
    pricePerM2ByRooms: { 1: 820000, 2: 856957, 3: 885994 },
  },
  {
    name: "Хайвил Астана блок А",
    district: "Сарайшык",
    buildingClass: "comfort",
    aliases: ["Ташенова 8", "Ташенова, 8"],
    pricePerM2ByRooms: {},
  },
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
}

export function matchAddress(input: string): AddressMatchResult {
  const normalized = normalize(input);
  const complex = RESIDENTIAL_COMPLEXES.find((candidate) =>
    candidate.aliases.some((alias) => normalize(alias) === normalized)
  );

  if (!complex) {
    return { status: "not_found" };
  }

  return {
    status: "matched",
    residentialComplex: complex.name,
    district: complex.district,
    address: input.trim(),
    buildingClass: complex.buildingClass,
  };
}
