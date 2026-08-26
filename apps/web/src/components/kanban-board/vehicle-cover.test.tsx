import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANOTA_VEHICLE_BOARD_SLUG, VehicleCover } from "./vehicle-cover";

const useAnotaCoverCandidates = vi.fn();
const setCoverMutateAsync = vi.fn();
const canUpdateTasks = vi.fn(() => true);

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canUpdateTasks() }),
}));

vi.mock("@/hooks/queries/task/use-anota-cover-candidates", () => ({
  useAnotaCoverCandidates: (taskId: string, enabled: boolean) =>
    useAnotaCoverCandidates(taskId, enabled),
}));

vi.mock("@/hooks/mutations/task/use-set-anota-cover", () => ({
  useSetAnotaCover: () => ({
    mutateAsync: setCoverMutateAsync,
    isPending: false,
  }),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  canUpdateTasks.mockReturnValue(true);
  useAnotaCoverCandidates.mockReset();
  setCoverMutateAsync.mockReset();
});

describe("VehicleCover", () => {
  it("renders an img whose src ends with /api/asset/<id> when a coverAssetId is given", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    useAnotaCoverCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId="asset-123"
      />,
    );

    const img = screen.getByRole("img", { name: "Vehicle" });
    expect(img.getAttribute("src")).toBe(
      "https://api.example.com/api/asset/asset-123",
    );
  });

  it("renders no img and shows NO PHOTO when coverAssetId is null", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    useAnotaCoverCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId={null}
      />,
    );

    expect(screen.queryByRole("img", { name: "Vehicle" })).toBeNull();
    expect(screen.getByText("NO PHOTO")).toBeInTheDocument();
  });

  it("renders the placeholder when coverAssetId is undefined", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    useAnotaCoverCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId={undefined}
      />,
    );

    expect(screen.queryByRole("img", { name: "Vehicle" })).toBeNull();
    expect(screen.getByText("NO PHOTO")).toBeInTheDocument();
  });

  it("exposes ANOTA_VEHICLE_BOARD_SLUG as the vehicles board slug", () => {
    expect(ANOTA_VEHICLE_BOARD_SLUG).toBe("vehicles-ro");
  });

  it("does not render the set-as-cover affordance without update permission", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    canUpdateTasks.mockReturnValue(false);
    useAnotaCoverCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId={null}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Choose vehicle photo" }),
    ).toBeNull();
  });

  it("calls setAnotaCover with the chosen asset id when a candidate is picked", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    useAnotaCoverCandidates.mockReturnValue({
      data: {
        coverAssetId: "asset-1",
        images: [
          { id: "asset-1", createdAt: "2026-01-01T00:00:00Z" },
          { id: "asset-2", createdAt: "2026-01-02T00:00:00Z" },
        ],
      },
      isLoading: false,
    });
    setCoverMutateAsync.mockResolvedValue({});

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId="asset-1"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Choose vehicle photo" }),
    );

    const candidates = await screen.findAllByRole("button", {
      name: "",
    });
    const secondCandidate = candidates.find((button) =>
      button.querySelector('img[src$="asset-2"]'),
    );
    expect(secondCandidate).toBeDefined();

    fireEvent.click(secondCandidate as HTMLElement);

    expect(setCoverMutateAsync).toHaveBeenCalledWith({
      taskId: "task-1",
      projectId: "project-1",
      assetId: "asset-2",
    });
  });

  it("calls setAnotaCover with a null asset id when clearing the override", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    useAnotaCoverCandidates.mockReturnValue({
      data: {
        coverAssetId: "asset-1",
        images: [{ id: "asset-1", createdAt: "2026-01-01T00:00:00Z" }],
      },
      isLoading: false,
    });
    setCoverMutateAsync.mockResolvedValue({});

    render(
      <VehicleCover
        taskId="task-1"
        projectId="project-1"
        coverAssetId="asset-1"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Choose vehicle photo" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Use earliest photo" }),
    );

    expect(setCoverMutateAsync).toHaveBeenCalledWith({
      taskId: "task-1",
      projectId: "project-1",
      assetId: null,
    });
  });
});
