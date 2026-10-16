/* Admin withdrawal notification — a phone-style notification card that
   drops from the top of the screen the moment an ADMIN instant
   withdrawal completes (POST /api/wallet/withdraw → Completed).
   Owner order 2026-10-16, built from his uploaded Android/iOS popup
   designs: Android card on Android/desktop, iOS glass banner on
   iPhone/iPad, styled per network (MTN yellow, Telecel red,
   AirtelTigo blue). SITE-BRANDED by design and fed ONLY with real
   data from the withdrawal itself — amount, network, destination and
   the backend transaction reference. Players never see it: their
   withdrawals go to review and keep the in-page success card. */

export interface WithdrawNotifyData {
  siteName: string;
  brandColor: string;
  amountText: string;
  network: string; // MTN | TELECEL | VODAFONE | AIRTELTIGO | BANK_TRANSFER | CARD
  toNumber: string;
  toName?: string;
  reference?: string; // the site's own transaction id from the withdraw response
  balanceText?: string; // wallet balance after, when the response carries it
}

const NETWORK_META: Record<string, { label: string; color: string; initial: string; dark: boolean }> = {
  MTN: { label: "MTN Mobile Money", color: "#FFCB05", initial: "M", dark: true },
  TELECEL: { label: "Telecel Cash", color: "#E4002B", initial: "T", dark: false },
  VODAFONE: { label: "Telecel Cash", color: "#E4002B", initial: "T", dark: false },
  AIRTELTIGO: { label: "AirtelTigo Money", color: "#3B82C4", initial: "A", dark: false },
  BANK_TRANSFER: { label: "Bank Transfer", color: "#64748B", initial: "B", dark: false },
  CARD: { label: "Card", color: "#64748B", initial: "C", dark: false },
};

const AUTO_DISMISS_MS = 6000;
const STYLE_ID = "wdn-style";
const STACK_ID = "wdn-stack";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function ensureStack(): HTMLElement {
  let stack = document.getElementById(STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = STACK_ID;
    document.body.appendChild(stack);
  }
  return stack;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function notifyAdminWithdrawal(data: WithdrawNotifyData): void {
  if (typeof document === "undefined") return;
  ensureStyle();
  const stack = ensureStack();
  stack.innerHTML = ""; // one at a time — a new withdrawal replaces the old card
  const meta = NETWORK_META[String(data.network || "").toUpperCase()]
    ?? { label: String(data.network || "Mobile Money"), color: "#64748B", initial: "W", dark: false };
  const ios = isIOS();

  const card = el("div", `wdn-card${ios ? " wdn-ios" : ""}`);
  card.setAttribute("role", "status");

  // Header: site app identity + time + chevron (mirrors the phone designs)
  const head = el("div", "wdn-head");
  const app = el("div", "wdn-app");
  const appIcon = el("span", "wdn-app-icon", data.siteName.slice(0, 1).toUpperCase());
  appIcon.style.background = data.brandColor;
  app.append(appIcon, el("span", "wdn-app-name", data.siteName), el("span", "wdn-dot", "•"), el("span", "wdn-now", "now"));
  const headIcons = el("span", "wdn-head-icons");
  headIcons.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4.5a1.5 1.5 0 0 0-3 0v.7A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg><svg class="wdn-chevron-svg" viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>`;
  head.append(app, headIcons);
  card.appendChild(head);

  // Main row: network avatar + title + one-line summary
  const main = el("div", "wdn-main");
  const avatar = el("div", "wdn-avatar", meta.initial);
  avatar.style.background = meta.color;
  avatar.style.color = meta.dark ? "#1f1f1f" : "#fff";
  const text = el("div", "wdn-text");
  text.appendChild(el("div", "wdn-title", "Withdrawal completed"));
  const messageParts = [`Withdrawal of ${data.amountText} to ${data.toNumber}${data.toName ? ` (${data.toName})` : ""} via ${meta.label} was completed.`];
  if (data.balanceText) messageParts.push(`Wallet balance: ${data.balanceText}.`);
  if (data.reference) messageParts.push(`Transaction ref: ${data.reference}.`);
  text.appendChild(el("div", "wdn-body", messageParts.join(" ")));
  main.append(avatar, text);
  card.appendChild(main);

  stack.appendChild(card);

  // Partial popup only — exactly what the source design is: the card
  // drops in, dwells, and leaves. No expanded/full view. Tap dismisses.
  const timer = window.setTimeout(() => dismiss(), AUTO_DISMISS_MS);
  function dismiss(): void {
    if (!card.isConnected || card.classList.contains("wdn-leaving")) return;
    window.clearTimeout(timer);
    card.classList.add("wdn-leaving");
    window.setTimeout(() => card.remove(), 330);
  }
  let wasDrag = false;
  card.addEventListener("click", () => {
    if (wasDrag) { wasDrag = false; return; }
    dismiss();
  });

  let startY: number | null = null;
  let dy = 0;
  card.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    startY = e.clientY; dy = 0;
    card.classList.add("wdn-dragging");
    try { card.setPointerCapture(e.pointerId); } catch { /* noop */ }
  });
  card.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    dy = e.clientY - startY;
    card.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = () => {
    if (startY === null) return;
    card.classList.remove("wdn-dragging");
    if (dy < -60) dismiss();
    else { card.style.transform = ""; wasDrag = Math.abs(dy) > 8; }
    startY = null;
  };
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);
}

const CSS = `
#wdn-stack{position:fixed;top:10px;left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 16px));z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:Roboto,system-ui,-apple-system,'Segoe UI',sans-serif}
.wdn-card{pointer-events:auto;border-radius:24px;background:#f4f5f7;color:#1f1f1f;box-shadow:0 14px 36px rgba(0,0,0,.5);overflow:hidden;cursor:pointer;animation:wdn-drop .55s cubic-bezier(.3,1.4,.4,1) both;transition:transform .35s cubic-bezier(.3,1.2,.4,1),opacity .3s ease;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.wdn-card.wdn-ios{border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.28)),rgba(232,232,238,.72);-webkit-backdrop-filter:blur(28px) saturate(200%);backdrop-filter:blur(28px) saturate(200%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.6),inset 0 1px 0 rgba(255,255,255,.65),0 10px 30px rgba(0,0,0,.22);animation-name:wdn-drop-ios}
@keyframes wdn-drop{0%{transform:translateY(-140%) scale(.92);opacity:0}60%{transform:translateY(6px) scale(1.01);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes wdn-drop-ios{0%{transform:translateY(-130%);opacity:0}60%{transform:translateY(7px);opacity:1}80%{transform:translateY(-2px);opacity:1}100%{transform:translateY(0);opacity:1}}
.wdn-card.wdn-leaving{animation:wdn-lift .3s cubic-bezier(.5,0,.8,.4) both}
@keyframes wdn-lift{to{transform:translateY(-150%) scale(.94);opacity:0}}
.wdn-card.wdn-dragging{transition:none}
.wdn-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0}
.wdn-app{display:flex;align-items:center;gap:7px;min-width:0}
.wdn-app-icon{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;color:#fff;font-size:11px;font-weight:800;flex-shrink:0}
.wdn-app-name{font-size:11.5px;font-weight:600;color:#5f6368}
.wdn-dot{font-size:11.5px;color:#9aa0a6}
.wdn-now{font-size:11.5px;color:#5f6368}
.wdn-main{display:flex;gap:12px;padding:8px 14px 12px;align-items:flex-start}
.wdn-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700}
.wdn-text{flex:1;min-width:0}
.wdn-title{font-size:13.5px;font-weight:700;color:#1f1f1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wdn-body{font-size:13px;color:#444746;margin-top:2px;line-height:1.42;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wdn-head-icons{display:flex;align-items:center;gap:8px;color:#5f6368}
.wdn-chevron-svg{transition:transform .25s ease}
@media(max-width:480px){#wdn-stack{top:8px;width:calc(100vw - 14px)}.wdn-card{border-radius:20px}.wdn-main{padding:6px 12px 10px;gap:11px}.wdn-avatar{width:36px;height:36px;font-size:16px}.wdn-title{font-size:13px}.wdn-body{font-size:12.5px;-webkit-line-clamp:1}}
`;
