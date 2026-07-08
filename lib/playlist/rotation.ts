// Pure playlist-rotation helpers, shared by device-level playlists and mixup
// playlist slots. No server/DB/auth dependencies so this is unit-testable and
// safe to import anywhere.

/**
 * Whether `timeToCheck` (HH:MM) falls in [startTime, endTime). Ranges that wrap
 * past midnight (start > end) are supported.
 */
export const isTimeInRange = (
	timeToCheck: string,
	startTime: string,
	endTime: string,
): boolean => {
	if (startTime > endTime) {
		return timeToCheck >= startTime || timeToCheck < endTime;
	}
	return timeToCheck >= startTime && timeToCheck < endTime;
};

type SchedulableItem = {
	days_of_week: unknown;
	start_time: string | null;
	end_time: string | null;
};

/**
 * Playlist-rotation core. Starting just after `currentIndex`, scan items in
 * order (wrapping around) and return the first whose optional time window and
 * day-of-week schedule both match `currentTime`/`currentDay`, or null if none
 * do. Advancing from `currentIndex + 1` is what makes each refresh move to the
 * next eligible item.
 */
export function pickActivePlaylistItem<T extends SchedulableItem>(
	items: T[],
	currentIndex: number,
	currentTime: string,
	currentDay: string,
): T | null {
	if (items.length === 0) return null;

	for (let i = 1; i < items.length + 1; i++) {
		const itemIndex = (currentIndex + i) % items.length;
		const item = items[itemIndex];

		const days_of_week = item.days_of_week as string[] | null;
		const start_time = item.start_time;
		const end_time = item.end_time;

		const isTimeValid =
			!start_time ||
			!end_time ||
			isTimeInRange(currentTime, start_time, end_time);
		const isDayValid =
			!days_of_week ||
			(Array.isArray(days_of_week) && days_of_week.includes(currentDay));

		if (isTimeValid && isDayValid) {
			return item;
		}
	}

	return null;
}
