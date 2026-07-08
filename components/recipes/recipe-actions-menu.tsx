"use client";

import { Copy, Eye, EyeOff, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	deleteUserRecipe,
	duplicateRecipe,
	renameRecipe,
	setRecipeHidden,
} from "@/app/actions/recipe-manage";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
	slug: string;
	name: string;
	/** User-owned copy / installed recipe — can be deleted. */
	owned: boolean;
	hidden: boolean;
	/** After deletion, navigate here (e.g. "/recipes"). Otherwise just refresh. */
	deletedHref?: string;
	/** Visual style of the trigger. */
	variant?: "icon" | "button";
};

export function RecipeActionsMenu({
	slug,
	name,
	owned,
	hidden,
	deletedHref,
	variant = "icon",
}: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [renameOpen, setRenameOpen] = useState(false);
	const [renameValue, setRenameValue] = useState(name);

	const run = (
		fn: () => Promise<{ success: boolean; error?: string; slug?: string }>,
		onOk?: (slug?: string) => void,
	) => {
		startTransition(async () => {
			const result = await fn();
			if (!result.success) {
				toast.error(result.error ?? "Something went wrong");
				return;
			}
			onOk?.(result.slug);
			router.refresh();
		});
	};

	const handleDuplicate = () =>
		run(
			() => duplicateRecipe(slug),
			(newSlug) => {
				toast.success("Recipe duplicated");
				if (newSlug) router.push(`/recipes/${newSlug}`);
			},
		);

	const handleRename = () => {
		setRenameValue(name);
		setRenameOpen(true);
	};

	const submitRename = () => {
		run(
			() => renameRecipe(slug, renameValue),
			() => {
				toast.success("Recipe renamed");
				setRenameOpen(false);
			},
		);
	};

	const handleToggleHidden = () =>
		run(
			() => setRecipeHidden(slug, !hidden),
			() => toast.success(hidden ? "Recipe shown" : "Recipe hidden"),
		);

	const handleDelete = () => {
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		run(
			() => deleteUserRecipe(slug),
			() => {
				toast.success("Recipe deleted");
				if (deletedHref) router.push(deletedHref);
			},
		);
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					{variant === "icon" ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 bg-white/85 backdrop-blur hover:bg-white"
							aria-label="Recipe actions"
							disabled={isPending}
							onClick={(e) => e.stopPropagation()}
						>
							<MoreVertical className="h-4 w-4" />
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled={isPending}>
							<MoreVertical className="mr-1 h-4 w-4" />
							Actions
						</Button>
					)}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
					<DropdownMenuItem onSelect={handleDuplicate}>
						<Copy className="mr-2 h-4 w-4" />
						Duplicate
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleRename}>
						<Pencil className="mr-2 h-4 w-4" />
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleToggleHidden}>
						{hidden ? (
							<Eye className="mr-2 h-4 w-4" />
						) : (
							<EyeOff className="mr-2 h-4 w-4" />
						)}
						{hidden ? "Show in menu" : "Hide from menu"}
					</DropdownMenuItem>
					{owned && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onSelect={handleDelete}>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={renameOpen} onOpenChange={setRenameOpen}>
				<DialogContent onClick={(e) => e.stopPropagation()}>
					<DialogHeader>
						<DialogTitle>Rename recipe</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="recipe-rename">Name</Label>
						<Input
							id="recipe-rename"
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							placeholder={name}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									submitRename();
								}
							}}
						/>
						<p className="text-xs text-muted-foreground">
							Leave blank to reset to the original name.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRenameOpen(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button onClick={submitRename} disabled={isPending}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
