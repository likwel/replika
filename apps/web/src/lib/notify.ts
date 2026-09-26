// Notifications du navigateur (API Notification) : fonctionnent tant que ReplyKA est ouvert dans un onglet
export type NotifyPermission = NotificationPermission | "unsupported";

export const notifyPermission = (): NotifyPermission =>
  typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (notifyPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

export function showNotification(body: string, onClick?: () => void) {
  if (notifyPermission() !== "granted") return;
  const n = new Notification("ReplyKA", { body, tag: "replyka-attention" });
  n.onclick = () => {
    window.focus();
    onClick?.();
    n.close();
  };
}
