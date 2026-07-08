/// <reference types="jest" />
import { parseFeed, truncate } from "@/lib/recipes/rss-parser";

const RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[First & foremost]]></title>
      <link>https://example.com/1</link>
      <description>&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;</description>
      <pubDate>Mon, 06 Jul 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second post</title>
      <link>https://example.com/2</link>
      <description>Just text</description>
      <pubDate>Sun, 05 Jul 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <entry>
    <title>Atom Entry One</title>
    <link rel="alternate" href="https://atom.example/1"/>
    <summary>Summary text here</summary>
    <published>2026-07-06T10:00:00Z</published>
  </entry>
</feed>`;

describe("parseFeed (RSS 2.0)", () => {
	const parsed = parseFeed(RSS);

	it("reads the channel title, not an item title", () => {
		expect(parsed.title).toBe("Example Blog");
	});

	it("extracts each item's fields", () => {
		expect(parsed.items).toHaveLength(2);
		expect(parsed.items[0].link).toBe("https://example.com/1");
		expect(parsed.items[0].publishedAt).toContain("06 Jul 2026");
	});

	it("unwraps CDATA and decodes entities in titles", () => {
		expect(parsed.items[0].title).toBe("First & foremost");
	});

	it("strips HTML and decodes nested entities in descriptions", () => {
		expect(parsed.items[0].description).toBe("Hello & welcome");
	});
});

describe("parseFeed (Atom)", () => {
	const parsed = parseFeed(ATOM);

	it("reads the feed title and entry via <entry>/<summary>", () => {
		expect(parsed.title).toBe("Atom Example");
		expect(parsed.items).toHaveLength(1);
		expect(parsed.items[0].title).toBe("Atom Entry One");
		expect(parsed.items[0].description).toBe("Summary text here");
	});

	it("resolves the alternate link href", () => {
		expect(parsed.items[0].link).toBe("https://atom.example/1");
	});
});

describe("parseFeed (malformed)", () => {
	it("returns a safe default for junk input", () => {
		const parsed = parseFeed("not xml at all");
		expect(parsed.title).toBe("RSS Feed");
		expect(parsed.items).toEqual([]);
	});
});

describe("truncate", () => {
	it("leaves short text untouched", () => {
		expect(truncate("short", 140)).toBe("short");
	});

	it("cuts on a word boundary and adds an ellipsis", () => {
		const result = truncate("the quick brown fox jumps over", 15);
		expect(result.endsWith("…")).toBe(true);
		expect(result.length).toBeLessThanOrEqual(16);
		expect(result).not.toContain("jum"); // cut mid-word avoided
	});
});
