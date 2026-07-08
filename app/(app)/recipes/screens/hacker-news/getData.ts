// Live data — always fetch fresh.
export const dynamic = "force-dynamic";

interface Story {
	rank: number;
	title: string;
	score: number;
	comments: number;
	by: string;
	domain: string;
}

export interface HackerNewsData {
	stories: Story[];
	updatedLabel: string;
	message?: string;
}

const HN_API = "https://hacker-news.firebaseio.com/v0";

// Fetch a generous pool so the list fills any screen; the component renders as
// many as fit and clips the rest.
const STORY_COUNT = 30;

function domainOf(url: string | undefined): string {
	if (!url) return "news.ycombinator.com";
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

async function fetchJson<T>(
	url: string,
	signal: AbortSignal,
): Promise<T | null> {
	try {
		const res = await fetch(url, { signal });
		return res.ok ? ((await res.json()) as T) : null;
	} catch {
		return null;
	}
}

export default async function getData(): Promise<HackerNewsData> {
	const updatedLabel = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(new Date());

	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 8000);
	try {
		const ids = await fetchJson<number[]>(
			`${HN_API}/topstories.json`,
			ctrl.signal,
		);
		if (!ids || ids.length === 0) {
			return {
				stories: [],
				updatedLabel,
				message: "Hacker News is unreachable right now.",
			};
		}

		const items = await Promise.all(
			ids.slice(0, STORY_COUNT).map((id) =>
				fetchJson<{
					id: number;
					title?: string;
					score?: number;
					descendants?: number;
					by?: string;
					url?: string;
				}>(`${HN_API}/item/${id}.json`, ctrl.signal),
			),
		);

		const stories: Story[] = items
			.filter((it): it is NonNullable<typeof it> => Boolean(it?.title))
			.map((it, i) => ({
				rank: i + 1,
				title: it.title as string,
				score: it.score ?? 0,
				comments: it.descendants ?? 0,
				by: it.by ?? "",
				domain: domainOf(it.url),
			}));

		if (stories.length === 0) {
			return {
				stories: [],
				updatedLabel,
				message: "No stories available right now.",
			};
		}
		return { stories, updatedLabel };
	} finally {
		clearTimeout(timer);
	}
}
