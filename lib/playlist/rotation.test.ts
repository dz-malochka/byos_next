/// <reference types="jest" />
import { pickActivePlaylistItem } from "@/lib/playlist/rotation";

type Item = {
	screen_id: string;
	order_index: number;
	days_of_week: string[] | null;
	start_time: string | null;
	end_time: string | null;
};

const item = (
	screen_id: string,
	order_index: number,
	extra: Partial<Item> = {},
): Item => ({
	screen_id,
	order_index,
	days_of_week: null,
	start_time: null,
	end_time: null,
	...extra,
});

describe("pickActivePlaylistItem (mixup + device playlist rotation)", () => {
	const items = [item("a", 0), item("b", 1), item("c", 2)];

	it("advances to the next item on each refresh, wrapping around", () => {
		// Simulate successive refreshes: feed back the chosen item's order_index.
		const seen: string[] = [];
		let currentIndex = 0;
		for (let refresh = 0; refresh < 5; refresh++) {
			const chosen = pickActivePlaylistItem(
				items,
				currentIndex,
				"12:00",
				"monday",
			);
			expect(chosen).not.toBeNull();
			seen.push((chosen as Item).screen_id);
			currentIndex = (chosen as Item).order_index;
		}
		// Starting index 0 -> next is b, c, a, b, c ... i.e. it rotates.
		expect(seen).toEqual(["b", "c", "a", "b", "c"]);
	});

	it("skips items whose day-of-week does not match", () => {
		const scheduled = [
			item("weekday", 0, { days_of_week: ["monday", "tuesday"] }),
			item("weekend", 1, { days_of_week: ["saturday", "sunday"] }),
		];
		// On Saturday, starting after the weekend item, only "weekday"...
		const onSat = pickActivePlaylistItem(scheduled, 1, "12:00", "saturday");
		expect(onSat?.screen_id).toBe("weekend");
		// ...and it correctly picks the weekday item on a Monday.
		const onMon = pickActivePlaylistItem(scheduled, 1, "12:00", "monday");
		expect(onMon?.screen_id).toBe("weekday");
	});

	it("skips items outside their time window", () => {
		const scheduled = [
			item("morning", 0, { start_time: "06:00", end_time: "11:00" }),
			item("evening", 1, { start_time: "18:00", end_time: "23:00" }),
		];
		expect(
			pickActivePlaylistItem(scheduled, 1, "07:30", "monday")?.screen_id,
		).toBe("morning");
		expect(
			pickActivePlaylistItem(scheduled, 0, "20:00", "monday")?.screen_id,
		).toBe("evening");
	});

	it("returns null when nothing matches the schedule", () => {
		const scheduled = [
			item("morning", 0, { start_time: "06:00", end_time: "11:00" }),
		];
		expect(pickActivePlaylistItem(scheduled, 0, "23:00", "monday")).toBeNull();
	});

	it("returns null for an empty playlist", () => {
		expect(pickActivePlaylistItem([], 0, "12:00", "monday")).toBeNull();
	});
});
