import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/tickets",
}));

vi.mock("next/link", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ href, children, ...props }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/components/tickets/status-badge", () => ({
  StatusBadge: ({ status }) => <span data-testid="status-badge">{status}</span>,
  PriorityBadge: ({ priority }) => <span data-testid="priority-badge">{priority}</span>,
}));

const mockDepts = [
  { id: "dept-1", name: "Engineering" },
  { id: "dept-2", name: "HR" },
];

const mockCats = [
  { id: "cat-1", name: "Software" },
  { id: "cat-2", name: "Hardware" },
  { id: "cat-3", name: "Access" },
];

const mockTickets = [
  {
    id: "t1", ticketNumber: "NIR-2026-000001", title: "VPN issue",
    status: "OPEN", priority: "HIGH", type: "INCIDENT",
    department: { id: "dept-1", name: "Engineering", code: "ENG" },
    category: { id: "cat-1", name: "Software" },
    requester: { id: "u1", username: "alice" },
    assignedAgent: null, createdAt: "2026-01-15T10:00:00Z",
    _count: { comments: 2, watchers: 1 },
  },
  {
    id: "t2", ticketNumber: "NIR-2026-000002", title: "Password reset",
    status: "ASSIGNED", priority: "MEDIUM", type: "SERVICE_REQUEST",
    department: { id: "dept-2", name: "HR", code: "HR" },
    category: { id: "cat-3", name: "Access" },
    requester: { id: "u2", username: "bob" },
    assignedAgent: { id: "a1", username: "charlie" },
    createdAt: "2026-01-16T11:00:00Z",
    _count: { comments: 0, watchers: 0 },
  },
];

let fetchSpy;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 300_000 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  mockPush.mockClear();
  mockBack.mockClear();
  mockRefresh.mockClear();
});

afterEach(() => { vi.restoreAllMocks(); });

function mockDropdowns() {
  fetchSpy.mockImplementation((url) => {
    if (url === "/api/departments")
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepts }) });
    if (url === "/api/categories")
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCats }) });
    if (url === "/api/tags")
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function mockTicketsList(tickets = mockTickets, total = 2, totalPages = 1) {
  fetchSpy.mockImplementation((url) => {
    if (typeof url === "string" && url.startsWith("/api/tickets"))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ tickets, total, totalPages }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

import TicketForm from "@/components/tickets/ticket-form";
import TicketList from "@/components/tickets/ticket-list";

describe("Part 5: Ticket Creation Form", () => {
  beforeEach(() => { mockDropdowns(); });

  it("renders all form fields", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Department *")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("title has maxLength 200", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    expect(screen.getByLabelText("Title")).toHaveAttribute("maxLength", "200");
  });

  it("description has maxLength 10000", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    const ta = screen.getByPlaceholderText("Provide details about your request...");
    expect(ta).toHaveAttribute("maxLength", "10000");
  });

  it("shows error for missing required fields", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    expect(screen.getByText("Title, description, and department are required")).toBeInTheDocument();
  });

  it("POSTs to /api/tickets and navigates on success", async () => {
    fetchSpy.mockImplementation((url, opts) => {
      if (url === "/api/tickets" && opts?.method === "POST")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ticket: { id: "new-1" } }) });
      if (url === "/api/departments")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepts }) });
      if (url === "/api/categories")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCats }) });
      if (url === "/api/tags")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Provide details about your request..."), { target: { value: "Desc" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "dept-1" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create Ticket" })); });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/tickets/new-1"));
  });

  it("shows loading state during submission", async () => {
    fetchSpy.mockImplementation((url, opts) => {
      if (url === "/api/tickets" && opts?.method === "POST") return new Promise(() => {});
      if (url === "/api/departments")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepts }) });
      if (url === "/api/categories")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCats }) });
      if (url === "/api/tags")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
    fireEvent.change(screen.getByPlaceholderText("Provide details about your request..."), { target: { value: "D" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "dept-1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    await waitFor(() => expect(screen.getByText("Creating...")).toBeInTheDocument());
  });

  it("displays server validation error", async () => {
    fetchSpy.mockImplementation((url, opts) => {
      if (url === "/api/tickets" && opts?.method === "POST")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Title too long" }) });
      if (url === "/api/departments")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepts }) });
      if (url === "/api/categories")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCats }) });
      if (url === "/api/tags")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
    fireEvent.change(screen.getByPlaceholderText("Provide details about your request..."), { target: { value: "D" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "dept-1" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create Ticket" })); });
    await waitFor(() => expect(screen.getByText("Title too long")).toBeInTheDocument());
  });

  it("displays network error", async () => {
    fetchSpy.mockImplementation((url, opts) => {
      if (url === "/api/tickets" && opts?.method === "POST") return Promise.reject(new Error("fail"));
      if (url === "/api/departments")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepts }) });
      if (url === "/api/categories")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCats }) });
      if (url === "/api/tags")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "T" } });
    fireEvent.change(screen.getByPlaceholderText("Provide details about your request..."), { target: { value: "D" } });
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "dept-1" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create Ticket" })); });
    await waitFor(() => expect(screen.getByText("fail")).toBeInTheDocument());
  });

  it("category independent of department", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    const catSelect = screen.getAllByRole("combobox")[3];
    expect(within(catSelect).getAllByRole("option")).toHaveLength(4);
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "dept-1" } });
    expect(within(catSelect).getAllByRole("option")).toHaveLength(4);
  });

  it("cancel calls router.back", async () => {
    renderWithProviders(<TicketForm />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe("Part 5: Ticket List - All Tickets", () => {
  beforeEach(() => { mockTicketsList(); });

  it("renders ticket data", async () => {
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    expect(screen.getByText("Password reset")).toBeInTheDocument();
  });

  it("displays ticket numbers", async () => {
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("NIR-2026-000001")).toBeInTheDocument());
    expect(screen.getByText("NIR-2026-000002")).toBeInTheDocument();
  });

  it("shows All Statuses as first status option", async () => {
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    const sel = screen.getAllByRole("combobox")[0];
    expect(within(sel).getAllByRole("option")[0].textContent).toBe("All Statuses");
  });

  it("does not pass scope param", async () => {
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).not.toContain("scope=");
  });

  it("shows loading state", async () => {
    fetchSpy.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<TicketList />);
    expect(screen.getByText("Loading tickets...")).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    fetchSpy.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("Failed to load tickets. Please try again.")).toBeInTheDocument());
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockTicketsList([], 0, 0);
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("No tickets found")).toBeInTheDocument());
  });

  it("pagination shows when totalPages > 1", async () => {
    mockTicketsList(mockTickets, 40, 2);
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("clicking Next increments page", async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === "string" && url.startsWith("/api/tickets")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tickets: mockTickets, total: 40, totalPages: 2 }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0];
      expect(lastCall).toContain("page=2");
    });
  });

  it("clicking Previous goes back to page 1", async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === "string" && url.startsWith("/api/tickets")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tickets: mockTickets, total: 40, totalPages: 2 }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0];
      expect(lastCall).toContain("page=2");
    });
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0];
      expect(lastCall).toContain("page=1");
    });
  });

  it("search input is present", async () => {
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Search tickets...")).toBeInTheDocument();
  });
});

describe("Part 5: Ticket List - My Active Tickets", () => {
  beforeEach(() => { mockTicketsList(); });

  it("shows All Active as first status option", async () => {
    renderWithProviders(<TicketList scope="my-active" />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    const sel = screen.getAllByRole("combobox")[0];
    expect(within(sel).getAllByRole("option")[0].textContent).toBe("All Active");
  });

  it("does not show Open/Resolved/Closed options", async () => {
    renderWithProviders(<TicketList scope="my-active" />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    const sel = screen.getAllByRole("combobox")[0];
    const labels = within(sel).getAllByRole("option").map(o => o.textContent);
    expect(labels).not.toContain("Open");
    expect(labels).not.toContain("Resolved");
    expect(labels).not.toContain("Closed");
    expect(labels).not.toContain("All Statuses");
  });

  it("passes scope=my-active in URL", async () => {
    renderWithProviders(<TicketList scope="my-active" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toContain("scope=my-active");
  });

  it("shows empty state for no active tickets", async () => {
    mockTicketsList([], 0, 0);
    renderWithProviders(<TicketList scope="my-active" />);
    await waitFor(() => expect(screen.getByText("No active tickets.")).toBeInTheDocument());
  });

  it("clicking status filter sends status param", async () => {
    renderWithProviders(<TicketList scope="my-active" />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "IN_PROGRESS" } });
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0];
      expect(lastCall).toContain("status=IN_PROGRESS");
    });
  });
});

describe("Part 5: Ticket List - Network Error", () => {
  it("shows network error message", async () => {
    fetchSpy.mockRejectedValue(new Error("fail"));
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("Network error. Please check your connection.")).toBeInTheDocument());
  });
});

describe("Part 5: Ticket List - Search", () => {
  it("search param is sent to API after debounce", async () => {
    mockTicketsList();
    renderWithProviders(<TicketList />);
    await waitFor(() => expect(screen.getByText("VPN issue")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Search tickets..."), { target: { value: "VPN" } });
    await waitFor(() => {
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0];
      expect(lastCall).toContain("search=VPN");
    });
  });
});

describe("Part 5: React Query Integration", () => {
  it("creates a new QueryClient per test", () => {
    const a = createQueryClient();
    const b = createQueryClient();
    expect(a).not.toBe(b);
  });

  it("QueryClientProvider wraps components", () => {
    const { container } = renderWithProviders(<div data-testid="child">test</div>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
