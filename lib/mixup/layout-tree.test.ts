/// <reference types="jest" />
import { MixupLayoutId } from "@/lib/mixup/constants";
import {
	collectLeafIds,
	flattenTree,
	isMixupNode,
	type MixupNode,
	presetToTree,
	removeLeaf,
	singleLeafTree,
	splitLeaf,
	treeToLayoutSlots,
	updateRatio,
} from "@/lib/mixup/layout-tree";

describe("flattenTree", () => {
	it("gives a single full-box leaf for a leaf tree", () => {
		const rects = flattenTree(singleLeafTree());
		expect(rects).toHaveLength(1);
		expect(rects[0]).toMatchObject({
			relX: 0,
			relY: 0,
			relWidth: 1,
			relHeight: 1,
		});
	});

	it("splits a row node left/right by ratio", () => {
		const tree: MixupNode = {
			type: "split",
			id: "s",
			direction: "row",
			ratio: 0.25,
			children: [
				{ type: "leaf", id: "a" },
				{ type: "leaf", id: "b" },
			],
		};
		const rects = flattenTree(tree);
		expect(rects.find((r) => r.id === "a")).toMatchObject({
			relX: 0,
			relWidth: 0.25,
			relHeight: 1,
		});
		expect(rects.find((r) => r.id === "b")).toMatchObject({
			relX: 0.25,
			relWidth: 0.75,
			relHeight: 1,
		});
	});

	it("splits a column node top/bottom by ratio", () => {
		const tree: MixupNode = {
			type: "split",
			id: "s",
			direction: "column",
			ratio: 0.7,
			children: [
				{ type: "leaf", id: "top" },
				{ type: "leaf", id: "bottom" },
			],
		};
		const rects = flattenTree(tree);
		expect(rects.find((r) => r.id === "top")).toMatchObject({
			relY: 0,
			relHeight: 0.7,
		});
		expect(rects.find((r) => r.id === "bottom")).toMatchObject({
			relY: 0.7,
			relHeight: 0.30000000000000004,
		});
	});
});

describe("presetToTree", () => {
	it("quarters preset yields four leaves with the preset slot ids", () => {
		const ids = collectLeafIds(presetToTree(MixupLayoutId.QUARTERS)).sort();
		expect(ids).toEqual(
			["bottom-left", "bottom-right", "top-left", "top-right"].sort(),
		);
	});

	it("every preset produces a valid tree", () => {
		for (const id of Object.values(MixupLayoutId)) {
			expect(isMixupNode(presetToTree(id))).toBe(true);
		}
	});
});

describe("splitLeaf", () => {
	it("turns a leaf into a split with the original plus a new empty leaf", () => {
		const before = singleLeafTree();
		const after = splitLeaf(before, "area-1", "row");
		expect(after.type).toBe("split");
		const ids = collectLeafIds(after);
		expect(ids).toContain("area-1");
		expect(ids).toHaveLength(2);
	});

	it("does not mutate the original tree", () => {
		const before = singleLeafTree();
		splitLeaf(before, "area-1", "column");
		expect(before.type).toBe("leaf");
	});
});

describe("removeLeaf", () => {
	it("collapses the parent so the sibling takes the whole box", () => {
		const tree = splitLeaf(singleLeafTree(), "area-1", "row");
		const newLeafId = collectLeafIds(tree).find((id) => id !== "area-1");
		expect(newLeafId).toBeDefined();
		const after = removeLeaf(tree, newLeafId as string);
		expect(after).toMatchObject({ type: "leaf", id: "area-1" });
	});
});

describe("updateRatio", () => {
	it("sets and clamps the ratio of the addressed split node", () => {
		const tree = splitLeaf(singleLeafTree(), "area-1", "row") as Extract<
			MixupNode,
			{ type: "split" }
		>;
		const widened = updateRatio(tree, tree.id, 0.8) as Extract<
			MixupNode,
			{ type: "split" }
		>;
		expect(widened.ratio).toBeCloseTo(0.8);
		// Clamps out-of-range values so no pane can vanish.
		const clamped = updateRatio(tree, tree.id, 5) as Extract<
			MixupNode,
			{ type: "split" }
		>;
		expect(clamped.ratio).toBeLessThan(1);
		expect(clamped.ratio).toBeGreaterThan(0);
	});
});

describe("treeToLayoutSlots", () => {
	it("scales the quarters preset into four seamless 400x240 slots on an 800x480 canvas", () => {
		const slots = treeToLayoutSlots(
			presetToTree(MixupLayoutId.QUARTERS),
			800,
			480,
		);
		expect(slots).toHaveLength(4);
		for (const slot of slots) {
			expect(slot.width).toBe(400);
			expect(slot.height).toBe(240);
		}
		// Slots tile the canvas edge-to-edge (no gaps / overlaps at the seams).
		const topLeft = slots.find((s) => s.id === "top-left");
		const bottomRight = slots.find((s) => s.id === "bottom-right");
		expect(topLeft).toMatchObject({ x: 0, y: 0 });
		expect(bottomRight).toMatchObject({ x: 400, y: 240 });
	});
});

describe("isMixupNode", () => {
	it("rejects malformed values", () => {
		expect(isMixupNode(null)).toBe(false);
		expect(isMixupNode({ type: "leaf" })).toBe(false); // missing id
		expect(isMixupNode({ type: "split", id: "s" })).toBe(false); // missing children
		expect(isMixupNode("not-a-node")).toBe(false);
	});
});
