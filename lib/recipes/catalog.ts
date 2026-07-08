import { withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { readBaseSlug } from "./recipe-metadata";
import { listReactRecipes } from "./registry";

/**
 * Catalog row exposed to the sidebar, recipes index page, and any other
 * UI surface that needs to enumerate every recipe a user can render.
 *
 * Built-in React recipes come from the in-process registry (no DB read).
 * Liquid recipes and user duplicates come from the `recipes` table. Per-user
 * rename/hide overrides from `recipe_prefs` are overlaid on top.
 */
export type CatalogRecipe = {
	slug: string;
	name: string;
	description: string | null;
	category: string | null;
	version: string | null;
	author: string | null;
	author_github: string | null;
	type: "react" | "liquid";
	/** Built-in React recipe (from the registry) — cannot be deleted. */
	system: boolean;
	/** User-owned row (duplicate or installed liquid) — can be deleted. */
	owned: boolean;
	/** A user's duplicate of another recipe (reuses its rendering). */
	duplicate: boolean;
	/** Hidden from the recipes tree for the current user. */
	hidden: boolean;
};

type PrefRow = { name: string | null; hidden: boolean };

async function getRecipePrefsMap(): Promise<Record<string, PrefRow>> {
	const { ready } = await checkDbConnection();
	if (!ready) return {};
	try {
		const rows = await withUserScope((scopedDb) =>
			scopedDb
				.selectFrom("recipe_prefs")
				.select(["slug", "name", "hidden"])
				.execute(),
		);
		const map: Record<string, PrefRow> = {};
		for (const row of rows)
			map[row.slug] = { name: row.name, hidden: row.hidden };
		return map;
	} catch (error) {
		// Degrade gracefully if the recipe_prefs migration isn't applied yet.
		console.warn("[catalog] recipe_prefs unavailable:", error);
		return {};
	}
}

export async function listAllRecipes(
	options: { includeSystem?: boolean } = {},
): Promise<CatalogRecipe[]> {
	const { includeSystem = false } = options;

	const reactMetas = await listReactRecipes({
		includeSystem,
		includeUnpublished: process.env.NODE_ENV !== "production",
	});

	const reactRecipes: CatalogRecipe[] = reactMetas.map((meta) => ({
		slug: meta.slug,
		name: meta.title,
		description: meta.description ?? null,
		category: meta.category ?? null,
		version: meta.version ?? null,
		author: meta.author?.name ?? null,
		author_github: meta.author?.github ?? null,
		type: "react",
		system: true,
		owned: false,
		duplicate: false,
		hidden: false,
	}));

	const [dbRecipes, prefs] = await Promise.all([
		listDbRecipes(),
		getRecipePrefsMap(),
	]);

	const merged = [...reactRecipes, ...dbRecipes].map((recipe) => {
		const pref = prefs[recipe.slug];
		if (!pref) return recipe;
		return {
			...recipe,
			name: pref.name?.trim() ? pref.name : recipe.name,
			hidden: pref.hidden,
		};
	});

	return merged.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Per-user management info for a single recipe slug: the display-name override,
 * whether it's hidden, and whether the user owns it (i.e. can delete it).
 */
export async function getRecipeManageInfo(slug: string): Promise<{
	nameOverride: string | null;
	hidden: boolean;
	owned: boolean;
}> {
	const { ready } = await checkDbConnection();
	if (!ready) return { nameOverride: null, hidden: false, owned: false };

	try {
		return await withUserScope(async (scopedDb) => {
			const pref = await scopedDb
				.selectFrom("recipe_prefs")
				.select(["name", "hidden"])
				.where("slug", "=", slug)
				.executeTakeFirst();
			const ownedRow = await scopedDb
				.selectFrom("recipes")
				.select("id")
				.where("slug", "=", slug)
				.where("user_id", "is not", null)
				.executeTakeFirst();
			return {
				nameOverride: pref?.name?.trim() ? pref.name : null,
				hidden: pref?.hidden ?? false,
				owned: Boolean(ownedRow),
			};
		});
	} catch (error) {
		console.warn("[catalog] recipe_prefs unavailable:", error);
		return { nameOverride: null, hidden: false, owned: false };
	}
}

/**
 * Liquid recipes (own + shared) and the current user's React duplicates. Built-in
 * React rows (user_id IS NULL) are excluded — they come from the registry.
 */
async function listDbRecipes(): Promise<CatalogRecipe[]> {
	const { ready } = await checkDbConnection();
	if (!ready) return [];

	const rows = await withUserScope((scopedDb) =>
		scopedDb
			.selectFrom("recipes")
			.select([
				"slug",
				"name",
				"description",
				"category",
				"version",
				"author",
				"author_github",
				"type",
				"user_id",
				"metadata",
			])
			.where((eb) =>
				eb.or([
					eb("type", "=", "liquid"),
					eb.and([eb("type", "=", "react"), eb("user_id", "is not", null)]),
				]),
			)
			.execute(),
	);

	return rows.map((row) => ({
		slug: row.slug,
		name: row.name,
		description: row.description,
		category: row.category,
		version: row.version,
		author: row.author,
		author_github: row.author_github,
		type: row.type,
		system: false,
		owned: row.user_id !== null,
		duplicate: readBaseSlug(row.metadata) !== null,
		hidden: false,
	}));
}
