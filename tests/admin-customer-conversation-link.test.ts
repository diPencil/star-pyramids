import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin customer conversation links", () => {
  it("opens the selected conversation in the inbox", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/admin/customers/[key]/content.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'href={`/admin/inbox?conversation=${encodeURIComponent(thread.reference)}`}',
    );
    expect(source).not.toContain(
      'className="sp-btn" href="/admin/inbox"><AdminText en="Open"',
    );
  });
});
