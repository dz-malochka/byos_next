/// <reference types="jest" />
import { classifyResult, normalizeUrl } from "@/lib/recipes/availability";

describe("normalizeUrl", () => {
	it("keeps an explicit http(s) URL", () => {
		expect(normalizeUrl("https://example.com")).toBe("https://example.com");
		expect(normalizeUrl("http://example.com")).toBe("http://example.com");
	});

	it("prefixes a bare host with https", () => {
		expect(normalizeUrl("example.com")).toBe("https://example.com");
	});

	it("trims whitespace and rejects empty input", () => {
		expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
		expect(normalizeUrl("")).toBeNull();
		expect(normalizeUrl("   ")).toBeNull();
	});
});

describe("classifyResult", () => {
	it("treats a 2xx response as up/online", () => {
		expect(
			classifyResult({ statusCode: 200, ok: true, latencyMs: 42 }),
		).toEqual({ status: "up", detail: "Online" });
	});

	it("treats 4xx/5xx as still reachable (up)", () => {
		expect(
			classifyResult({ statusCode: 404, ok: false, latencyMs: 10 }).status,
		).toBe("up");
		expect(
			classifyResult({ statusCode: 503, ok: false, latencyMs: 10 }).status,
		).toBe("up");
		expect(
			classifyResult({ statusCode: 503, ok: false, latencyMs: 10 }).detail,
		).toContain("503");
	});

	it("treats a network failure (no status) as down", () => {
		const result = classifyResult({
			statusCode: null,
			ok: false,
			latencyMs: null,
			error: "getaddrinfo ENOTFOUND",
		});
		expect(result.status).toBe("down");
		expect(result.detail).toBe("getaddrinfo ENOTFOUND");
	});
});
