import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "@/components/ui/button";
import Card, { CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Avatar from "@/components/ui/avatar";

describe("UI components", () => {
  describe("Button", () => {
    it("renders with default variant", () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole("button", { name: "Click me" });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it("renders as disabled when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("Card", () => {
    it("renders children", () => {
      render(
        <Card>
          <CardContent>Card content</CardContent>
        </Card>
      );
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("renders header and footer", () => {
      render(
        <Card>
          <CardHeader>Header</CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );
      expect(screen.getByText("Header")).toBeInTheDocument();
      expect(screen.getByText("Body")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });
  });

  describe("Badge", () => {
    it("renders with default variant", () => {
      render(<Badge>New</Badge>);
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("renders with primary variant", () => {
      render(<Badge variant="primary">Active</Badge>);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  describe("Avatar", () => {
    it("renders initials from name", () => {
      render(<Avatar name="John Doe" />);
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("renders image when src is provided", () => {
      render(<Avatar src="/avatar.jpg" name="John Doe" />);
      const img = screen.getByRole("img", { name: "John Doe" });
      expect(img).toHaveAttribute("src", "/avatar.jpg");
    });

    it("renders fallback for empty name", () => {
      render(<Avatar name="" />);
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});
