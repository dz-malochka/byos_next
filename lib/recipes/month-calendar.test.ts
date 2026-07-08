/// <reference types="jest" />
import { buildCalendar } from "@/lib/recipes/month-calendar";

// A fixed reference date: Tuesday, 7 July 2026.
const NOW = new Date(2026, 6, 7, 12, 0, 0);

describe("buildCalendar", () => {
	it("lays out the current month with the correct first-weekday offset", () => {
		const cal = buildCalendar("current", "sunday", NOW);
		expect(cal.title).toBe("July 2026");
		// 1 July 2026 is a Wednesday -> three leading null pads (Sun,Mon,Tue).
		expect(cal.weeks[0].slice(0, 4)).toEqual([null, null, null, 1]);
		// July has 31 days; the flattened non-null cells should be 1..31.
		const days = cal.weeks.flat().filter((d) => d !== null);
		expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
		// Every row has exactly 7 cells.
		for (const week of cal.weeks) expect(week).toHaveLength(7);
	});

	it("highlights today only for the current month", () => {
		expect(buildCalendar("current", "sunday", NOW).today).toBe(7);
		expect(buildCalendar("previous", "sunday", NOW).today).toBeNull();
		expect(buildCalendar("next", "sunday", NOW).today).toBeNull();
	});

	it("resolves previous and next months, rolling over year boundaries", () => {
		expect(buildCalendar("previous", "sunday", NOW).title).toBe("June 2026");
		expect(buildCalendar("next", "sunday", NOW).title).toBe("August 2026");
		// December -> next is January of the following year.
		const dec = new Date(2026, 11, 15, 12, 0, 0);
		expect(buildCalendar("next", "sunday", dec).title).toBe("January 2027");
		// January -> previous is December of the prior year.
		const jan = new Date(2026, 0, 15, 12, 0, 0);
		expect(buildCalendar("previous", "sunday", jan).title).toBe(
			"December 2025",
		);
	});

	describe("first day of the week", () => {
		it("defaults to a Sunday-first layout", () => {
			const cal = buildCalendar("current", "sunday", NOW);
			expect(cal.weekdays).toEqual([
				"Sun",
				"Mon",
				"Tue",
				"Wed",
				"Thu",
				"Fri",
				"Sat",
			]);
			// 1 July 2026 (Wed) sits in column index 3 under a Sunday-first week.
			expect(cal.weeks[0].indexOf(1)).toBe(3);
		});

		it("shifts labels and day offsets when the week starts on Monday", () => {
			const cal = buildCalendar("current", "monday", NOW);
			expect(cal.weekdays).toEqual([
				"Mon",
				"Tue",
				"Wed",
				"Thu",
				"Fri",
				"Sat",
				"Sun",
			]);
			// Under a Monday-first week, Wed is column index 2 (Mon,Tue,Wed).
			expect(cal.weeks[0].indexOf(1)).toBe(2);
			// The day set is unchanged; only the padding/order differs.
			const days = cal.weeks.flat().filter((d) => d !== null);
			expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
			for (const week of cal.weeks) expect(week).toHaveLength(7);
		});

		it("puts a Sunday-starting month in column 0 (Sun) or 6 (Mon-first)", () => {
			// 1 Feb 2026 is a Sunday.
			const feb = new Date(2026, 1, 15, 12, 0, 0);
			expect(buildCalendar("current", "sunday", feb).weeks[0].indexOf(1)).toBe(
				0,
			);
			expect(buildCalendar("current", "monday", feb).weeks[0].indexOf(1)).toBe(
				6,
			);
		});
	});
});
