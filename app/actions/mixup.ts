"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-user";
import type {
	MixupLayoutId as DbMixupLayoutId,
	JsonValue,
} from "@/lib/database/db.d";
import {
	withUserScope,
	withUserScopeTransaction,
} from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import type { SlotAssignment } from "@/lib/mixup/constants";
import type { MixupNode } from "@/lib/mixup/layout-tree";
import type { Mixup, MixupSlot, Recipe } from "@/lib/types";

/**
 * Fetch all mixups
 */
export async function fetchMixups(): Promise<Mixup[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const mixups = await withUserScope((scopedDb) =>
		scopedDb
			.selectFrom("mixups")
			.selectAll()
			.orderBy("created_at", "desc")
			.execute(),
	);

	return mixups as unknown as Mixup[];
}

/**
 * Fetch a single mixup with its slots
 */
export async function fetchMixupWithSlots(mixupId: string): Promise<{
	mixup: Mixup | null;
	slots: MixupSlot[];
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { mixup: null, slots: [] };
	}

	const [mixup, slots] = await withUserScope((scopedDb) =>
		Promise.all([
			scopedDb
				.selectFrom("mixups")
				.selectAll()
				.where("id", "=", mixupId)
				.executeTakeFirst(),
			scopedDb
				.selectFrom("mixup_slots")
				.select([
					"mixup_slots.id",
					"mixup_slots.mixup_id",
					"mixup_slots.slot_id",
					"mixup_slots.recipe_id",
					"mixup_slots.playlist_id",
					"mixup_slots.current_index",
					"mixup_slots.order_index",
					"mixup_slots.created_at",
				])
				.where("mixup_id", "=", mixupId)
				.orderBy("order_index", "asc")
				.execute(),
		]),
	);

	if (!mixup) {
		return { mixup: null, slots: [] };
	}

	return {
		mixup: mixup as unknown as Mixup,
		slots: slots as unknown as MixupSlot[],
	};
}

/**
 * Create a new mixup
 */
export async function createMixup(
	name: string,
	layoutId: string,
): Promise<{
	success: boolean;
	mixup?: Mixup;
	error?: string;
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { success: false, error: "Database client not initialized" };
	}

	const userId = await getCurrentUserId();

	try {
		const mixup = await withUserScope((scopedDb) =>
			scopedDb
				.insertInto("mixups")
				.values({
					name,
					layout_id: layoutId as DbMixupLayoutId,
					user_id: userId,
				})
				.returningAll()
				.executeTakeFirst(),
		);

		return { success: true, mixup: mixup as unknown as Mixup };
	} catch (error) {
		console.error("Error creating mixup:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Update a mixup
 */
export async function updateMixup(
	mixupId: string,
	name: string,
	layoutId: string,
): Promise<{ success: boolean; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { success: false, error: "Database client not initialized" };
	}

	try {
		await withUserScope((scopedDb) =>
			scopedDb
				.updateTable("mixups")
				.set({
					name,
					layout_id: layoutId as DbMixupLayoutId,
					updated_at: new Date().toISOString(),
				})
				.where("id", "=", mixupId)
				.execute(),
		);

		return { success: true };
	} catch (error) {
		console.error("Error updating mixup:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Delete a mixup and all its slots
 */
export async function deleteMixup(mixupId: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { success: false, error: "Database client not initialized" };
	}

	try {
		await withUserScope((scopedDb) =>
			scopedDb.deleteFrom("mixups").where("id", "=", mixupId).execute(),
		);

		revalidatePath("/mixup");
		return { success: true };
	} catch (error) {
		console.error("Error deleting mixup:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Save a complete mixup with all its slots
 * This is the main function used to save from the builder
 */
export async function saveMixupWithSlots(mixupData: {
	id?: string;
	name: string;
	layout_id: string;
	// slot_id -> what that slot displays (a recipe or a playlist).
	assignments: Record<string, SlotAssignment>;
	// Free-form split-tree layout. `null`/omitted keeps the preset layout_id.
	layout_tree?: MixupNode | null;
}): Promise<{ success: boolean; mixupId?: string; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { success: false, error: "Database client not initialized" };
	}

	const userId = await getCurrentUserId();

	try {
		return await withUserScopeTransaction(async (trx) => {
			let mixupId: string;

			// Create or update mixup
			const layoutTree = (mixupData.layout_tree ?? null) as JsonValue;

			if (mixupData.id) {
				// Update existing mixup (RLS handles user check)
				await trx
					.updateTable("mixups")
					.set({
						name: mixupData.name,
						layout_id: mixupData.layout_id as DbMixupLayoutId,
						layout_tree: layoutTree,
						updated_at: new Date().toISOString(),
					})
					.where("id", "=", mixupData.id)
					.execute();

				mixupId = mixupData.id;

				// Delete existing slots
				await trx
					.deleteFrom("mixup_slots")
					.where("mixup_id", "=", mixupId)
					.execute();
			} else {
				// Create new mixup (include user_id for new records)
				const newMixup = await trx
					.insertInto("mixups")
					.values({
						name: mixupData.name,
						layout_id: mixupData.layout_id as DbMixupLayoutId,
						layout_tree: layoutTree,
						user_id: userId,
					})
					.returning("id")
					.executeTakeFirstOrThrow();

				mixupId = newMixup.id;
			}

			// Insert new slots. A slot points at either a recipe or a playlist.
			const slotEntries = Object.entries(mixupData.assignments);
			if (slotEntries.length > 0) {
				const slotsToInsert = slotEntries.map(
					([slotId, assignment], index) => ({
						mixup_id: mixupId,
						slot_id: slotId,
						recipe_id: assignment.kind === "recipe" ? assignment.id : null,
						playlist_id: assignment.kind === "playlist" ? assignment.id : null,
						order_index: index,
					}),
				);

				await trx.insertInto("mixup_slots").values(slotsToInsert).execute();
			}

			revalidatePath("/mixup");
			return { success: true, mixupId };
		});
	} catch (error) {
		console.error("Error saving mixup with slots:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Fetch all recipes visible to the current user (own + shared)
 */
export async function fetchRecipes(): Promise<Recipe[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const recipes = await withUserScope((scopedDb) =>
		scopedDb.selectFrom("recipes").selectAll().orderBy("name", "asc").execute(),
	);

	// Overlay per-user recipe preferences: skip hidden recipes and use the
	// user's rename override for the display name. Degrades gracefully if the
	// recipe_prefs migration hasn't been applied yet.
	let prefs: Array<{ slug: string; name: string | null; hidden: boolean }> = [];
	try {
		prefs = await withUserScope((scopedDb) =>
			scopedDb
				.selectFrom("recipe_prefs")
				.select(["slug", "name", "hidden"])
				.execute(),
		);
	} catch (error) {
		console.warn("[mixup] recipe_prefs unavailable:", error);
	}
	const prefBySlug = new Map(prefs.map((p) => [p.slug, p]));

	const visible = recipes
		.filter((recipe) => !prefBySlug.get(recipe.slug)?.hidden)
		.map((recipe) => {
			const override = prefBySlug.get(recipe.slug)?.name;
			return override?.trim() ? { ...recipe, name: override } : recipe;
		});

	return visible as unknown as Recipe[];
}

export type MixupPreviewDevice = {
	id: string;
	name: string;
	model: string | null;
	palette_id: string | null;
	screen_width: number | null;
	screen_height: number | null;
	screen_orientation: string | null;
};

/**
 * Devices the current user owns, with just the fields needed to preview a
 * mixup on a specific device's display (profile + resolution/orientation).
 */
export async function fetchMixupDevices(): Promise<MixupPreviewDevice[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const devices = await withUserScope((scopedDb) =>
		scopedDb
			.selectFrom("devices")
			.select([
				"id",
				"name",
				"model",
				"palette_id",
				"screen_width",
				"screen_height",
				"screen_orientation",
			])
			.orderBy("name", "asc")
			.execute(),
	);

	return devices.map((d) => ({
		id: String(d.id),
		name: d.name,
		model: d.model,
		palette_id: d.palette_id,
		screen_width: d.screen_width,
		screen_height: d.screen_height,
		screen_orientation: d.screen_orientation,
	}));
}
