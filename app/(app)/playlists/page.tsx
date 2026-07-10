import { connection } from "next/server";
import { Suspense } from "react";
import { fetchPreviewDevices, fetchRecipes } from "@/app/actions/mixup";
import { PageTemplate } from "@/components/common/page-template";
import DbNotConfiguredErrorCard from "@/components/error-cards/db-not-configured-error-card";
import { getDbStatus } from "@/lib/database/utils";
import { getInitData } from "@/lib/getInitData";
import PlaylistsClientPage from "./client-page";

export const metadata = {
	title: "Playlists",
	description: "Manage your device playlists",
};

export default async function PlaylistsPage() {
	await connection();

	const dbStatus = await getDbStatus();

	if (!dbStatus.ready) {
		return <DbNotConfiguredErrorCard status={dbStatus} pageName="Playlists" />;
	}

	const [{ playlists, playlistItems }, recipes, devices] = await Promise.all([
		getInitData(),
		fetchRecipes(),
		fetchPreviewDevices(),
	]);

	return (
		<PageTemplate
			title="Playlists"
			subtitle="Create and manage playlists for your TRMNL devices."
		>
			<Suspense fallback={<div>Loading playlists...</div>}>
				<PlaylistsClientPage
					initialPlaylists={playlists}
					initialPlaylistItems={playlistItems}
					recipes={recipes}
					devices={devices}
				/>
			</Suspense>
		</PageTemplate>
	);
}
