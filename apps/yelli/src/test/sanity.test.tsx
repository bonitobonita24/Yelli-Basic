/**
 * Sanity test — proves vitest + RTL + jest-dom infra works.
 * No tRPC, no next-auth, no external deps.
 * Retroactive tests for RegisterDeviceButton / DeviceList / CallingModal
 * are separate Feature Updates unblocked by this infra.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test infrastructure sanity", () => {
  it("renders a button and finds it via RTL + jest-dom", () => {
    render(<button type="button">Register Device</button>);
    const btn = screen.getByRole("button", { name: /register device/i });
    expect(btn).toBeInTheDocument();
  });

  it("RTL queries are case-insensitive via regex", () => {
    render(<span>Device List</span>);
    expect(screen.getByText(/device list/i)).toBeInTheDocument();
  });

  it("jest-dom toHaveTextContent works", () => {
    render(<p>Hello Yelli</p>);
    expect(screen.getByText(/hello yelli/i)).toHaveTextContent("Hello Yelli");
  });
});
