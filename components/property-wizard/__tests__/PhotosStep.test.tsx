import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotosStep } from "../PhotosStep";

vi.mock("@/lib/api/procasa-client", () => ({
  uploadPhotos: vi.fn(),
}));

import { uploadPhotos } from "@/lib/api/procasa-client";

describe("PhotosStep", () => {
  it("uploads selected files and submits the real URLs returned by the server", async () => {
    (uploadPhotos as any).mockResolvedValue(["/uploads/property-leads/a.jpg"]);
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PhotosStep onSubmit={onSubmit} />);

    const file = new File(["fake"], "a.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Фотографии"), file);

    await waitFor(() => {
      expect(uploadPhotos).toHaveBeenCalledWith([file]);
    });

    await screen.findByText(/загружено фото: 1/i);

    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /отправить/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      contactName: "Аружан",
      contactPhone: "+77001234567",
      photoUrls: ["/uploads/property-leads/a.jpg"],
    });
  });

  it("shows an error and submits an empty photoUrls list when the upload fails", async () => {
    (uploadPhotos as any).mockResolvedValue([]);
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PhotosStep onSubmit={onSubmit} />);

    const file = new File(["fake"], "a.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Фотографии"), file);

    await screen.findByText(/не удалось загрузить фото/i);

    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /отправить/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      contactName: "Аружан",
      contactPhone: "+77001234567",
      photoUrls: [],
    });
  });
});
