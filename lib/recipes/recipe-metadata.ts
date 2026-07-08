// Pure helpers for recipe `metadata` JSON. No DB/server deps so this is
// unit-testable and safe to import anywhere.

/**
 * A duplicated recipe stores its lineage in `recipes.metadata`:
 *   { baseSlug: "<built-in slug>", origin: "duplicate" }
 * `baseSlug` is the registry slug whose component the duplicate reuses.
 */
export type RecipeDuplicateMeta = {
	baseSlug?: string;
	origin?: string;
};

/** Extract a non-empty `baseSlug` from a recipe row's JSON metadata, if any. */
export function readBaseSlug(metadata: unknown): string | null {
	if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
		const base = (metadata as Record<string, unknown>).baseSlug;
		if (typeof base === "string" && base.length > 0) return base;
	}
	return null;
}
