// Pure, dependency-free RSS 2.0 / Atom feed parser. No network or Next deps so
// it is unit-testable and safe to import anywhere.

export type FeedItem = {
	title: string;
	link: string;
	description: string;
	publishedAt: string;
};

function decodeEntities(input: string): string {
	return input
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&amp;/g, "&");
}

function stripCdata(input: string): string {
	return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(input: string): string {
	return input
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Clean text from an XML node. Order matters: decode first so escaped markup
 * (`&lt;p&gt;`) becomes real tags, strip those tags, then decode again to
 * resolve any double-escaped entities (`&amp;amp;` -> `&`) that remain.
 */
function cleanText(raw: string | null): string {
	if (!raw) return "";
	const revealed = decodeEntities(stripCdata(raw));
	return decodeEntities(stripHtml(revealed)).trim();
}

function firstTag(block: string, tag: string): string | null {
	const match = block.match(
		new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
	);
	return match ? match[1] : null;
}

function allBlocks(xml: string, tag: string): string[] {
	const blocks: string[] = [];
	const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
	let match = regex.exec(xml);
	while (match !== null) {
		blocks.push(match[1]);
		match = regex.exec(xml);
	}
	return blocks;
}

/** Atom links are `<link href="..."/>`; prefer rel="alternate" then the first. */
function atomLink(block: string): string {
	const alternate = block.match(
		/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i,
	);
	if (alternate) return decodeEntities(alternate[1]);
	const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
	return any ? decodeEntities(any[1]) : "";
}

/**
 * Parse an RSS 2.0 or Atom feed document into a normalized shape. Resilient to
 * messy feeds — returns whatever it can find rather than throwing.
 */
export function parseFeed(xml: string): { title: string; items: FeedItem[] } {
	const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);

	// Feed title comes from the channel/feed <title>, not an item's.
	const channelBlock = firstTag(xml, "channel") ?? (isAtom ? xml : xml);
	const feedTitle = cleanText(firstTag(channelBlock, "title")) || "RSS Feed";

	const rawItems = isAtom ? allBlocks(xml, "entry") : allBlocks(xml, "item");

	const items: FeedItem[] = rawItems.map((block) => {
		const title = cleanText(firstTag(block, "title")) || "Untitled";
		const description = cleanText(
			firstTag(block, "description") ??
				firstTag(block, "summary") ??
				firstTag(block, "content"),
		);
		const link = isAtom ? atomLink(block) : cleanText(firstTag(block, "link"));
		const publishedAt = cleanText(
			firstTag(block, "pubDate") ??
				firstTag(block, "published") ??
				firstTag(block, "updated"),
		);
		return { title, description, link, publishedAt };
	});

	return { title: feedTitle, items };
}

/** Truncate to `max` chars on a word boundary, adding an ellipsis. */
export function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	const slice = text.slice(0, max);
	const lastSpace = slice.lastIndexOf(" ");
	const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
	return `${cut.trimEnd()}…`;
}
