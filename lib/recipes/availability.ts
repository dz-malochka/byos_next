// Pure helpers for the "Internet availability" recipe. No network/Next deps so
// the classification logic is unit-testable in isolation.

export type AvailabilityStatus = "up" | "down" | "unconfigured";

export type AvailabilityData = {
	url: string;
	status: AvailabilityStatus;
	/** HTTP status code when a response was received, else null. */
	statusCode: number | null;
	/** Round-trip time in milliseconds when reachable, else null. */
	latencyMs: number | null;
	/** Short human-readable detail (status text or error reason). */
	detail: string;
	checkedAt: string;
};

/**
 * Normalize a user-entered host/URL into a fetchable URL. Bare hosts get an
 * https:// prefix. Returns null if there's nothing usable.
 */
export function normalizeUrl(raw: string): string | null {
	const trimmed = (raw ?? "").trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/**
 * Classify a check result. A response is "up" for any status the server
 * actually returned (even 4xx/5xx means the host is reachable); only network
 * failures / timeouts are "down". `ok` mirrors `Response.ok` (2xx) for detail.
 */
export function classifyResult(input: {
	statusCode: number | null;
	ok: boolean;
	latencyMs: number | null;
	error?: string;
}): Pick<AvailabilityData, "status" | "detail"> {
	if (input.statusCode === null) {
		return { status: "down", detail: input.error ?? "No response" };
	}
	if (input.statusCode >= 500) {
		return { status: "up", detail: `Server error ${input.statusCode}` };
	}
	if (input.statusCode >= 400) {
		return { status: "up", detail: `Reachable (HTTP ${input.statusCode})` };
	}
	return {
		status: "up",
		detail: input.ok ? "Online" : `HTTP ${input.statusCode}`,
	};
}
