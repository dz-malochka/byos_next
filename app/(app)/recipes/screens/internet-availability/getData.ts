import {
	type AvailabilityData,
	classifyResult,
	normalizeUrl,
} from "@/lib/recipes/availability";

export const dynamic = "force-dynamic";

export type { AvailabilityData };

type AvailabilityParams = {
	url?: string;
};

const TIMEOUT_MS = 8000;

function formatNow(): string {
	return new Date().toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Check whether the configured URL is reachable. Reachability is measured with
 * a real HTTP request; any received response (including 4xx/5xx) means the host
 * is up, while timeouts and network errors mean down.
 */
export default async function getAvailability(
	params: AvailabilityParams,
): Promise<AvailabilityData> {
	const url = normalizeUrl(params.url ?? "");
	if (!url) {
		return {
			url: "",
			status: "unconfigured",
			statusCode: null,
			latencyMs: null,
			detail: "Set a URL to check in the recipe settings",
			checkedAt: formatNow(),
		};
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	const startedAt = Date.now();

	try {
		const response = await fetch(url, {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			headers: {
				"User-Agent": "BYOS-Availability/1.0 (+https://usetrmnl.com)",
			},
			cache: "no-store",
		});
		const latencyMs = Date.now() - startedAt;
		const { status, detail } = classifyResult({
			statusCode: response.status,
			ok: response.ok,
			latencyMs,
		});
		return {
			url,
			status,
			statusCode: response.status,
			latencyMs,
			detail,
			checkedAt: formatNow(),
		};
	} catch (error) {
		const isAbort = error instanceof Error && error.name === "AbortError";
		const { status, detail } = classifyResult({
			statusCode: null,
			ok: false,
			latencyMs: null,
			error: isAbort
				? `Timed out after ${TIMEOUT_MS / 1000}s`
				: error instanceof Error
					? error.message
					: "Unreachable",
		});
		return {
			url,
			status,
			statusCode: null,
			latencyMs: null,
			detail,
			checkedAt: formatNow(),
		};
	} finally {
		clearTimeout(timeout);
	}
}
