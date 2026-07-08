/// <reference types="jest" />
import { readBaseSlug } from "@/lib/recipes/recipe-metadata";

describe("readBaseSlug", () => {
	it("reads a non-empty baseSlug from metadata", () => {
		expect(readBaseSlug({ baseSlug: "rss-feed", origin: "duplicate" })).toBe(
			"rss-feed",
		);
	});

	it("returns null when baseSlug is missing, empty, or non-string", () => {
		expect(readBaseSlug({ origin: "duplicate" })).toBeNull();
		expect(readBaseSlug({ baseSlug: "" })).toBeNull();
		expect(readBaseSlug({ baseSlug: 42 })).toBeNull();
	});

	it("returns null for non-object metadata", () => {
		expect(readBaseSlug(null)).toBeNull();
		expect(readBaseSlug(undefined)).toBeNull();
		expect(readBaseSlug("rss-feed")).toBeNull();
		expect(readBaseSlug(["rss-feed"])).toBeNull();
	});
});
