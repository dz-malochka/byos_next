import { z } from "zod";
import { ScreenFooter } from "@/components/trmnl/screen-layout";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import {
	buildCalendar,
	type MonthChoice,
	type WeekStart,
} from "@/lib/recipes/month-calendar";
import type { RecipeDefinition } from "@/lib/recipes/types";
import {
	createScreenProfile,
	type ScreenProfile,
} from "@/lib/trmnl/screen-profile";
import { PreSatori } from "@/utils/pre-satori";

export const paramsSchema = z.object({
	month: z
		.enum(["current", "previous", "next"])
		.default("current")
		.describe("Which month to display relative to today")
		.meta({ title: "Month" }),
	firstDayOfWeek: z
		.enum(["sunday", "monday"])
		.default("sunday")
		.describe("Which day the week starts on")
		.meta({ title: "First day of week" }),
});
export const dataSchema = paramsSchema;

export default function MonthOfYear({
	month = "current",
	firstDayOfWeek = "sunday",
	width = DEFAULT_IMAGE_WIDTH,
	height = DEFAULT_IMAGE_HEIGHT,
	screen,
}: {
	month?: MonthChoice;
	firstDayOfWeek?: WeekStart;
	width?: number;
	height?: number;
	screen?: ScreenProfile;
}) {
	const screenProfile = screen ?? createScreenProfile({ width, height });
	const { title, weekdays, weeks, today } = buildCalendar(
		month,
		firstDayOfWeek,
	);

	// Size everything from the actual available space so the calendar fits any
	// container — a full device screen or a small mixup slot. All values are in
	// logical px and scale continuously rather than snapping at breakpoints.
	const W = screenProfile.logicalWidth;
	const H = screenProfile.logicalHeight;
	const rows = weeks.length;
	const clamp = (v: number, min: number, max: number) =>
		Math.max(min, Math.min(max, v));

	// The footer only earns its space on a reasonably tall canvas; in a slot it
	// would crowd out the grid, so we drop it there.
	const showFooter = H >= 460;
	const cellW = W / 7;
	const approxRowH =
		(H - H * 0.16 - H * 0.1 - (showFooter ? H * 0.12 : 0)) / Math.max(rows, 1);

	const dayFont = clamp(Math.min(cellW * 0.5, approxRowH * 0.52), 8, 72);
	// Header is bounded by both height and width so long titles ("September
	// 2026") never overflow a narrow slot.
	const headerFont = clamp(Math.min(H * 0.11, W / 8), 11, 96);
	const weekdayFont = clamp(Math.min(cellW * 0.34, H * 0.05), 6, 28);
	const pad = clamp(W * 0.015, 2, 40);

	return (
		<PreSatori
			width={screenProfile.logicalWidth}
			height={screenProfile.logicalHeight}
		>
			<div className="flex h-full w-full flex-col bg-white text-black">
				{/* Header */}
				<div
					className="flex flex-none items-baseline justify-between border-b border-black"
					style={{ padding: `${pad * 0.6}px ${pad}px` }}
				>
					<h1
						className="font-inter"
						style={{ fontSize: headerFont, lineHeight: 1 }}
					>
						{title}
					</h1>
				</div>

				{/* Weekday labels */}
				<div className="flex flex-none border-b border-black">
					{weekdays.map((day) => (
						<div
							key={day}
							className="flex flex-1 items-center justify-center font-inter uppercase tracking-wider"
							style={{ fontSize: weekdayFont, padding: `${pad * 0.25}px 0` }}
						>
							{day}
						</div>
					))}
				</div>

				{/* Weeks */}
				<div className="flex flex-1 flex-col">
					{weeks.map((week, wi) => (
						<div
							key={wi}
							className="flex flex-1 border-b border-black/30 last:border-b-0"
						>
							{week.map((day, di) => {
								const isToday = day !== null && day === today;
								return (
									<div
										key={di}
										className={`flex flex-1 items-start justify-end border-r border-black/20 last:border-r-0 ${
											isToday ? "bg-black text-white" : ""
										}`}
										style={{ padding: pad * 0.3 }}
									>
										<span
											className="font-inter"
											style={{ fontSize: dayFont, lineHeight: 1 }}
										>
											{day ?? ""}
										</span>
									</div>
								);
							})}
						</div>
					))}
				</div>

				{showFooter && (
					<div className="flex-none" style={{ padding: `0 ${pad}px` }}>
						<ScreenFooter
							screen={screenProfile}
							left="Calendar"
							right={title}
						/>
					</div>
				)}
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<typeof paramsSchema> = {
	meta: {
		slug: "month-of-year",
		title: "Month of the Year",
		description:
			"A monthly calendar grid. Choose whether to show the current, previous, or next month.",
		published: true,
		tags: ["tailwind", "calendar", "configurable"],
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
	Component: ({ width, height, screen, params }) => (
		<MonthOfYear
			month={params.month}
			firstDayOfWeek={params.firstDayOfWeek}
			width={width}
			height={height}
			screen={screen}
		/>
	),
};
