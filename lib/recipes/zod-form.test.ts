/// <reference types="jest" />
import { z } from "zod";
import { zodObjectToParamDefinitions } from "@/lib/recipes/zod-form";

describe("zodObjectToParamDefinitions", () => {
	it("detects string, number and boolean fields", () => {
		const defs = zodObjectToParamDefinitions(
			z.object({
				name: z.string().default("x"),
				count: z.number().default(3),
				enabled: z.boolean().default(false),
			}),
		);
		expect(defs.name.type).toBe("string");
		expect(defs.count.type).toBe("number");
		expect(defs.enabled.type).toBe("boolean");
	});

	it("detects an enum field and exposes its options as select choices", () => {
		const defs = zodObjectToParamDefinitions(
			z.object({
				month: z
					.enum(["current", "previous", "next"])
					.default("current")
					.meta({ title: "Month" }),
			}),
		);
		expect(defs.month.type).toBe("enum");
		expect(defs.month.label).toBe("Month");
		expect(defs.month.default).toBe("current");
		expect(defs.month.options).toEqual([
			{ value: "current", label: "Current" },
			{ value: "previous", label: "Previous" },
			{ value: "next", label: "Next" },
		]);
	});
});
