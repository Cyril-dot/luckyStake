/*
 * withdrawNotify — admin instant-withdrawal notification popup.
 *
 * The popup is the iOS glass banner from the owner's design files
 * (notification-popups-updated.zip), used on every platform, with its
 * structure/CSS copied value-for-value — including the phone media query.
 * There is NO site label on it: exactly like the zip, the banner is FROM
 * the network — the title is the sender ("MobileMoney" for MTN, "T-CASH"
 * for Telecel, per the zip) and the avatar is the zip's generic person
 * with the green Messages badge. Only the message text is ours: the real
 * withdrawal data. Partial popup only: it drops in, dwells 5s (the zip's
 * value), and a tap or swipe-up dismisses it. No expanded view, no
 * scrim, nothing else on screen changes.
 */

export interface WithdrawNotifyData {
  siteName: string;
  brandColor: string;
  /** Pre-formatted, e.g. "GH₵2,000.00" */
  amountText: string;
  /** MTN | TELECEL | AIRTELTIGO | BANK_TRANSFER | CARD */
  network: string;
  toNumber: string;
  toName: string;
  /** The withdrawal transaction's real reference (backend transaction id). */
  reference: string;
  /** Pre-formatted post-withdrawal wallet balance, e.g. "GH₵7,000.00" */
  balanceText: string;
}

const NETWORK_META: Record<string, { label: string; sender: string }> = {
  MTN: { label: "MTN Mobile Money", sender: "MobileMoney" },
  TELECEL: { label: "Telecel Cash", sender: "T-CASH" },
  VODAFONE: { label: "Telecel Cash", sender: "T-CASH" },
  AIRTELTIGO: { label: "AirtelTigo Money", sender: "AirtelTigo" },
  BANK_TRANSFER: { label: "Bank Transfer", sender: "Bank Transfer" },
  CARD: { label: "Card", sender: "Card" },
};

const STYLE_ID = "wdn-style";
/* CSS mirrors the zip's .ios-* rules value-for-value. */
const CSS = `
#wdn-stack{position:fixed;top:8px;left:50%;transform:translateX(-50%);width:min(400px,calc(100vw - 16px));z-index:99999;pointer-events:none}
.wdn-card{pointer-events:auto;position:relative;border-radius:20px;color:#000;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 45%),rgba(218,218,228,.52);-webkit-backdrop-filter:blur(28px) saturate(200%);backdrop-filter:blur(28px) saturate(200%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(0,0,0,.04),0 10px 30px rgba(0,0,0,.18);cursor:pointer;overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;animation:wdn-ios-drop .55s cubic-bezier(.3,1.25,.4,1) both;transition:transform .18s ease}
@keyframes wdn-ios-drop{0%{transform:translateY(-130%);opacity:0}60%{transform:translateY(7px);opacity:1}80%{transform:translateY(-2px);opacity:1}100%{transform:translateY(0);opacity:1}}
.wdn-card.wdn-leaving{animation:wdn-ios-up .35s cubic-bezier(.5,0,.75,0) both}
@keyframes wdn-ios-up{to{transform:translateY(-135%);opacity:0}}
.wdn-ios-main{display:flex;align-items:center;gap:12px;padding:12px 14px}
.wdn-ios-avatarwrap{position:relative;flex-shrink:0}
.wdn-ios-avatar{width:44px;height:44px;border-radius:50%;display:block}
.wdn-ios-badge{position:absolute;right:-3px;bottom:-3px;width:20px;height:20px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3);display:block}
.wdn-ios-text{flex:1;min-width:0}
.wdn-ios-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.wdn-ios-title{font-size:15px;font-weight:700;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wdn-ios-time{font-size:12px;color:rgba(60,60,67,.6);flex-shrink:0}
.wdn-ios-body{font-size:15px;font-weight:400;color:#000;line-height:1.32;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:480px){
  #wdn-stack{left:6px;right:6px;top:6px;transform:none;width:auto}
  .wdn-card{border-radius:16px}
  .wdn-ios-main{padding:9px 12px;gap:10px}
  .wdn-ios-avatar{width:40px;height:40px}
  .wdn-ios-badge{width:18px;height:18px}
  .wdn-ios-title{font-size:14px}
  .wdn-ios-time{font-size:11px}
  .wdn-ios-body{font-size:13.5px}
}
`;

const PERSON =
  '<svg class="wdn-ios-avatar" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="22" fill="#B9C2D0"/><circle cx="22" cy="17" r="8" fill="#8E99AB"/><path d="M8 40c2-8 7.5-12 14-12s12 4 14 12" fill="#8E99AB"/></svg>';
/* The zip's green Messages app badge. */
const MSG_BADGE =
  '<svg class="wdn-ios-badge" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#34C759"/><path fill="#fff" d="M12 5.2c-3.7 0-6.7 2.7-6.7 6 0 1.9 1 3.6 2.6 4.7l-.6 2.7 3-1.6c.5.2 1.1.2 1.7.2 3.7 0 6.7-2.7 6.7-6s-3-6-6.7-6z"/></svg>';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function notifyAdminWithdrawal(data: WithdrawNotifyData) {
  try {
    ensureStyle();
    let stack = document.getElementById("wdn-stack");
    if (!stack) {
      stack = el("div", "");
      stack.id = "wdn-stack";
      document.body.appendChild(stack);
    }

    const meta =
      NETWORK_META[String(data.network || "").toUpperCase()] ??
      { label: String(data.network || "Mobile Money"), sender: String(data.network || "Mobile Money") };

    const message =
      `Withdrawal of ${data.amountText} to ${data.toNumber} (${data.toName}) via ${meta.label} was completed. ` +
      `Wallet balance: ${data.balanceText}. Transaction ref: ${data.reference}.`;

    const card = el("div", "wdn-card");
    card.setAttribute("role", "status");
    const main = el("div", "wdn-ios-main");
    const wrap = el("div", "wdn-ios-avatarwrap");
    wrap.innerHTML = PERSON + MSG_BADGE;
    const text = el("div", "wdn-ios-text");
    const head = el("div", "wdn-ios-head");
    head.appendChild(el("div", "wdn-ios-title", meta.sender));
    head.appendChild(el("div", "wdn-ios-time", "now"));
    text.appendChild(head);
    text.appendChild(el("div", "wdn-ios-body", message));
    main.appendChild(wrap);
    main.appendChild(text);
    card.appendChild(main);
    stack.prepend(card);

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      window.clearTimeout(timer);
      card.classList.add("wdn-leaving");
      window.setTimeout(() => card.remove(), 360);
    };
    const timer = window.setTimeout(dismiss, 5000); // the zip's iOS dwell

    // Tap dismisses; swipe up dismisses (drag past the zip's -60 threshold).
    let startY: number | null = null;
    let dy = 0;
    let wasDrag = false;
    card.addEventListener("pointerdown", (e) => {
      startY = e.clientY;
      dy = 0;
      card.style.transition = "none";
      try { card.setPointerCapture(e.pointerId); } catch { /* noop */ }
    });
    card.addEventListener("pointermove", (e) => {
      if (startY === null) return;
      dy = e.clientY - startY;
      card.style.transform = `translateY(${dy}px)`;
    });
    const endDrag = () => {
      if (startY === null) return;
      card.style.transition = "";
      if (dy < -60) dismiss();
      else { card.style.transform = ""; wasDrag = Math.abs(dy) > 8; }
      startY = null;
    };
    card.addEventListener("pointerup", endDrag);
    card.addEventListener("pointercancel", endDrag);
    card.addEventListener("click", () => {
      if (wasDrag) { wasDrag = false; return; }
      dismiss();
    });
  } catch {
    /* a notification failure must never break the withdrawal flow */
  }
}
