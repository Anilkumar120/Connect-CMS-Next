const THEME_UPDATE_EVENT = "connect-theme-updated";
const THEME_UPDATE_CHANNEL = "connect-theme-updates";

export function publishThemeUpdate() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(THEME_UPDATE_EVENT));

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(THEME_UPDATE_CHANNEL);
    channel.postMessage("updated");
    channel.close();
  }
}

export function subscribeToThemeUpdates(onUpdate: () => void) {
  if (typeof window === "undefined") return () => {};

  const listener = () => onUpdate();
  window.addEventListener(THEME_UPDATE_EVENT, listener);

  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(THEME_UPDATE_CHANNEL)
      : null;

  channel?.addEventListener("message", listener);

  return () => {
    window.removeEventListener(THEME_UPDATE_EVENT, listener);
    channel?.removeEventListener("message", listener);
    channel?.close();
  };
}
