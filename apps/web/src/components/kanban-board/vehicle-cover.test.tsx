import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANOTA_VEHICLE_BOARD_SLUG, VehicleCover } from "./vehicle-cover";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("VehicleCover", () => {
  it("renders an img whose src ends with /api/asset/<id> when a coverAssetId is given", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    render(<VehicleCover coverAssetId="asset-123" />);

    const img = screen.getByRole("img", { name: "Vehicle" });
    expect(img.getAttribute("src")).toBe(
      "https://api.example.com/api/asset/asset-123",
    );
  });

  it("renders no img and shows NO PHOTO when coverAssetId is null", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    render(<VehicleCover coverAssetId={null} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("NO PHOTO")).toBeInTheDocument();
  });

  it("renders the placeholder when coverAssetId is undefined", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    render(<VehicleCover coverAssetId={undefined} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("NO PHOTO")).toBeInTheDocument();
  });

  it("exposes ANOTA_VEHICLE_BOARD_SLUG as the vehicles board slug", () => {
    expect(ANOTA_VEHICLE_BOARD_SLUG).toBe("vehicles-ro");
  });
});
