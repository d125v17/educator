import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import App from "../../pages/_app";

describe("Pages Router app", () => {
  it("renders the page component", () => {
    expect(typeof App).toBe("function");
  });

  it("imports the global Tailwind stylesheet", () => {
    const appSource = readFileSync(
      path.join(process.cwd(), "src/pages/_app.tsx"),
      "utf8",
    );

    expect(appSource).toContain('import "../app/globals.css";');
  });

  it("imports a stylesheet that loads Tailwind", () => {
    const stylesheet = readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(stylesheet).toContain('@import "tailwindcss";');
  });
});
