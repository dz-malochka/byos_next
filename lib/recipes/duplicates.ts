import type { Kysely } from "kysely";
import type { DB } from "@/lib/database/db.d";
import { withExplicitUserScope, withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { readBaseSlug } from "./recipe-metadata";

/**
 * If `slug` is a user's duplicate of a React recipe, return the base recipe's
 * slug (the one present in the in-process registry); otherwise null.
 */
export async function resolveDuplicateBaseSlug(
	slug: string,
	userId?: string,
): Promise<string | null> {
	const { ready } = await checkDbConnection();
	if (!ready) return null;

	const run = (scopedDb: Kysely<DB>) =>
		scopedDb
			.selectFrom("recipes")
			.select(["metadata"])
			.where("slug", "=", slug)
			.where("type", "=", "react")
			.executeTakeFirst();

	const row = userId
		? await withExplicitUserScope(userId, run)
		: await withUserScope(run);

	return row ? readBaseSlug(row.metadata) : null;
}
