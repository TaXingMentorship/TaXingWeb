"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFavorite, listMyFavoriteIds, removeFavorite } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export const FAVORITES_KEY = ["portal", "favorites"] as const;

/**
 * The signed-in user's bookmarked members, shared by the directory and the
 * home page. Keyed on the real account: a persona is a display lens and must
 * neither read nor write someone else's bookmarks. Toggling is optimistic and
 * rolls back if the write fails.
 */
export function useFavorites() {
  const { realUser } = usePortalSession();
  const queryClient = useQueryClient();
  const key = [...FAVORITES_KEY, realUser?.id] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: listMyFavoriteIds,
    enabled: Boolean(realUser),
  });
  const ids = query.data ?? [];

  const toggle = useMutation({
    mutationFn: async ({ targetId, favorite }: { targetId: string; favorite: boolean }) => {
      if (!realUser) return;
      if (favorite) await addFavorite(realUser.id, targetId);
      else await removeFavorite(realUser.id, targetId);
    },
    onMutate: async ({ targetId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (current = []) =>
        favorite
          ? [targetId, ...current.filter((id) => id !== targetId)]
          : current.filter((id) => id !== targetId),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    ids,
    isFavorite: (id: string) => ids.includes(id),
    setFavorite: (targetId: string, favorite: boolean) => toggle.mutate({ targetId, favorite }),
    failed: toggle.isError,
    /** Nobody bookmarks themselves; the table forbids it too. */
    canFavorite: (id: string) => Boolean(realUser) && realUser!.id !== id,
  };
}
