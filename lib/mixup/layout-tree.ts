// Free-form mixup layouts as a binary split tree.
//
// A mixup layout is a tree of nodes. A `leaf` is a rendered area (assigned a
// recipe). A `split` divides its box into two children, either side-by-side
// (`direction: "row"` → a vertical divider) or stacked (`direction: "column"`
// → a horizontal divider). `ratio` is the fraction of space given to the first
// child (0..1).
//
// This module has NO server-only dependencies so it can be imported from both
// the client builder and the bitmap render route.
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import { type LayoutSlot, MixupLayoutId } from "./constants";

export type SplitDirection = "row" | "column";

export type MixupLeafNode = {
	type: "leaf";
	id: string;
	label?: string;
};

export type MixupSplitNode = {
	type: "split";
	id: string;
	direction: SplitDirection;
	/** Fraction of the box given to `children[0]` (0..1). */
	ratio: number;
	children: [MixupNode, MixupNode];
};

export type MixupNode = MixupLeafNode | MixupSplitNode;

/** Minimum fraction a divider drag can shrink a pane to, so nothing vanishes. */
export const MIN_RATIO = 0.1;

let idCounter = 0;

/** Stable-ish unique id for new nodes. */
export function newNodeId(): string {
	const g = globalThis as { crypto?: { randomUUID?: () => string } };
	if (typeof g.crypto?.randomUUID === "function") {
		return g.crypto.randomUUID();
	}
	idCounter += 1;
	return `node-${idCounter}`;
}

function leaf(id: string, label?: string): MixupLeafNode {
	return label ? { type: "leaf", id, label } : { type: "leaf", id };
}

function split(
	id: string,
	direction: SplitDirection,
	ratio: number,
	children: [MixupNode, MixupNode],
): MixupSplitNode {
	return { type: "split", id, direction, ratio, children };
}

/**
 * Convert a built-in preset layout into an equivalent split tree. Leaf ids
 * reuse the preset's slot ids so recipe assignments carry over when an existing
 * mixup (stored as a preset) is opened in the free-form editor.
 */
export function presetToTree(layoutId: MixupLayoutId | string): MixupNode {
	switch (layoutId) {
		case MixupLayoutId.TOP_BANNER:
			return split("s-top-banner", "column", 0.5, [
				leaf("top", "Top span"),
				split("s-top-banner-bottom", "row", 0.5, [
					leaf("bottom-left", "Bottom left"),
					leaf("bottom-right", "Bottom right"),
				]),
			]);
		case MixupLayoutId.LEFT_RAIL:
			return split("s-left-rail", "row", 0.5, [
				leaf("left", "Left column"),
				split("s-left-rail-right", "column", 0.5, [
					leaf("top-right", "Top right"),
					leaf("bottom-right", "Bottom right"),
				]),
			]);
		case MixupLayoutId.VERTICAL_HALVES:
			return split("s-vertical-halves", "row", 0.5, [
				leaf("left-half", "Left half"),
				leaf("right-half", "Right half"),
			]);
		case MixupLayoutId.HORIZONTAL_HALVES:
			return split("s-horizontal-halves", "column", 0.5, [
				leaf("top-half", "Top half"),
				leaf("bottom-half", "Bottom half"),
			]);
		default:
			// Quarters (also the fallback for unknown ids).
			return split("s-quarters", "column", 0.5, [
				split("s-quarters-top", "row", 0.5, [
					leaf("top-left", "Top left"),
					leaf("top-right", "Top right"),
				]),
				split("s-quarters-bottom", "row", 0.5, [
					leaf("bottom-left", "Bottom left"),
					leaf("bottom-right", "Bottom right"),
				]),
			]);
	}
}

/** A single full-screen area — the starting point for a blank custom layout. */
export function singleLeafTree(): MixupNode {
	return leaf("area-1", "Full screen");
}

export type LeafRect = {
	id: string;
	label?: string;
	/** Relative geometry within the unit box (0..1). */
	relX: number;
	relY: number;
	relWidth: number;
	relHeight: number;
};

/**
 * Walk the tree and produce the relative rectangle of every leaf, in
 * left-to-right / top-to-bottom order.
 */
export function flattenTree(
	node: MixupNode,
	rect: { x: number; y: number; w: number; h: number } = {
		x: 0,
		y: 0,
		w: 1,
		h: 1,
	},
	out: LeafRect[] = [],
): LeafRect[] {
	if (node.type === "leaf") {
		out.push({
			id: node.id,
			label: node.label,
			relX: rect.x,
			relY: rect.y,
			relWidth: rect.w,
			relHeight: rect.h,
		});
		return out;
	}

	const ratio = clampRatio(node.ratio);
	if (node.direction === "row") {
		const w0 = rect.w * ratio;
		flattenTree(node.children[0], { ...rect, w: w0 }, out);
		flattenTree(
			node.children[1],
			{ x: rect.x + w0, y: rect.y, w: rect.w - w0, h: rect.h },
			out,
		);
	} else {
		const h0 = rect.h * ratio;
		flattenTree(node.children[0], { ...rect, h: h0 }, out);
		flattenTree(
			node.children[1],
			{ x: rect.x, y: rect.y + h0, w: rect.w, h: rect.h - h0 },
			out,
		);
	}
	return out;
}

export function clampRatio(ratio: number): number {
	if (!Number.isFinite(ratio)) return 0.5;
	return Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, ratio));
}

/**
 * Scale the tree's leaves into absolute pixel slots for the render pipeline.
 * Edges are rounded consistently so adjacent slots stay seamless (no white
 * gaps in the composite).
 */
export function treeToLayoutSlots(
	tree: MixupNode,
	width: number = DEFAULT_IMAGE_WIDTH,
	height: number = DEFAULT_IMAGE_HEIGHT,
): LayoutSlot[] {
	return flattenTree(tree).map((r, index) => {
		const x = Math.round(r.relX * width);
		const y = Math.round(r.relY * height);
		const right = Math.round((r.relX + r.relWidth) * width);
		const bottom = Math.round((r.relY + r.relHeight) * height);
		return {
			id: r.id,
			label: r.label ?? `Area ${index + 1}`,
			x,
			y,
			width: Math.max(1, right - x),
			height: Math.max(1, bottom - y),
		};
	});
}

/** All leaf ids in the tree. */
export function collectLeafIds(node: MixupNode, out: string[] = []): string[] {
	if (node.type === "leaf") {
		out.push(node.id);
		return out;
	}
	collectLeafIds(node.children[0], out);
	collectLeafIds(node.children[1], out);
	return out;
}

/**
 * Split the leaf with `leafId` into two, keeping the original as the first
 * child and adding a fresh empty leaf as the second. Returns a new tree.
 */
export function splitLeaf(
	node: MixupNode,
	leafId: string,
	direction: SplitDirection,
): MixupNode {
	if (node.type === "leaf") {
		if (node.id !== leafId) return node;
		return split(newNodeId(), direction, 0.5, [
			leaf(node.id, node.label),
			leaf(newNodeId()),
		]);
	}
	return {
		...node,
		children: [
			splitLeaf(node.children[0], leafId, direction),
			splitLeaf(node.children[1], leafId, direction),
		],
	};
}

/**
 * Remove the leaf with `leafId`; its sibling subtree takes over the parent's
 * space. Removing the last remaining leaf is a no-op. Returns a new tree.
 */
export function removeLeaf(node: MixupNode, leafId: string): MixupNode {
	if (node.type === "leaf") return node; // handled by parent

	const [a, b] = node.children;
	if (a.type === "leaf" && a.id === leafId) return b;
	if (b.type === "leaf" && b.id === leafId) return a;

	return {
		...node,
		children: [removeLeaf(a, leafId), removeLeaf(b, leafId)],
	};
}

/** Set the ratio of the split node identified by `nodeId`. Returns a new tree. */
export function updateRatio(
	node: MixupNode,
	nodeId: string,
	ratio: number,
): MixupNode {
	if (node.type === "leaf") return node;
	if (node.id === nodeId) return { ...node, ratio: clampRatio(ratio) };
	return {
		...node,
		children: [
			updateRatio(node.children[0], nodeId, ratio),
			updateRatio(node.children[1], nodeId, ratio),
		],
	};
}

/** Narrow an unknown value (e.g. a DB JSON column) to a valid MixupNode. */
export function isMixupNode(value: unknown): value is MixupNode {
	if (!value || typeof value !== "object") return false;
	const node = value as Record<string, unknown>;
	if (node.type === "leaf") return typeof node.id === "string";
	if (node.type === "split") {
		return (
			typeof node.id === "string" &&
			(node.direction === "row" || node.direction === "column") &&
			typeof node.ratio === "number" &&
			Array.isArray(node.children) &&
			node.children.length === 2 &&
			isMixupNode(node.children[0]) &&
			isMixupNode(node.children[1])
		);
	}
	return false;
}
