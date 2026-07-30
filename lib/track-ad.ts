/** Fire-and-forget click ping for an ad banner — keepalive so it survives the navigation it triggers. */
export function trackAdClick(id: string) {
  fetch("/api/ads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ id, event: "click" }),
  }).catch(() => {});
}
