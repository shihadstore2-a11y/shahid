import { createFileRoute, redirect } from "@tanstack/react-router";
import { adminBeforeLoad } from "@/components/admin-guard";

export const Route = createFileRoute("/admin/video-provider")({
  beforeLoad: async ({ location }) => {
    await adminBeforeLoad({ location });
    throw redirect({ to: "/admin/video-providers" });
  },
});
