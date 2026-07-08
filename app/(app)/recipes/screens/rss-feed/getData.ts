import { unstable_cache } from "next/cache";
import { type FeedItem, parseFeed } from "@/lib/recipes/rss-parser";

export const dynamic = "force-dynamic";

export type { FeedItem };

export type RssData = {
	feedTitle: string;
	feedUrl: string;
	items: FeedItem[];
	generatedAt: string;
	error?: string;
};

type RssParams = {
	feedUrl?: string;
	// Present in params but only consumed by the component at render time.
	displayMode?: string;
	previewLength?: number;
};

const FETCH_TIMEOUT_MS = 8000;
// Fetch a generous pool; the component decides how many actually fit the
// screen and renders as many as it can.
const MAX_ITEMS = 40;

// --- Fetching --------------------------------------------------------------

function emptyData(feedUrl: string, error?: string): RssData {
	return {
		feedTitle: "RSS Feed",
		feedUrl,
		items: [],
		generatedAt: new Date().toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}),
		...(error ? { error } : {}),
	};
}

async function fetchFeed(feedUrl: string): Promise<RssData> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(feedUrl, {
			headers: {
				"User-Agent": "BYOS-RSS/1.0 (+https://usetrmnl.com)",
				Accept:
					"application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
			},
			signal: controller.signal,
			next: { revalidate: 600 },
		});
		if (!response.ok) {
			return emptyData(feedUrl, `Feed responded with ${response.status}`);
		}
		const xml = await response.text();
		const parsed = parseFeed(xml);
		if (parsed.items.length === 0) {
			return emptyData(feedUrl, "No items found in feed");
		}
		return {
			feedTitle: parsed.title,
			feedUrl,
			items: parsed.items.slice(0, MAX_ITEMS),
			generatedAt: new Date().toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}),
		};
	} catch (error) {
		return emptyData(
			feedUrl,
			error instanceof Error ? error.message : "Failed to load feed",
		);
	} finally {
		clearTimeout(timeout);
	}
}

export default async function getRssFeed(params: RssParams): Promise<RssData> {
	const feedUrl = (params.feedUrl ?? "").trim();
	if (!feedUrl) {
		return emptyData("", "Set the RSS feed URL in the recipe settings");
	}

	try {
		const cached = unstable_cache(
			() => fetchFeed(feedUrl),
			["rss-feed", feedUrl],
			{ revalidate: 600, tags: ["rss-feed"] },
		);
		return await cached();
	} catch {
		// Cache layer can throw during prerender; fall back to a direct fetch.
		return fetchFeed(feedUrl);
	}
}
