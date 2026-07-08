import { z } from "zod";
import { ScreenFooter } from "@/components/trmnl/screen-layout";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import { truncate } from "@/lib/recipes/rss-parser";
import type { RecipeDefinition } from "@/lib/recipes/types";
import {
	createScreenProfile,
	type ScreenProfile,
} from "@/lib/trmnl/screen-profile";
import { PreSatori } from "@/utils/pre-satori";
import getRssFeed, { type RssData } from "./getData";

export const paramsSchema = z.object({
	feedUrl: z
		.string()
		.default("")
		.describe("URL of the RSS or Atom feed to display")
		.meta({
			title: "RSS Feed URL",
			placeholder: "https://example.com/feed.xml",
		}),
	displayMode: z
		.enum(["title-only", "preview"])
		.default("title-only")
		.describe("Show only headlines, or a short preview of each article")
		.meta({ title: "Display" }),
	previewLength: z
		.number()
		.default(140)
		.describe("Characters of the article to show when previewing")
		.meta({ title: "Preview length" }),
	hideTitle: z
		.boolean()
		.default(true)
		.describe("Hide the feed title header to give items more room")
		.meta({ title: "Hide feed title" }),
});

export const dataSchema = z.object({
	feedTitle: z.string().default("RSS Feed"),
	feedUrl: z.string().default(""),
	items: z
		.array(
			z.object({
				title: z.string().default("Untitled"),
				link: z.string().default(""),
				description: z.string().default(""),
				publishedAt: z.string().default(""),
			}),
		)
		.default([]),
	generatedAt: z.string().default("Now"),
	error: z.string().optional(),
});

type DisplayMode = z.infer<typeof paramsSchema>["displayMode"];

export default function RssFeed({
	data,
	displayMode = "title-only",
	previewLength = 140,
	hideTitle = true,
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
	screen,
}: {
	data: RssData;
	displayMode?: DisplayMode;
	previewLength?: number;
	hideTitle?: boolean;
	width?: number;
	height?: number;
	screen?: ScreenProfile;
}) {
	const screenProfile = screen ?? createScreenProfile({ width, height });
	const showPreview = displayMode === "preview";

	// Everything scales with the container (full screen or slot). Rows are a
	// fixed height packed from the top; the list fills the available space and
	// anything past the bottom edge is simply clipped (no row-count math).
	const W = screenProfile.logicalWidth;
	const H = screenProfile.logicalHeight;
	const clamp = (v: number, min: number, max: number) =>
		Math.max(min, Math.min(max, v));

	const showFooter = H >= 400;
	const headerFont = clamp(Math.min(H * 0.055, W / 16), 12, 34);
	const pad = clamp(W * 0.02, 6, 40);

	// Single-line title, a bit larger (bounded by width so it stays readable).
	const titleFont = clamp(Math.min(H * 0.06, W / 13), 15, 32);
	const descFont = clamp(Math.min(H * 0.04, W / 21), 11, 22);
	const vPad = clamp(H * 0.004, 2, 6);
	const rowH = showPreview
		? titleFont * 1.15 + descFont * 1.25 + vPad * 3
		: titleFont * 1.15 + vPad * 2;

	// Render everything the feed returned; overflow is clipped by the container.
	const items = data.items;

	return (
		<PreSatori
			width={screenProfile.logicalWidth}
			height={screenProfile.logicalHeight}
		>
			<div className="flex h-full w-full flex-col bg-white text-black">
				{!hideTitle && (
					<div
						className="flex flex-none items-baseline justify-between border-b border-black"
						style={{ padding: `${pad * 0.6}px ${pad}px` }}
					>
						<h1
							className="truncate font-inter"
							style={{ fontSize: headerFont, lineHeight: 1.1 }}
						>
							{data.feedTitle}
						</h1>
					</div>
				)}

				<div className="flex flex-1 flex-col overflow-hidden">
					{items.length === 0 ? (
						<div
							className="flex flex-1 items-center justify-center p-8 text-center font-inter text-black"
							style={{ fontSize: clamp(H * 0.05, 14, 32) }}
						>
							{data.error ?? "No feed items to display."}
						</div>
					) : (
						items.map((item, index) => (
							<div
								key={index}
								className="flex flex-none flex-col justify-center overflow-hidden border-b border-black/20 last:border-b-0"
								style={{
									height: rowH,
									padding: `${vPad}px ${pad}px`,
								}}
							>
								<span
									className="truncate font-inter"
									style={{ fontSize: titleFont, lineHeight: 1.2 }}
								>
									{item.title}
								</span>
								{showPreview && item.description && (
									<p
										className="truncate font-inter text-black/80"
										style={{ fontSize: descFont, lineHeight: 1.2 }}
									>
										{truncate(item.description, previewLength)}
									</p>
								)}
							</div>
						))
					)}
				</div>

				{showFooter && (
					<div className="flex-none" style={{ padding: `0 ${pad}px` }}>
						<ScreenFooter
							screen={screenProfile}
							left={data.feedUrl || "RSS Feed"}
						/>
					</div>
				)}
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "rss-feed",
		title: "RSS Feed",
		description:
			"Displays the latest entries from any RSS or Atom feed. Show headlines only, or a short preview of each article.",
		published: true,
		tags: ["tailwind", "rss", "api", "live-data", "configurable"],
		author: { name: "byos_next" },
		category: "display-components",
		version: "0.1.0",
		createdAt: "2026-07-07T00:00:00Z",
		updatedAt: "2026-07-07T00:00:00Z",
		renderSettings: {
			supersample: true,
		},
	},
	paramsSchema,
	dataSchema,
	getData: async (params) => {
		const data = await getRssFeed(params);
		return data as z.infer<typeof dataSchema>;
	},
	Component: ({ width, height, screen, params, data }) => (
		<RssFeed
			data={data as RssData}
			displayMode={params.displayMode}
			previewLength={params.previewLength}
			hideTitle={params.hideTitle}
			width={width}
			height={height}
			screen={screen}
		/>
	),
};
