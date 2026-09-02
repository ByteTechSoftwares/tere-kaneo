import { describe, expect, it } from "vitest";
import { initialsOf, resolveInviterImage } from "./anota-workspace-invitation";

// The inviter picture is the one attacker-influenced value that reaches an
// <img src>: `user.image` is writable by any signed-in user. These tests pin
// the scheme gate so an upstream merge that reshuffles the file cannot loosen
// it silently.
describe("resolveInviterImage", () => {
  const origin = "https://anota.example";

  it("passes absolute http(s) URLs through untouched", () => {
    expect(resolveInviterImage("https://cdn.example/a.png", origin)).toBe(
      "https://cdn.example/a.png",
    );
    expect(resolveInviterImage("http://cdn.example/a.png", "")).toBe(
      "http://cdn.example/a.png",
    );
  });

  it("resolves Anota's own avatar path against the instance origin", () => {
    expect(resolveInviterImage("/api/user/avatar/abc", origin)).toBe(
      "https://anota.example/api/user/avatar/abc",
    );
  });

  it("yields null for a root-relative path with no origin to resolve against", () => {
    expect(resolveInviterImage("/api/user/avatar/abc", "")).toBeNull();
  });

  it("never lets a non-http scheme or an unusable value reach the img src", () => {
    const rejected = [
      "javascript:alert(1)",
      " javascript:alert(1)",
      "data:image/png;base64,AA==",
      "vbscript:msgbox",
      "avatar.png",
      "",
      null,
      undefined,
    ];
    for (const value of rejected) {
      expect(resolveInviterImage(value, origin)).toBeNull();
    }
  });

  it("keeps a protocol-relative value on the instance host", () => {
    const resolved = resolveInviterImage("//evil.example/x.png", origin);
    expect(resolved).not.toBeNull();
    expect(new URL(resolved as string).host).toBe("anota.example");
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Mario Silva", "mario@example.com")).toBe("MS");
  });

  it("uses one letter for a single-word name", () => {
    expect(initialsOf("Kim", "kim@example.com")).toBe("K");
  });

  it("falls back to the email's first letter when the name is blank", () => {
    expect(initialsOf("   ", "mario@example.com")).toBe("M");
  });

  it("keeps a non-BMP first character whole", () => {
    expect(initialsOf("😀 Tech", "tech@example.com")).toBe("😀T");
  });
});
