// anota-phone-cell.test.tsx
//
// Phase 10, ONBOARD-10, plan 10-01 Task 2. Fixture phone numbers use the
// reserved NPA-555 fictional block (954-555-01xx) per the plan's hard
// no-real-phone-numbers rule — never a live number.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnotaPhoneCell, AnotaPhoneProvider } from "./anota-phone-cell";

const getBearerToken = vi.fn(async () => "fake-bearer-token");

vi.mock("./use-anota-session", () => ({
  useAnotaSession: () => ({
    getBearerToken: () => getBearerToken(),
    resolveSession: vi.fn(),
  }),
}));

const success = vi.fn();
const error = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => success(msg),
    error: (msg: string) => error(msg),
  },
}));

// Identity `t` returning the `defaultValue`, with basic `{{name}}`-style
// interpolation — matches this fork's real i18next behaviour closely
// enough for these tests without loading the real i18n bundle.
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let str =
        typeof opts?.defaultValue === "string" ? opts.defaultValue : key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          if (k === "defaultValue") continue;
          str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
        }
      }
      return str;
    },
  }),
}));

interface MockMember {
  kaneoUserId: string;
  phone: string | null;
}

function mockMembersResponse(
  viewer: { kaneoUserId: string; canEdit: boolean },
  members: MockMember[],
) {
  return {
    viewer: { ...viewer, workspaceRole: viewer.canEdit ? "admin" : "member" },
    members,
  };
}

function installFetchMock(opts: { getBody: unknown; putStatus?: number }) {
  const putCalls: Array<{ url: string; body: unknown }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      putCalls.push({ url, body });
      const status = opts.putStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({}),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => opts.getBody,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, putCalls };
}

beforeEach(() => {
  vi.stubEnv("VITE_ANOTA_PANEL_URL", "https://panel.example.test");
  getBearerToken.mockClear();
  getBearerToken.mockResolvedValue("fake-bearer-token");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AnotaPhoneCell", () => {
  it("shows every member's masked number to an admin viewer who can edit", async () => {
    installFetchMock({
      getBody: mockMembersResponse({ kaneoUserId: "admin-1", canEdit: true }, [
        { kaneoUserId: "admin-1", phone: "+19545550100" },
        { kaneoUserId: "tech-1", phone: "+19545550199" },
      ]),
    });

    render(
      <AnotaPhoneProvider>
        <AnotaPhoneCell userId="admin-1" isSelf canEdit name="Mario Owner" />
        <AnotaPhoneCell
          userId="tech-1"
          isSelf={false}
          canEdit
          name="Test Tech"
        />
      </AnotaPhoneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("•••• 0100")).toBeInTheDocument();
      expect(screen.getByText("•••• 0199")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Edit phone number for Mario Owner" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit phone number for Test Tech" }),
    ).toBeInTheDocument();
  });

  it("shows only the caller's own masked number, read-only, to a non-admin viewer", async () => {
    // The read route (10-03) returns only the caller's own row for a
    // non-admin viewer — "tech-2" simply never appears in `members`.
    installFetchMock({
      getBody: mockMembersResponse({ kaneoUserId: "tech-1", canEdit: false }, [
        { kaneoUserId: "tech-1", phone: "+19545550100" },
      ]),
    });

    render(
      <AnotaPhoneProvider>
        <AnotaPhoneCell
          userId="tech-1"
          isSelf
          canEdit={false}
          name="Self Tech"
        />
        <AnotaPhoneCell
          userId="tech-2"
          isSelf={false}
          canEdit={false}
          name="Other Tech"
        />
      </AnotaPhoneProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("•••• 0100")).toBeInTheDocument();
    });
    // Read-only: no edit affordance for the caller's own row either.
    expect(
      screen.queryByRole("button", { name: /Edit phone number/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Add number/)).not.toBeInTheDocument();
  });

  it("issues exactly one PUT with the E.164-normalized number and the row's userId when saving", async () => {
    const { fetchMock, putCalls } = installFetchMock({
      getBody: mockMembersResponse({ kaneoUserId: "admin-1", canEdit: true }, [
        { kaneoUserId: "tech-1", phone: null },
      ]),
    });

    render(
      <AnotaPhoneProvider>
        <AnotaPhoneCell
          userId="tech-1"
          isSelf={false}
          canEdit
          name="Test Tech"
        />
      </AnotaPhoneProvider>,
    );

    const addButton = await screen.findByText("Add number");
    fireEvent.click(addButton);

    // Type the placeholder's own suggested (spaced) format — the save
    // must still normalize to a clean, unspaced E.164 value on the wire.
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "+1 954 555 0199" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Signed SMS consent form on file" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save number" }));

    await waitFor(() => {
      expect(putCalls).toHaveLength(1);
    });
    expect(putCalls[0]).toEqual({
      url: "https://panel.example.test/members/phone",
      body: { kaneoUserId: "tech-1", phone: "+19545550199" },
    });
    const putInvocations = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(putInvocations).toHaveLength(1);
  });

  it("shows the claimed-number copy on a 409 and keeps the dialog open", async () => {
    installFetchMock({
      getBody: mockMembersResponse({ kaneoUserId: "admin-1", canEdit: true }, [
        { kaneoUserId: "tech-1", phone: null },
      ]),
      putStatus: 409,
    });

    render(
      <AnotaPhoneProvider>
        <AnotaPhoneCell
          userId="tech-1"
          isSelf={false}
          canEdit
          name="Test Tech"
        />
      </AnotaPhoneProvider>,
    );

    const addButton = await screen.findByText("Add number");
    fireEvent.click(addButton);
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "+19545550199" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Signed SMS consent form on file" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save number" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "That number is already assigned to another team member. Confirm the number and try again.",
        ),
      ).toBeInTheDocument();
    });
    // Dialog stayed open — the field is still present.
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
  });

  it("keeps Save disabled until the consent checkbox is checked", async () => {
    installFetchMock({
      getBody: mockMembersResponse({ kaneoUserId: "admin-1", canEdit: true }, [
        { kaneoUserId: "tech-1", phone: null },
      ]),
    });

    render(
      <AnotaPhoneProvider>
        <AnotaPhoneCell
          userId="tech-1"
          isSelf={false}
          canEdit
          name="Test Tech"
        />
      </AnotaPhoneProvider>,
    );

    const addButton = await screen.findByText("Add number");
    fireEvent.click(addButton);
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "+19545550199" },
    });

    const saveButton = screen.getByRole("button", { name: "Save number" });
    expect(saveButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Signed SMS consent form on file" }),
    );
    expect(saveButton).not.toBeDisabled();
  });
});
