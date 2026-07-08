import { z } from "zod";
import { ScreenFooter } from "@/components/trmnl/screen-layout";
import type { AvailabilityData } from "@/lib/recipes/availability";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { RecipeDefinition } from "@/lib/recipes/types";
import {
	createScreenProfile,
	type ScreenProfile,
} from "@/lib/trmnl/screen-profile";
import { PreSatori } from "@/utils/pre-satori";
import getAvailability from "./getData";

export const paramsSchema = z.object({
	url: z
		.string()
		.default("")
		.describe("The URL (or host) to check for reachability")
		.meta({ title: "URL to check", placeholder: "https://example.com" }),
});

export const dataSchema = z.object({
	url: z.string().default(""),
	status: z.enum(["up", "down", "unconfigured"]).default("unconfigured"),
	statusCode: z.number().nullable().default(null),
	latencyMs: z.number().nullable().default(null),
	detail: z.string().default(""),
	checkedAt: z.string().default("Now"),
});

export default function InternetAvailability({
	data,
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
	screen,
}: {
	data: AvailabilityData;
	width?: number;
	height?: number;
	screen?: ScreenProfile;
}) {
	const screenProfile = screen ?? createScreenProfile({ width, height });
	const isUp = data.status === "up";
	const isUnconfigured = data.status === "unconfigured";

	const headline = isUnconfigured ? "NOT SET" : isUp ? "ONLINE" : "OFFLINE";
	const hostLabel = data.url
		? data.url.replace(/^https?:\/\//i, "").replace(/\/$/, "")
		: "No URL configured";

	// Adapt to the container: the ONLINE/OFFLINE headline is always shown and
	// scaled to fit; secondary details are progressively dropped as space
	// shrinks so it stays legible in a small mixup slot.
	const W = screenProfile.logicalWidth;
	const H = screenProfile.logicalHeight;
	const clamp = (v: number, min: number, max: number) =>
		Math.max(min, Math.min(max, v));

	const showFooter = H >= 460;
	const showMetrics = H >= 300 && W >= 320;
	const showDetail = H >= 200;
	const showHost = H >= 150;

	// Headline is bounded by width (≈7 chars) and height so it never overflows.
	const headlineFont = clamp(Math.min(W / 4.6, H * 0.3), 16, 160);
	const hostFont = clamp(Math.min(W / 16, H * 0.08), 9, 44);
	const detailFont = clamp(Math.min(W / 22, H * 0.07), 8, 34);
	const metricFont = clamp(Math.min(W / 12, H * 0.13), 14, 64);
	const metricLabelFont = clamp(metricFont * 0.32, 7, 20);
	const gap = clamp(H * 0.02, 2, 24);
	const pad = clamp(W * 0.03, 6, 40);

	return (
		<PreSatori
			width={screenProfile.logicalWidth}
			height={screenProfile.logicalHeight}
		>
			<div
				className={`flex h-full w-full flex-col ${
					isUp ? "bg-white text-black" : "bg-black text-white"
				}`}
			>
				<div
					className="flex flex-1 flex-col items-center justify-center text-center"
					style={{ gap, padding: pad }}
				>
					{showHost && (
						<div
							className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-inter"
							style={{ fontSize: hostFont }}
						>
							{hostLabel}
						</div>
					)}
					<div
						className="font-inter"
						style={{
							fontSize: headlineFont,
							lineHeight: 1,
							whiteSpace: "nowrap",
						}}
					>
						{headline}
					</div>
					{showDetail && (
						<div className="font-inter" style={{ fontSize: detailFont }}>
							{data.detail}
						</div>
					)}

					{showMetrics && (
						<div className="flex items-stretch" style={{ gap: gap * 2 }}>
							<div className="flex flex-col items-center">
								<span
									className="font-inter"
									style={{ fontSize: metricFont, lineHeight: 1 }}
								>
									{data.statusCode ?? "—"}
								</span>
								<span
									className="font-inter uppercase tracking-wider"
									style={{ fontSize: metricLabelFont }}
								>
									HTTP status
								</span>
							</div>
							<div className="flex flex-col items-center">
								<span
									className="font-inter"
									style={{ fontSize: metricFont, lineHeight: 1 }}
								>
									{data.latencyMs !== null ? `${data.latencyMs}ms` : "—"}
								</span>
								<span
									className="font-inter uppercase tracking-wider"
									style={{ fontSize: metricLabelFont }}
								>
									Latency
								</span>
							</div>
						</div>
					)}
				</div>

				{showFooter && (
					<div className="flex-none" style={{ padding: `0 ${pad}px` }}>
						<ScreenFooter
							screen={screenProfile}
							left="Internet availability"
							right={`Checked: ${data.checkedAt}`}
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
		slug: "internet-availability",
		title: "Internet Availability",
		description:
			"Checks whether a URL is reachable and shows its status, HTTP code, and response time.",
		published: true,
		tags: ["tailwind", "monitor", "api", "live-data", "configurable"],
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
		const data = await getAvailability(params);
		return data as z.infer<typeof dataSchema>;
	},
	Component: ({ width, height, screen, data }) => (
		<InternetAvailability
			data={data as AvailabilityData}
			width={width}
			height={height}
			screen={screen}
		/>
	),
};
