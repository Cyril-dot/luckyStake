/*
 * withdrawNotify — admin instant-withdrawal notification popup.
 *
 * Structure, geometry and styling are copied 1:1 from the owner's design
 * files (notification-popups-updated.zip): the Android Messages card and
 * the iOS glass banner, including their phone media queries (the Android
 * card becomes a slim one-line banner on phone widths). ONLY the text is
 * ours: the site name in the header, the sender (the withdrawal network —
 * "MoMo" / "T-CASH" / "AirtelTigo", as in the zip) and the message body
 * (the real withdrawal data). Partial popup only: it drops in, dwells
 * (6s Android / 5s iOS, the zip's values), and a tap or swipe-up dismisses
 * it. No expanded view, no scrim, nothing else on screen changes.
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

const NETWORK_META: Record<string, { label: string; sender: string; initial: string }> = {
  MTN: { label: "MTN Mobile Money", sender: "MoMo", initial: "M" },
  TELECEL: { label: "Telecel Cash", sender: "T-CASH", initial: "T" },
  VODAFONE: { label: "Telecel Cash", sender: "T-CASH", initial: "T" },
  AIRTELTIGO: { label: "AirtelTigo Money", sender: "AirtelTigo", initial: "A" },
  BANK_TRANSFER: { label: "Bank Transfer", sender: "Bank Transfer", initial: "B" },
  CARD: { label: "Card", sender: "Card", initial: "C" },
};

const STYLE_ID = "wdn-style";
/* CSS mirrors the zip's .and-* / .ios-* rules value-for-value. */
const CSS = `
#wdn-stack{position:fixed;top:40px;left:50%;transform:translateX(-50%);width:min(420px,calc(100vw - 20px));z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
#wdn-stack.wdn-ios-stack{top:8px;width:min(400px,calc(100vw - 16px))}
.wdn-card{pointer-events:auto;overflow:hidden;cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none;position:relative}
.wdn-android{border-radius:24px;background:#f4f5f7;color:#1f1f1f;box-shadow:0 14px 36px rgba(0,0,0,.5);font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;animation:wdn-and-drop .55s cubic-bezier(.3,1.4,.4,1) both;transition:transform .35s cubic-bezier(.3,1.2,.4,1),opacity .3s ease}
@keyframes wdn-and-drop{0%{transform:translateY(-140%) scale(.92);opacity:0}60%{transform:translateY(6px) scale(1.01);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
.wdn-android.wdn-leaving{animation:wdn-and-lift .3s cubic-bezier(.5,0,.8,.4) both}
@keyframes wdn-and-lift{to{transform:translateY(-150%) scale(.94);opacity:0}}
.wdn-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0}
.wdn-app{display:flex;align-items:center;gap:7px;min-width:0}
.wdn-appicon{width:20px;height:20px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.wdn-appicon svg{width:13px;height:13px;display:block}
.wdn-appname{font-size:11.5px;font-weight:500;color:#5f6368}
.wdn-dot{font-size:11.5px;color:#9aa0a6;margin:0 1px}
.wdn-now{font-size:11.5px;color:#5f6368}
.wdn-head-icons{display:flex;align-items:center;gap:8px;color:#5f6368}
.wdn-head-icons svg{width:17px;height:17px;display:block}
.wdn-main{display:flex;gap:12px;padding:8px 14px 12px;align-items:flex-start}
.wdn-contact{width:40px;height:40px;border-radius:50%;flex-shrink:0;background:#5f6368;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:500}
.wdn-text{flex:1;min-width:0}
.wdn-title{font-size:13.5px;font-weight:700;color:#1f1f1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wdn-body{font-size:13px;color:#444746;margin-top:2px;line-height:1.42;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wdn-ios{border-radius:20px;color:#000;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 45%),rgba(218,218,228,.52);-webkit-backdrop-filter:blur(28px) saturate(200%);backdrop-filter:blur(28px) saturate(200%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(0,0,0,.04),0 10px 30px rgba(0,0,0,.18);animation:wdn-ios-drop .55s cubic-bezier(.3,1.25,.4,1) both;transition:transform .18s ease}
@keyframes wdn-ios-drop{0%{transform:translateY(-130%);opacity:0}60%{transform:translateY(7px);opacity:1}80%{transform:translateY(-2px);opacity:1}100%{transform:translateY(0);opacity:1}}
.wdn-ios.wdn-leaving{animation:wdn-ios-up .35s cubic-bezier(.5,0,.75,0) both}
@keyframes wdn-ios-up{to{transform:translateY(-135%);opacity:0}}
.wdn-ios-main{display:flex;align-items:center;gap:12px;padding:12px 14px}
.wdn-ios-avatarwrap{position:relative;flex-shrink:0}
.wdn-ios-avatar{width:44px;height:44px;border-radius:50%;display:block}
.wdn-ios-badge{position:absolute;right:-3px;bottom:-3px;width:20px;height:20px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
.wdn-ios-badge svg{width:12px;height:12px;display:block}
.wdn-ios-text{flex:1;min-width:0}
.wdn-ios-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.wdn-ios-title{font-size:15px;font-weight:700;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wdn-ios-time{font-size:12px;color:rgba(60,60,67,.6);flex-shrink:0}
.wdn-ios-body{font-size:15px;font-weight:400;color:#000;line-height:1.32;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:480px){
  #wdn-stack{top:34px;width:calc(100vw - 14px)}
  .wdn-android{border-radius:20px}
  .wdn-main{padding:6px 12px 10px;gap:11px}
  .wdn-contact{width:36px;height:36px;font-size:16px}
  .wdn-title{font-size:13px}
  .wdn-body{font-size:12.5px;-webkit-line-clamp:1}
  #wdn-stack.wdn-ios-stack{left:6px;right:6px;top:6px;transform:none;width:auto}
  .wdn-ios{border-radius:16px}
  .wdn-ios-main{padding:9px 12px;gap:10px}
  .wdn-ios-avatar{width:40px;height:40px}
  .wdn-ios-badge{width:18px;height:18px}
  .wdn-ios-title{font-size:14px}
  .wdn-ios-time{font-size:11px}
  .wdn-ios-body{font-size:13.5px}
}
`;

const BELL =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4.5a1.5 1.5 0 0 0-3 0v.7A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
const CHEVRON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>';
const BUBBLE =
  '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 5.2c-3.7 0-6.7 2.7-6.7 6 0 1.9 1 3.6 2.6 4.7l-.6 2.7 3-1.6c.5.2 1.1.2 1.7.2 3.7 0 6.7-2.7 6.7-6s-3-6-6.7-6z"/></svg>';
const PERSON =
  '<svg class="wdn-ios-avatar" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="22" fill="#B9C2D0"/><circle cx="22" cy="17" r="8" fill="#8E99AB"/><path d="M8 40c2-8 7.5-12 14-12s12 4 14 12" fill="#8E99AB"/></svg>';

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

function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1);
}

export function notifyAdminWithdrawal(data: WithdrawNotifyData) {
  try {
    ensureStyle();
    const ios = isIOS();
    const dwell = ios ? 5000 : 6000; // the zip's own dwell per platform
    let stack = document.getElementById("wdn-stack");
    if (!stack) {
      stack = el("div", "");
      stack.id = "wdn-stack";
      document.body.appendChild(stack);
    }
    stack.className = ios ? "wdn-ios-stack" : "";

    const meta =
      NETWORK_META[String(data.network || "").toUpperCase()] ??
      { label: String(data.network || "Mobile Money"), sender: String(data.network || "Mobile Money"), initial: "W" };

    const message =
      `Withdrawal of ${data.amountText} to ${data.toNumber} (${data.toName}) via ${meta.label} was completed. ` +
      `Wallet balance: ${data.balanceText}. Transaction ref: ${data.reference}.`;

    const card = el("div", `wdn-card ${ios ? "wdn-ios" : "wdn-android"}`);
    card.setAttribute("role", "status");

    if (ios) {
      const main = el("div", "wdn-ios-main");
      const wrap = el("div", "wdn-ios-avatarwrap");
      wrap.innerHTML = PERSON;
      const badge = el("span", "wdn-ios-badge");
      badge.style.background = data.brandColor;
      badge.innerHTML = BUBBLE;
      wrap.appendChild(badge);
      const text = el("div", "wdn-ios-text");
      const head = el("div", "wdn-ios-head");
      head.appendChild(el("div", "wdn-ios-title", meta.sender));
      head.appendChild(el("div", "wdn-ios-time", "now"));
      text.appendChild(head);
      text.appendChild(el("div", "wdn-ios-body", message));
      main.appendChild(wrap);
      main.appendChild(text);
      card.appendChild(main);
    } else {
      const head = el("div", "wdn-head");
      const app = el("div", "wdn-app");
      const icon = el("span", "wdn-appicon");
      icon.style.background = data.brandColor;
      icon.innerHTML = BUBBLE;
      app.appendChild(icon);
      app.appendChild(el("span", "wdn-appname", data.siteName));
      app.appendChild(el("span", "wdn-dot", "•"));
      app.appendChild(el("span", "wdn-now", "now"));
      const icons = el("div", "wdn-head-icons");
      icons.innerHTML = BELL + CHEVRON;
      head.appendChild(app);
      head.appendChild(icons);
      const main = el("div", "wdn-main");
      main.appendChild(el("div", "wdn-contact", meta.initial));
      const text = el("div", "wdn-text");
      text.appendChild(el("div", "wdn-title", meta.sender));
      text.appendChild(el("div", "wdn-body", message));
      main.appendChild(text);
      card.appendChild(head);
      card.appendChild(main);
    }

    stack.prepend(card);

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      window.clearTimeout(timer);
      card.classList.add("wdn-leaving");
      window.setTimeout(() => card.remove(), 360);
    };
    const timer = window.setTimeout(dismiss, dwell);

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
