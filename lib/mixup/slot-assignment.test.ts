/// <reference types="jest" />
import { slotsToAssignments } from "@/lib/mixup/constants";

describe("slotsToAssignments", () => {
	it("maps a recipe slot to a recipe assignment", () => {
		const result = slotsToAssignments([
			{ slot_id: "a", recipe_id: "recipe-1", playlist_id: null },
		]);
		expect(result.a).toEqual({ kind: "recipe", id: "recipe-1" });
	});

	it("maps a playlist slot to a playlist assignment", () => {
		const result = slotsToAssignments([
			{ slot_id: "b", recipe_id: null, playlist_id: "playlist-9" },
		]);
		expect(result.b).toEqual({ kind: "playlist", id: "playlist-9" });
	});

	it("prefers the recipe when both are somehow set", () => {
		const result = slotsToAssignments([
			{ slot_id: "c", recipe_id: "recipe-1", playlist_id: "playlist-9" },
		]);
		expect(result.c).toEqual({ kind: "recipe", id: "recipe-1" });
	});

	it("omits empty slots", () => {
		const result = slotsToAssignments([
			{ slot_id: "d", recipe_id: null, playlist_id: null },
		]);
		expect(result.d).toBeUndefined();
	});

	it("round-trips a mix of recipe and playlist slots", () => {
		const result = slotsToAssignments([
			{ slot_id: "top", recipe_id: "r1", playlist_id: null },
			{ slot_id: "bottom", recipe_id: null, playlist_id: "p1" },
		]);
		expect(result).toEqual({
			top: { kind: "recipe", id: "r1" },
			bottom: { kind: "playlist", id: "p1" },
		});
	});
});
