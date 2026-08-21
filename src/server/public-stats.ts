import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicSavingsStats = {
  users: number;
  posts: number;
};

export const getPublicSavingsStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSavingsStats | null> => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, count, error } = await supabaseAdmin
        .from("generations")
        .select("user_id", { count: "exact", head: false })
        .gte("created_at", since.toISOString())
        .limit(5000);

      if (error) {
        console.error("Public savings stats failed", { message: error.message });
        return null;
      }

      return {
        posts: count ?? 0,
        users: new Set((data ?? []).map((row) => row.user_id)).size,
      };
    } catch (error) {
      console.error("Public savings stats crashed", error);
      return null;
    }
  }
);