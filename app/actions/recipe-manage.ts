"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-user";
import type { JsonObject } from "@/lib/database/db.d";
import {
	withUserScope,
	withUserScopeTransaction,
} from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { readBaseSlug } from "@/lib/recipes/recipe-metadata";
import {
	getReactRecipeDefinition,
	isReactRecipe,
} from "@/lib/recipes/registry";

type Result = { success: boolean; error?: string; slug?: string };

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Revalidate the surfaces that list recipes (index page + sidebar layout). */
function revalidateRecipes(): void {
	revalidatePath("/recipes");
	revalidatePath("/", "layout");
}

/**
 * Duplicate a recipe into a new user-owned copy with its own slug, name and
 * settings. React recipes point back at the base component via `metadata.baseSlug`
 * so the copy renders identically; Liquid recipes copy their files. The copy is
 * fully renamable/deletable/hideable, unlike the (shared) original.
 */
export async function duplicateRecipe(slug: string): Promise<Result> {
	const { ready } = await checkDbConnection();
	if (!ready) return { success: false, error: "Database not available" };

	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };

	// Resolve the source's display info + how the copy should render.
	let sourceName: string;
	let description: string | null = null;
	let category: string | null = null;
	let author: string | null = null;
	let authorGithub: string | null = null;
	let type: "react" | "liquid";
	let baseSlug: string | null = null;
	let sourceRecipeId: string | null = null;

	if (isReactRecipe(slug)) {
		// Built-in React recipe: copy reuses this component directly.
		const def = await getReactRecipeDefinition(slug);
		if (!def) return { success: false, error: "Recipe not found" };
		sourceName = def.meta.title;
		description = def.meta.description ?? null;
		category = def.meta.category ?? null;
		author = def.meta.author?.name ?? null;
		authorGithub = def.meta.author?.github ?? null;
		type = "react";
		baseSlug = slug;
	} else {
		const row = await withUserScope((scopedDb) =>
			scopedDb
				.selectFrom("recipes")
				.selectAll()
				.where("slug", "=", slug)
				.executeTakeFirst(),
		);
		if (!row) return { success: false, error: "Recipe not found" };
		sourceName = row.name;
		description = row.description;
		category = row.category;
		author = row.author;
		authorGithub = row.author_github;
		type = row.type;
		sourceRecipeId = row.id;
		// A duplicate of a duplicate still points at the real base component.
		baseSlug =
			row.type === "react" ? (readBaseSlug(row.metadata) ?? row.slug) : null;
	}

	const newSlug = await generateUniqueSlug(`${slug}-copy`);
	const now = new Date().toISOString();

	try {
		await withUserScopeTransaction(async (trx) => {
			const inserted = await trx
				.insertInto("recipes")
				.values({
					name: `${sourceName} copy`,
					slug: newSlug,
					type,
					description,
					category,
					author,
					author_github: authorGithub,
					metadata: (baseSlug
						? { baseSlug, origin: "duplicate" }
						: { origin: "duplicate" }) as JsonObject,
					user_id: userId,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			// Copy Liquid source files so the copy renders standalone.
			if (type === "liquid" && sourceRecipeId) {
				const files = await trx
					.selectFrom("recipe_files")
					.select(["filename", "content"])
					.where("recipe_id", "=", sourceRecipeId)
					.execute();
				if (files.length > 0) {
					await trx
						.insertInto("recipe_files")
						.values(
							files.map((f) => ({
								recipe_id: inserted.id,
								filename: f.filename,
								content: f.content,
							})),
						)
						.execute();
				}
			}

			// Seed the copy's settings from the source's current params (prefer
			// the user's own row over the shared default).
			const sourceParams = await trx
				.selectFrom("screen_configs")
				.select(["params"])
				.where("screen_id", "=", slug)
				.orderBy("user_id", "desc")
				.executeTakeFirst();
			if (sourceParams) {
				await trx
					.insertInto("screen_configs")
					.values({
						screen_id: newSlug,
						params: sourceParams.params,
						user_id: userId,
						created_at: now,
						updated_at: now,
					})
					.execute();
			}
		});
	} catch (error) {
		console.error("Error duplicating recipe:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	revalidateRecipes();
	return { success: true, slug: newSlug };
}

/** Per-user display-name override. Empty name clears the override. */
export async function renameRecipe(
	slug: string,
	name: string,
): Promise<Result> {
	const { ready } = await checkDbConnection();
	if (!ready) return { success: false, error: "Database not available" };
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };

	const trimmed = name.trim();
	const value = trimmed.length > 0 ? trimmed : null;

	try {
		await withUserScope((scopedDb) =>
			scopedDb
				.insertInto("recipe_prefs")
				.values({ user_id: userId, slug, name: value })
				.onConflict((oc) =>
					oc.columns(["user_id", "slug"]).doUpdateSet({
						name: value,
						updated_at: new Date().toISOString(),
					}),
				)
				.execute(),
		);
	} catch (error) {
		console.error("Error renaming recipe:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	revalidateRecipes();
	return { success: true };
}

/** Per-user hide/show in the recipes tree menu. */
export async function setRecipeHidden(
	slug: string,
	hidden: boolean,
): Promise<Result> {
	const { ready } = await checkDbConnection();
	if (!ready) return { success: false, error: "Database not available" };
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };

	try {
		await withUserScope((scopedDb) =>
			scopedDb
				.insertInto("recipe_prefs")
				.values({ user_id: userId, slug, hidden })
				.onConflict((oc) =>
					oc.columns(["user_id", "slug"]).doUpdateSet({
						hidden,
						updated_at: new Date().toISOString(),
					}),
				)
				.execute(),
		);
	} catch (error) {
		console.error("Error updating recipe visibility:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	revalidateRecipes();
	return { success: true };
}

/**
 * Delete a user-owned recipe (a duplicate or an installed Liquid recipe). RLS
 * prevents deleting shared/built-in recipes. Also clears the user's prefs.
 */
export async function deleteUserRecipe(slug: string): Promise<Result> {
	const { ready } = await checkDbConnection();
	if (!ready) return { success: false, error: "Database not available" };

	try {
		await withUserScope(async (scopedDb) => {
			await scopedDb.deleteFrom("recipes").where("slug", "=", slug).execute();
			await scopedDb
				.deleteFrom("recipe_prefs")
				.where("slug", "=", slug)
				.execute();
		});
	} catch (error) {
		console.error("Error deleting recipe:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}

	revalidateRecipes();
	return { success: true };
}

/** Find a slug not used by the registry or any recipe visible to the user. */
async function generateUniqueSlug(base: string): Promise<string> {
	const root = toSlug(base) || "recipe-copy";
	for (let i = 0; i < 50; i++) {
		const candidate = i === 0 ? root : `${root}-${i + 1}`;
		if (isReactRecipe(candidate)) continue;
		const existing = await withUserScope((scopedDb) =>
			scopedDb
				.selectFrom("recipes")
				.select("id")
				.where("slug", "=", candidate)
				.executeTakeFirst(),
		);
		if (!existing) return candidate;
	}
	// Extremely unlikely fallback.
	return `${root}-${Date.now()}`;
}
