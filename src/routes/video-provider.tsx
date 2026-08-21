import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/video-provider")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/video-providers" });
  },
});
