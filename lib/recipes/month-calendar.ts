// Pure month-grid computation for the "Month of the Year" recipe. No React or
// server deps so it is unit-testable in isolation.

export type MonthChoice = "current" | "previous" | "next";

/** Which day the calendar week starts on. */
export type WeekStart = "sunday" | "monday";

/** Weekday labels indexed by JS getDay() (0 = Sunday). */
const WEEKDAYS_SUNDAY_FIRST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sunday-first weekday labels (kept for backwards compatibility). */
export const WEEKDAYS = WEEKDAYS_SUNDAY_FIRST;

const WEEK_START_INDEX: Record<WeekStart, number> = {
	sunday: 0,
	monday: 1,
};

const MONTH_OFFSET: Record<MonthChoice, number> = {
	previous: -1,
	current: 0,
	next: 1,
};

export type CalendarModel = {
	/** e.g. "July 2026" */
	title: string;
	/** Weekday column labels in display order (respects the week start). */
	weekdays: string[];
	/** Rows of day numbers in the chosen week order; null cells pad the edges. */
	weeks: (number | null)[][];
	/** Day-of-month that is "today", or null if the shown month isn't the current one. */
	today: number | null;
};

/**
 * Build a month grid for `choice`, relative to `now`. `weekStart` chooses which
 * day the week begins on (Sunday or Monday). Rendered against the current date
 * so "current"/"next"/"previous" track real time.
 */
export function buildCalendar(
	choice: MonthChoice,
	weekStart: WeekStart = "sunday",
	now: Date = new Date(),
): CalendarModel {
	const startIndex = WEEK_START_INDEX[weekStart];

	const target = new Date(
		now.getFullYear(),
		now.getMonth() + MONTH_OFFSET[choice],
		1,
	);
	const year = target.getFullYear();
	const month = target.getMonth();

	// getDay() is Sunday-relative; shift into the chosen week ordering.
	const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
	const leadingPad = (firstWeekday - startIndex + 7) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const cells: (number | null)[] = [];
	for (let i = 0; i < leadingPad; i++) cells.push(null);
	for (let d = 1; d <= daysInMonth; d++) cells.push(d);
	while (cells.length % 7 !== 0) cells.push(null);

	const weeks: (number | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

	const weekdays = Array.from(
		{ length: 7 },
		(_, i) => WEEKDAYS_SUNDAY_FIRST[(startIndex + i) % 7],
	);

	const today =
		year === now.getFullYear() && month === now.getMonth()
			? now.getDate()
			: null;

	const title = new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(target);

	return { title, weekdays, weeks, today };
}
