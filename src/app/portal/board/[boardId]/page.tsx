import { redirect } from "next/navigation";

/**
 * The board list and detail pages were merged into a single tabbed wall at
 * /portal/board. This route is kept so existing links stay valid.
 */
export default async function BoardDetailRedirect({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  redirect(`/portal/board?board=${encodeURIComponent(boardId)}`);
}
