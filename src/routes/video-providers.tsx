import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/video-providers")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/video-providers" });
  },
});
