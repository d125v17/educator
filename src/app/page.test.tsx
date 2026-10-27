import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/image relies on the Next.js runtime; render a plain <img> in tests.
vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
    />
  ),
}));

import Home from "./page";

describe("Home page", () => {
  it("renders the getting-started heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /to get started/i }),
    ).toBeInTheDocument();
  });
});
