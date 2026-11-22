import { describe, expect, it } from "vitest";
import { isAllowedLoginEmail, safeReaderReturn } from "@/lib/login";

describe("reader email rule: only Gmail or Outlook", () => {
  it("accepts Gmail addresses", () => {
    expect(isAllowedLoginEmail("Reader.Name@Gmail.com")).toBe(true);
    expect(isAllowedLoginEmail("reader@googlemail.com")).toBe(true);
  });
  it("accepts Outlook, Hotmail and Live addresses", () => {
    expect(isAllowedLoginEmail("reader@outlook.com")).toBe(true);
    expect(isAllowedLoginEmail("reader@hotmail.co.uk")).toBe(true);
    expect(isAllowedLoginEmail("reader@live.com")).toBe(true);
  });
  it("rejects every other email provider", () => {
    expect(isAllowedLoginEmail("reader@yahoo.com")).toBe(false);
    expect(isAllowedLoginEmail("reader@example.com")).toBe(false);
    expect(isAllowedLoginEmail("reader@gmail.com.evil.io")).toBe(false);
    expect(isAllowedLoginEmail("not-an-email")).toBe(false);
  });
});

describe("after reader sign-in", () => {
  it("returns to the page the reader came from, never another site", () => {
    expect(safeReaderReturn("/novels/man-yaram", "https://site.test")).toBe("/novels/man-yaram");
    expect(safeReaderReturn("https://evil.test/x", "https://site.test")).toBe("/");
    expect(safeReaderReturn("//evil.test", "https://site.test")).toBe("/");
    expect(safeReaderReturn("/login", "https://site.test")).toBe("/");
  });
});
