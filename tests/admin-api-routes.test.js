import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/services/user-admin-service", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  UserAdminError: class UserAdminError extends Error {
    constructor(msg, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/services/dashboard-service", () => ({
  getDashboardStats: vi.fn(),
}));

vi.mock("@/lib/services/department-service", () => ({
  listDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  DepartmentError: class DepartmentError extends Error {
    constructor(msg, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/services/category-admin-service", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  CategoryAdminError: class CategoryAdminError extends Error {
    constructor(msg, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/services/tag-admin-service", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  TagAdminError: class TagAdminError extends Error {
    constructor(msg, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/services/sla-config-service", () => ({
  listSLAConfigs: vi.fn(),
  createSLAConfig: vi.fn(),
  updateSLAConfig: vi.fn(),
  SLAConfigError: class SLAConfigError extends Error {
    constructor(msg, status = 400) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  default: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { requireAdmin } from "@/lib/authz";
import { listUsers, createUser, UserAdminError } from "@/lib/services/user-admin-service";
import { getDashboardStats } from "@/lib/services/dashboard-service";
import { listDepartments } from "@/lib/services/department-service";
import { listCategories } from "@/lib/services/category-admin-service";
import { listTags } from "@/lib/services/tag-admin-service";
import { listSLAConfigs } from "@/lib/services/sla-config-service";

const mockAdmin = {
  id: "admin-1",
  username: "admin",
  role: "ADMIN",
  organizationId: "org-1",
};

function makeRequest(url = "http://localhost/api/admin/users", options = {}) {
  return new Request(url, options);
}

function makeParams(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

describe("Admin API routes - auth guard", () => {
  it("returns 403 for non-admin user on users endpoint", async () => {
    requireAdmin.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403 }),
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated users on dashboard endpoint", async () => {
    requireAdmin.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 }),
    });

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const res = await GET(makeRequest("http://localhost/api/admin/dashboard"));
    expect(res.status).toBe(401);
  });
});

describe("Admin API routes - users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns paginated users", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    listUsers.mockResolvedValue({
      users: [{ id: "u1", username: "test" }],
      total: 1,
      page: 1,
      limit: 15,
      totalPages: 1,
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.users).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("POST creates a new user", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    createUser.mockResolvedValue({ id: "new-user", username: "new" });

    const { POST } = await import("@/app/api/admin/users/route");
    const req = makeRequest("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "new", email: "n@e.com", password: "p", role: "USER" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe("Admin API routes - dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns dashboard stats", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    getDashboardStats.mockResolvedValue({
      tickets: { total: 10, open: 2 },
      sla: { breached: 0 },
      users: { total: 5 },
    });

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const res = await GET(makeRequest("http://localhost/api/admin/dashboard"));
    const data = await res.json();

    expect(data.stats.tickets.total).toBe(10);
  });
});

describe("Admin API routes - departments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns departments", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    listDepartments.mockResolvedValue({ departments: [], total: 0 });

    const { GET } = await import("@/app/api/admin/departments/route");
    const res = await GET(makeRequest("http://localhost/api/admin/departments"));
    const data = await res.json();

    expect(data.departments).toHaveLength(0);
  });
});

describe("Admin API routes - categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns categories", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    listCategories.mockResolvedValue({ categories: [], total: 0 });

    const { GET } = await import("@/app/api/admin/categories/route");
    const res = await GET(makeRequest("http://localhost/api/admin/categories"));
    const data = await res.json();

    expect(data.categories).toHaveLength(0);
  });
});

describe("Admin API routes - tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns tags", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    listTags.mockResolvedValue({ tags: [], total: 0 });

    const { GET } = await import("@/app/api/admin/tags/route");
    const res = await GET(makeRequest("http://localhost/api/admin/tags"));
    const data = await res.json();

    expect(data.tags).toHaveLength(0);
  });
});

describe("Admin API routes - SLA configs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns SLA configs", async () => {
    requireAdmin.mockResolvedValue({ user: mockAdmin });
    listSLAConfigs.mockResolvedValue({ configs: [] });

    const { GET } = await import("@/app/api/admin/sla-configs/route");
    const res = await GET(makeRequest("http://localhost/api/admin/sla-configs"));
    const data = await res.json();

    expect(data.configs).toHaveLength(0);
  });
});
