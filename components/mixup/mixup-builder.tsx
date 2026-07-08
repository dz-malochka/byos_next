"use client";

import {
	ArrowLeft,
	LayoutGrid,
	ListVideo,
	Monitor,
	Save,
	SplitSquareHorizontal,
	SplitSquareVertical,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import { ScreenPreviewImage } from "@/components/common/screen-preview-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getOrientedDeviceDimensions } from "@/lib/device/dimensions";
import {
	LAYOUT_OPTIONS,
	type MixupLayoutId,
	type SlotAssignment,
} from "@/lib/mixup/constants";
import {
	clampRatio,
	collectLeafIds,
	flattenTree,
	type LeafRect,
	type MixupNode,
	presetToTree,
	removeLeaf,
	splitLeaf,
	updateRatio,
} from "@/lib/mixup/layout-tree";
import {
	buildBitmapPreviewSrc,
	buildScreenPreviewSrc,
} from "@/lib/render/preview-image";
import { cn } from "@/lib/utils";

type MixupRecipe = {
	id: string;
	slug: string;
	title: string;
	description?: string;
};

type MixupPlaylist = {
	id: string;
	name: string;
};

type MixupDevice = {
	id: string;
	name: string;
	model: string | null;
	palette_id: string | null;
	screen_width: number | null;
	screen_height: number | null;
	screen_orientation: string | null;
};

/** Device profile passed to leaf previews so they render on the chosen device. */
type PreviewProfile = { model: string | null; palette_id: string | null };

export type MixupBuilderData = {
	id?: string;
	name: string;
	layout_id: MixupLayoutId | string;
	layout_tree: MixupNode;
	assignments: Record<string, SlotAssignment>;
};

export type MixupBuilderInitialData = {
	id?: string;
	name: string;
	layout_id: MixupLayoutId | string;
	layout_tree?: MixupNode;
	assignments: Record<string, SlotAssignment>;
};

interface MixupBuilderProps {
	recipes: MixupRecipe[];
	playlists: MixupPlaylist[];
	devices: MixupDevice[];
	initialData?: MixupBuilderInitialData;
	onSave?: (data: MixupBuilderData) => void;
	onCancel?: () => void;
	isSaving?: boolean;
}

const encodeAssignment = (a?: SlotAssignment): string =>
	a ? `${a.kind}:${a.id}` : "none";

const decodeAssignment = (value: string): SlotAssignment | null => {
	if (value === "none") return null;
	const idx = value.indexOf(":");
	if (idx < 0) return null;
	const kind = value.slice(0, idx);
	const id = value.slice(idx + 1);
	if (kind === "recipe" || kind === "playlist") return { kind, id };
	return null;
};

const DIVIDER_PX = 6;

/** Small proportional thumbnail of any layout tree (used for template tiles). */
const TreeThumbnail = ({
	tree,
	active,
}: {
	tree: MixupNode;
	active: boolean;
}) => {
	const rects = flattenTree(tree);
	return (
		<div className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/40">
			{rects.map((r, i) => (
				<div
					key={r.id}
					className={cn(
						"absolute rounded-[2px] border border-background",
						active && i === 0 ? "bg-primary/60" : "bg-foreground/15",
					)}
					style={{
						left: `${r.relX * 100}%`,
						top: `${r.relY * 100}%`,
						width: `${r.relWidth * 100}%`,
						height: `${r.relHeight * 100}%`,
					}}
				/>
			))}
		</div>
	);
};

/**
 * Recursively render the layout tree. Leaves are clickable areas that preview
 * their assigned recipe; split nodes render a draggable divider between their
 * two children so the user can resize the split ratio.
 */
function SplitView({
	node,
	assignments,
	recipeMap,
	playlistMap,
	rectMap,
	activeSlot,
	onActivate,
	onRatioChange,
	canvasW,
	canvasH,
	deviceProfile,
}: {
	node: MixupNode;
	assignments: Record<string, SlotAssignment>;
	recipeMap: Record<string, MixupRecipe>;
	playlistMap: Record<string, MixupPlaylist>;
	rectMap: Record<string, LeafRect>;
	activeSlot: string | null;
	onActivate: (leafId: string) => void;
	onRatioChange: (nodeId: string, ratio: number) => void;
	canvasW: number;
	canvasH: number;
	deviceProfile: PreviewProfile | null;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	if (node.type === "leaf") {
		const assignment = assignments[node.id];
		const recipe =
			assignment?.kind === "recipe" ? recipeMap[assignment.id] : null;
		const playlist =
			assignment?.kind === "playlist" ? playlistMap[assignment.id] : null;
		const isActive = activeSlot === node.id;
		const rect = rectMap[node.id];
		const previewWidth = Math.max(
			1,
			Math.round((rect?.relWidth ?? 1) * canvasW),
		);
		const previewHeight = Math.max(
			1,
			Math.round((rect?.relHeight ?? 1) * canvasH),
		);
		// With a device selected, render the slot through that device's profile
		// (model + palette) so the preview matches its real display.
		const recipeSrc =
			recipe &&
			(deviceProfile
				? buildScreenPreviewSrc(
						recipe.slug,
						deviceProfile,
						previewWidth,
						previewHeight,
					)
				: buildBitmapPreviewSrc(recipe.slug, {
						width: previewWidth,
						height: previewHeight,
					}));

		return (
			<button
				type="button"
				onClick={() => onActivate(node.id)}
				className={cn(
					"group relative block h-full w-full cursor-pointer overflow-hidden border border-black/40 p-0 text-left",
					isActive && "z-10 ring-2 ring-primary ring-inset",
				)}
				aria-label={`Edit ${node.label ?? "area"}`}
			>
				{recipe && recipeSrc ? (
					<ScreenPreviewImage
						src={recipeSrc}
						alt={`${recipe.title} preview`}
						width={previewWidth}
						height={previewHeight}
						className="absolute inset-0 h-full w-full"
					/>
				) : playlist ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center">
						<ListVideo className="h-5 w-5 text-muted-foreground" />
						<span className="text-[10px] font-semibold text-foreground">
							{playlist.name}
						</span>
						<span className="text-[9px] uppercase tracking-wider text-muted-foreground">
							Playlist
						</span>
					</div>
				) : (
					<div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						Empty
					</div>
				)}
				<div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
					{node.label ?? "Area"}
				</div>
			</button>
		);
	}

	const isRow = node.direction === "row";
	const ratio = clampRatio(node.ratio);

	const handleDrag = (clientPos: number) => {
		const el = containerRef.current;
		if (!el) return;
		const box = el.getBoundingClientRect();
		const start = isRow ? box.left : box.top;
		const length = isRow ? box.width : box.height;
		if (length <= 0) return;
		onRatioChange(node.id, (clientPos - start) / length);
	};

	return (
		<div
			ref={containerRef}
			className="flex h-full w-full"
			style={{ flexDirection: isRow ? "row" : "column" }}
		>
			<div style={{ flex: `${ratio} 1 0`, minWidth: 0, minHeight: 0 }}>
				<SplitView
					node={node.children[0]}
					assignments={assignments}
					recipeMap={recipeMap}
					playlistMap={playlistMap}
					rectMap={rectMap}
					activeSlot={activeSlot}
					onActivate={onActivate}
					onRatioChange={onRatioChange}
					canvasW={canvasW}
					canvasH={canvasH}
					deviceProfile={deviceProfile}
				/>
			</div>
			<button
				type="button"
				aria-label="Resize areas (use arrow keys to adjust)"
				onPointerDown={(e) => {
					e.preventDefault();
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={(e) => {
					if (e.currentTarget.hasPointerCapture(e.pointerId)) {
						handleDrag(isRow ? e.clientX : e.clientY);
					}
				}}
				onKeyDown={(e) => {
					const dec = isRow ? "ArrowLeft" : "ArrowUp";
					const inc = isRow ? "ArrowRight" : "ArrowDown";
					if (e.key === dec) onRatioChange(node.id, ratio - 0.05);
					else if (e.key === inc) onRatioChange(node.id, ratio + 0.05);
				}}
				className={cn(
					"z-20 flex shrink-0 items-center justify-center border-0 bg-primary/20 p-0 transition-colors hover:bg-primary/50",
					isRow ? "cursor-col-resize" : "cursor-row-resize",
				)}
				style={
					isRow
						? { width: DIVIDER_PX, height: "100%" }
						: { height: DIVIDER_PX, width: "100%" }
				}
			>
				<span
					className={cn(
						"rounded-full bg-primary/70",
						isRow ? "h-6 w-0.5" : "h-0.5 w-6",
					)}
				/>
			</button>
			<div style={{ flex: `${1 - ratio} 1 0`, minWidth: 0, minHeight: 0 }}>
				<SplitView
					node={node.children[1]}
					assignments={assignments}
					recipeMap={recipeMap}
					playlistMap={playlistMap}
					rectMap={rectMap}
					activeSlot={activeSlot}
					onActivate={onActivate}
					onRatioChange={onRatioChange}
					canvasW={canvasW}
					canvasH={canvasH}
					deviceProfile={deviceProfile}
				/>
			</div>
		</div>
	);
}

const percentLabel = (rect?: LeafRect) => {
	if (!rect) return "";
	const w = Math.round(rect.relWidth * 100);
	const h = Math.round(rect.relHeight * 100);
	return `${w}% × ${h}%`;
};

function initialTree(initialData?: MixupBuilderInitialData): MixupNode {
	if (initialData?.layout_tree) return initialData.layout_tree;
	if (initialData?.layout_id) return presetToTree(initialData.layout_id);
	return presetToTree(LAYOUT_OPTIONS[0].id);
}

export function MixupBuilder({
	recipes,
	playlists,
	devices,
	initialData,
	onSave,
	onCancel,
	isSaving = false,
}: MixupBuilderProps) {
	const recipeMap = useMemo(
		() =>
			recipes.reduce<Record<string, MixupRecipe>>((acc, recipe) => {
				acc[recipe.id] = recipe;
				return acc;
			}, {}),
		[recipes],
	);
	const playlistMap = useMemo(
		() =>
			playlists.reduce<Record<string, MixupPlaylist>>((acc, playlist) => {
				acc[playlist.id] = playlist;
				return acc;
			}, {}),
		[playlists],
	);

	const [name, setName] = useState(initialData?.name ?? "");
	const [layoutId, setLayoutId] = useState<MixupLayoutId | string>(
		initialData?.layout_id ?? LAYOUT_OPTIONS[0].id,
	);
	const [tree, setTree] = useState<MixupNode>(() => initialTree(initialData));
	const [assignments, setAssignments] = useState<
		Record<string, SlotAssignment>
	>(() => initialData?.assignments ?? {});
	const [activeSlot, setActiveSlot] = useState<string | null>(null);
	// Preview device — drives the frame aspect ratio and the profile each slot
	// renders with. "default" = generic landscape preview, no specific device.
	// When the user has exactly one device, preselect it.
	const [previewDeviceId, setPreviewDeviceId] = useState<string>(() =>
		devices.length === 1 ? devices[0].id : "default",
	);

	const selectedDevice = useMemo(
		() => devices.find((d) => d.id === previewDeviceId) ?? null,
		[devices, previewDeviceId],
	);
	const deviceProfile: PreviewProfile | null = selectedDevice
		? { model: selectedDevice.model, palette_id: selectedDevice.palette_id }
		: null;
	const {
		width: canvasW,
		height: canvasH,
		isPortrait,
	} = getOrientedDeviceDimensions(selectedDevice);

	useEffect(() => {
		if (initialData) {
			setName(initialData.name);
			setLayoutId(initialData.layout_id);
			setTree(initialTree(initialData));
			setAssignments(initialData.assignments ?? {});
		}
	}, [initialData]);

	const leaves = useMemo(() => flattenTree(tree), [tree]);
	const rectMap = useMemo(() => {
		const map: Record<string, LeafRect> = {};
		for (const r of leaves) map[r.id] = r;
		return map;
	}, [leaves]);

	// Drop assignments for areas that no longer exist.
	useEffect(() => {
		const ids = new Set(collectLeafIds(tree));
		setAssignments((prev) => {
			const next: Record<string, SlotAssignment> = {};
			for (const [k, v] of Object.entries(prev)) if (ids.has(k)) next[k] = v;
			return Object.keys(next).length === Object.keys(prev).length
				? prev
				: next;
		});
	}, [tree]);

	useEffect(() => {
		if (activeSlot && !rectMap[activeSlot]) setActiveSlot(null);
	}, [rectMap, activeSlot]);

	const applyTemplate = (id: MixupLayoutId | string) => {
		setLayoutId(id);
		setTree(presetToTree(id));
	};

	const handleAssignmentChange = (leafId: string, value: string) => {
		const assignment = decodeAssignment(value);
		setAssignments((prev) => {
			const next = { ...prev };
			if (assignment) next[leafId] = assignment;
			else delete next[leafId];
			return next;
		});
	};

	const handleSplit = (leafId: string, direction: "row" | "column") => {
		setTree((prev) => splitLeaf(prev, leafId, direction));
	};

	const handleRemove = (leafId: string) => {
		setTree((prev) => removeLeaf(prev, leafId));
		setActiveSlot(null);
	};

	const handleRatioChange = (nodeId: string, ratio: number) => {
		setTree((prev) => updateRatio(prev, nodeId, ratio));
	};

	const handleSave = () => {
		if (!name.trim()) return;
		onSave?.({
			id: initialData?.id,
			name: name.trim(),
			layout_id: layoutId,
			layout_tree: tree,
			assignments,
		});
	};

	const filledSlots = leaves.filter((s) => assignments[s.id]).length;
	const isValid = name.trim().length > 0;
	const canRemove = leaves.length > 1;

	return (
		<div className="flex flex-col gap-4">
			{/* Top bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{onCancel && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onCancel}
							aria-label="Back to mixups"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							{initialData?.id ? "Editing mixup" : "New mixup"}
						</span>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Untitled mixup"
							className={cn(
								"h-auto border-0 bg-transparent p-0 text-lg font-semibold shadow-none",
								"focus-visible:ring-0 focus-visible:ring-offset-0",
							)}
						/>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden text-right text-xs text-muted-foreground sm:block">
						<div className="font-semibold tabular-nums text-foreground">
							{filledSlots}/{leaves.length}
						</div>
						<div>areas filled</div>
					</div>
					{onCancel && (
						<Button variant="outline" onClick={onCancel} disabled={isSaving}>
							Cancel
						</Button>
					)}
					<Button onClick={handleSave} disabled={!isValid || isSaving}>
						<Save className="mr-2 h-4 w-4" />
						{isSaving ? "Saving…" : initialData?.id ? "Update" : "Create"}
					</Button>
				</div>
			</div>

			{/* Split: preview left, configuration right */}
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				{/* Live preview */}
				<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
						<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Live preview
						</h3>
						<div className="flex items-center gap-2">
							{devices.length > 0 && (
								<Select
									value={previewDeviceId}
									onValueChange={setPreviewDeviceId}
								>
									<SelectTrigger
										className="h-7 w-[260px] max-w-full text-xs"
										aria-label="Preview device"
									>
										<Monitor className="mr-1 h-3 w-3 text-muted-foreground" />
										<SelectValue placeholder="Preview device" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">Default display</SelectItem>
										<SelectGroup>
											<SelectLabel>Devices</SelectLabel>
											{devices.map((device) => {
												const dims = getOrientedDeviceDimensions(device);
												return (
													<SelectItem key={device.id} value={device.id}>
														{device.name}
														<span className="ml-1 text-muted-foreground tabular-nums">
															{dims.width}×{dims.height}
														</span>
													</SelectItem>
												);
											})}
										</SelectGroup>
									</SelectContent>
								</Select>
							)}
							<span className="text-[11px] tabular-nums text-muted-foreground">
								{leaves.length} areas
							</span>
						</div>
					</div>
					<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
						<div
							className={cn(
								"w-full",
								isPortrait ? "max-w-[320px]" : "max-w-[640px]",
							)}
						>
							<DeviceFrame
								size="lg"
								portrait={isPortrait}
								screenAspectRatio={`${canvasW} / ${canvasH}`}
							>
								<div className="h-full w-full touch-none select-none">
									<SplitView
										node={tree}
										assignments={assignments}
										recipeMap={recipeMap}
										playlistMap={playlistMap}
										rectMap={rectMap}
										activeSlot={activeSlot}
										onActivate={setActiveSlot}
										onRatioChange={handleRatioChange}
										canvasW={canvasW}
										canvasH={canvasH}
										deviceProfile={deviceProfile}
									/>
								</div>
							</DeviceFrame>
						</div>
					</div>
				</section>

				{/* Configuration */}
				<section className="flex flex-col gap-4">
					{/* Template picker */}
					<div className="overflow-hidden rounded-2xl border bg-card">
						<div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
							<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
							<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Start from a template
							</h3>
						</div>
						<div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
							{LAYOUT_OPTIONS.map((option) => (
								<button
									key={option.id}
									type="button"
									onClick={() => applyTemplate(option.id)}
									className={cn(
										"flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all",
										option.id === layoutId
											? "border-primary bg-primary/5"
											: "border-transparent bg-card hover:border-border",
									)}
								>
									<TreeThumbnail
										tree={presetToTree(option.id)}
										active={option.id === layoutId}
									/>
									<span className="text-[10px] font-medium capitalize text-muted-foreground">
										{option.id.replace(/-/g, " ")}
									</span>
								</button>
							))}
						</div>
						<p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
							Pick a starting point, then split and resize areas freely below.
						</p>
					</div>

					{/* Areas */}
					<div className="overflow-hidden rounded-2xl border bg-card">
						<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
							<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Areas
							</h3>
							<span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
								{filledSlots}/{leaves.length}
							</span>
						</div>
						<div className="divide-y">
							{leaves.map((leafRect, index) => {
								const assignment = assignments[leafRect.id];
								const recipe =
									assignment?.kind === "recipe"
										? recipeMap[assignment.id]
										: null;
								const isActive = activeSlot === leafRect.id;

								return (
									<div
										key={leafRect.id}
										className={cn(
											"flex w-full items-start gap-3 px-4 py-3 transition-colors",
											isActive ? "bg-primary/5" : "hover:bg-muted/40",
										)}
									>
										<button
											type="button"
											onClick={() => setActiveSlot(leafRect.id)}
											aria-pressed={isActive}
											aria-label={`Activate area ${index + 1}`}
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-[11px] font-semibold tabular-nums text-muted-foreground hover:bg-muted"
										>
											{index + 1}
										</button>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2 text-xs">
												<span className="font-semibold">
													{leafRect.label ?? `Area ${index + 1}`}
												</span>
												<span className="text-[10px] tabular-nums text-muted-foreground">
													{percentLabel(leafRect)}
												</span>
											</div>
											<div className="mt-1.5">
												<Select
													value={encodeAssignment(assignment)}
													onValueChange={(value) =>
														handleAssignmentChange(leafRect.id, value)
													}
												>
													<SelectTrigger className="h-8 w-full text-xs">
														<SelectValue placeholder="Choose content" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="none">Nothing</SelectItem>
														<SelectGroup>
															<SelectLabel>Recipes</SelectLabel>
															{recipes.map((option) => (
																<SelectItem
																	key={option.id}
																	value={`recipe:${option.id}`}
																>
																	{option.title}
																</SelectItem>
															))}
														</SelectGroup>
														{playlists.length > 0 && (
															<SelectGroup>
																<SelectLabel>Playlists</SelectLabel>
																{playlists.map((option) => (
																	<SelectItem
																		key={option.id}
																		value={`playlist:${option.id}`}
																	>
																		{option.name}
																	</SelectItem>
																))}
															</SelectGroup>
														)}
													</SelectContent>
												</Select>
											</div>
											<div className="mt-1.5 flex items-center gap-1">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-7 gap-1 px-2 text-[11px]"
													onClick={() => handleSplit(leafRect.id, "row")}
													title="Split into left and right"
												>
													<SplitSquareHorizontal className="h-3 w-3" />
													Split ⬌
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-7 gap-1 px-2 text-[11px]"
													onClick={() => handleSplit(leafRect.id, "column")}
													title="Split into top and bottom"
												>
													<SplitSquareVertical className="h-3 w-3" />
													Split ⬍
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="ml-auto h-7 px-2 text-[11px] text-destructive hover:text-destructive"
													disabled={!canRemove}
													onClick={() => handleRemove(leafRect.id)}
													title="Remove this area"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
											{recipe?.description && (
												<p className="mt-1 truncate text-[11px] text-muted-foreground">
													{recipe.description}
												</p>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
