/// <reference types="jest" />
import {
	buildBitmapPreviewSrc,
	buildScreenPreviewSrc,
} from "@/lib/render/preview-image";

describe("mixup preview device profile", () => {
	it("buildScreenPreviewSrc embeds the device model + palette in the URL", () => {
		const src = buildScreenPreviewSrc(
			"month-of-year",
			{ model: "og_png", palette_id: "gray-4" },
			400,
			240,
		);
		const query = new URLSearchParams(src.split("?")[1]);
		expect(src.startsWith("/api/bitmap/month-of-year.png")).toBe(true);
		expect(query.get("model")).toBe("og_png");
		expect(query.get("palette_id")).toBe("gray-4");
		expect(query.get("width")).toBe("400");
		expect(query.get("height")).toBe("240");
	});

	it("falls back to the default model when a device has none", () => {
		const src = buildScreenPreviewSrc(
			"rss-feed",
			{ model: null, palette_id: null },
			800,
			480,
		);
		const query = new URLSearchParams(src.split("?")[1]);
		expect(query.get("model")).toBeTruthy(); // default model applied
		expect(query.get("palette_id")).toBeNull(); // no palette when unset
	});

	it("buildBitmapPreviewSrc (no device) omits model/palette", () => {
		const src = buildBitmapPreviewSrc("rss-feed", { width: 400, height: 240 });
		const query = new URLSearchParams(src.split("?")[1]);
		expect(query.get("model")).toBeNull();
		expect(query.get("palette_id")).toBeNull();
		expect(query.get("width")).toBe("400");
	});
});
