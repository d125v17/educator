import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../../pages/home";

describe("Home page", () => {
  it("renders the hello world heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /hello world/i }),
    ).toBeInTheDocument();
  });
});
