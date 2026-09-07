import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const mockDepartments = [
  { id: "dept-1", name: "Engineering" },
  { id: "dept-2", name: "HR" },
];

const mockCategories = [
  { id: "cat-1", name: "Software" },
  { id: "cat-2", name: "Hardware" },
  { id: "cat-3", name: "Access" },
];

function mockFetch(url) {
  if (url === "/api/departments") {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: mockDepartments }) });
  }
  if (url === "/api/categories") {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: mockCategories }) });
  }
  if (url === "/api/tags") {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

import TicketForm from "@/components/tickets/ticket-form";

function getSelects() {
  const selects = screen.getAllByRole("combobox");
  return { department: selects[2], category: selects[3] };
}

describe("TicketForm - category and department independence", () => {
  it("renders all categories before any department is selected", async () => {
    render(<TicketForm />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Software" })).toBeInTheDocument();
    });

    const { category } = getSelects();
    const options = within(category).getAllByRole("option");
    // "Select category" + 3 categories
    expect(options).toHaveLength(4);
  });

  it("does not empty category options when a department is selected", async () => {
    render(<TicketForm />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Engineering" })).toBeInTheDocument();
    });

    const { department, category } = getSelects();
    fireEvent.change(department, { target: { value: "dept-1" } });

    const options = within(category).getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(screen.getByRole("option", { name: "Software" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Access" })).toBeInTheDocument();
  });

  it("keeps category selected after department changes", async () => {
    render(<TicketForm />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Software" })).toBeInTheDocument();
    });

    const { department, category } = getSelects();
    fireEvent.change(category, { target: { value: "cat-2" } });
    fireEvent.change(department, { target: { value: "dept-1" } });

    expect(category).toHaveValue("cat-2");
  });

  it("keeps all categories available when switching departments", async () => {
    render(<TicketForm />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Engineering" })).toBeInTheDocument();
    });

    const { department, category } = getSelects();
    fireEvent.change(department, { target: { value: "dept-1" } });

    expect(within(category).getAllByRole("option")).toHaveLength(4);

    fireEvent.change(department, { target: { value: "dept-2" } });

    const options = within(category).getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(screen.getByRole("option", { name: "Software" })).toBeInTheDocument();
  });
});
