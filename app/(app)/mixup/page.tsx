import { connection } from "next/server";
import {
	fetchMixupDevices,
	fetchMixups,
	fetchRecipes,
} from "@/app/actions/mixup";
import { fetchPlaylists } from "@/app/actions/playlist";
import DbNotConfiguredErrorCard from "@/components/error-cards/db-not-configured-error-card";
import { getDbStatus } from "@/lib/database/utils";
import MixupClientPage from "./client-page";

export const metadata = {
	title: "Mixup",
	description: "Compose split-screen layouts with your recipes.",
};

export default async function MixupPage() {
	await connection();

	const dbStatus = await getDbStatus();

	if (!dbStatus.ready) {
		return <DbNotConfiguredErrorCard status={dbStatus} pageName="Mixups" />;
	}

	const [mixups, recipes, playlists, devices] = await Promise.all([
		fetchMixups(),
		fetchRecipes(),
		fetchPlaylists(),
		fetchMixupDevices(),
	]);

	const availableRecipes = recipes.map((r) => ({
		id: r.id,
		slug: r.slug,
		title: r.name,
		description: r.description ?? undefined,
	}));

	const availablePlaylists = playlists.map((p) => ({
		id: p.id,
		name: p.name,
	}));

	return (
		<MixupClientPage
			initialMixups={mixups}
			recipes={availableRecipes}
			playlists={availablePlaylists}
			devices={devices}
		/>
	);
}
