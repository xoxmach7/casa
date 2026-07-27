import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyCard } from "../PropertyCard";

const SAMPLE = {
  id: "p1",
  district: "Бостандыкский",
  residentialComplex: "Comfort City",
  address: "ул. Розыбакиева 100",
  lat: 43.2,
  lng: 76.89,
  rooms: 2,
  area: 60,
  price: 36_000_000,
  images: [],
};

describe("PropertyCard", () => {
  it("renders price, complex name, district, rooms and area", () => {
    render(<PropertyCard property={SAMPLE} />);
    expect(screen.getByText(/36 000 000/)).toBeInTheDocument();
    expect(screen.getByText("Comfort City")).toBeInTheDocument();
    expect(screen.getByText(/Бостандыкский/)).toBeInTheDocument();
    expect(screen.getByText(/2 комн/)).toBeInTheDocument();
    expect(screen.getByText(/60 м/)).toBeInTheDocument();
  });

  it("links to the property detail page", () => {
    render(<PropertyCard property={SAMPLE} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalog/p1");
  });
});
