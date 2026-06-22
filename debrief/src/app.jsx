/* Debrief — renderer app (source). Compiled to renderer/app.js. */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG, no external dependency)                        */
/* ------------------------------------------------------------------ */
const S = ({ size = 16, fill = "none", children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);
const IPlus = (p) => <S {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></S>;
const ISearch = (p) => <S {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></S>;
const IMic = (p) => <S {...p}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></S>;
const ISquare = (p) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="2" /></S>;
const ISparkles = (p) => <S {...p}><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" /></S>;
const ISend = (p) => <S {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9z" /></S>;
const IFile = (p) => <S {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></S>;
const IChat = (p) => <S {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></S>;
const IX = (p) => <S {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></S>;
const ICheck = (p) => <S {...p}><path d="M20 6 9 17l-5-5" /></S>;
const ICopy = (p) => <S {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>;
const ILoader = (p) => <S {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></S>;
const ITrash = (p) => <S {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></S>;
const IUsers = (p) => <S {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></S>;
const ICal = (p) => <S {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></S>;
const IMenu = (p) => <S {...p}><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></S>;
const IList = (p) => <S {...p}><path d="M3 6l1.4 1.4L7 5" /><path d="M3 12l1.4 1.4L7 11" /><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /><path d="M3 18l1.4 1.4L7 17" /></S>;
const IMail = (p) => <S {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></S>;
const IPlay = (p) => <S fill="currentColor" stroke="none" {...p}><path d="M6 4l14 8-14 8z" /></S>;
const INotebook = (p) => <S {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="13" y1="8" x2="17" y2="8" /><line x1="13" y1="12" x2="17" y2="12" /></S>;
const ISettings = (p) => <S {...p}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></S>;
const IFolder = (p) => <S {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></S>;
const IDownload = (p) => <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><line x1="12" y1="15" x2="12" y2="3" /></S>;

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
const STYLES = `
.g-root {
  --bg: #0F1115;
  --surface: #1A1E26;
  --surface-2: #232833;
  --ink: #E7E9EE;
  --ink-2: #9CA2B0;
  --ink-3: #6E7480;
  --line: #2C313C;
  --line-2: #232833;
  --accent: #7C5CFF;
  --accent-soft: #211C3A;
  --accent-ink: #B6A6FF;
  --rec: #FF6B5A;
  --sel: #241F38;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -16px rgba(0,0,0,.6);
  position: fixed; inset: 0;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
  background: var(--bg);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}
.g-root *, .g-root *::before, .g-root *::after { box-sizing: border-box; }
.g-root button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
.g-root input, .g-root textarea, .g-root select { font-family: inherit; color: inherit; }
.g-root ::selection { background: #322d4d; }
.g-root *::-webkit-scrollbar { width: 9px; height: 9px; }
.g-root *::-webkit-scrollbar-thumb { background: #353b47; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
.g-root *::-webkit-scrollbar-thumb:hover { background: #434a59; background-clip: padding-box; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: 4px; }

.g-sidebar { width: 264px; flex: 0 0 264px; background: var(--surface-2); border-right: 1px solid var(--line); display: flex; flex-direction: column; height: 100%; }
.g-brand { display: flex; align-items: center; gap: 9px; padding: 18px 18px 12px; -webkit-app-region: drag; }
.g-brand-mark { width: 26px; height: 26px; border-radius: 8px; background: var(--accent); color: #fff; display: grid; place-items: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.g-brand-name { font-size: 16px; font-weight: 600; letter-spacing: -.02em; }
.g-side-pad { padding: 0 12px; }
.g-newbtn { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-radius: 9px; background: var(--accent); color: #fff; font-weight: 500; font-size: 13.5px; box-shadow: var(--shadow); transition: filter .15s ease, transform .05s ease; }
.g-newbtn:hover { filter: brightness(1.06); }
.g-newbtn:active { transform: translateY(1px); }
.g-search { position: relative; margin: 12px 0 6px; }
.g-search > span { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--ink-3); display: grid; }
.g-search input { width: 100%; padding: 8px 10px 8px 31px; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; font-size: 13px; outline: none; }
.g-search input::placeholder { color: var(--ink-3); }
.g-search input:focus { border-color: #3a4150; }
.g-list { flex: 1; overflow-y: auto; padding: 6px 8px 12px; }
.g-group-label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3); padding: 12px 8px 6px; }
.g-item { position: relative; width: 100%; text-align: left; padding: 9px 30px 9px 10px; border-radius: 9px; display: block; transition: background .12s ease; }
.g-item:hover { background: #262B36; }
.g-item.sel { background: var(--sel); }
.g-item-title { font-size: 13.5px; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-item-meta { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-item-del { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; color: var(--ink-3); opacity: 0; transition: opacity .12s ease, background .12s ease, color .12s ease; }
.g-item:hover .g-item-del { opacity: 1; }
.g-item-del:hover { background: #313845; color: var(--rec); }
.g-side-empty { color: var(--ink-3); font-size: 12.5px; padding: 14px 10px; line-height: 1.55; }
.g-side-foot { border-top: 1px solid var(--line); padding: 8px 10px; display: flex; gap: 4px; }
.g-foot-btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 8px; font-size: 12.5px; color: var(--ink-2); transition: background .12s ease; }
.g-foot-btn:hover { background: #262B36; color: var(--ink); }

.g-main { flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100%; background: var(--bg); }
.g-topbar { display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-bottom: 1px solid var(--line); -webkit-app-region: drag; }
.g-topbar button, .g-topbar .g-no-drag { -webkit-app-region: no-drag; }
.g-hamburger { display: none; width: 32px; height: 32px; border-radius: 8px; place-items: center; color: var(--ink-2); }
.g-hamburger:hover { background: var(--surface-2); }
.g-top-spacer { flex: 1; }
.g-pillbtn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; border: 1px solid var(--line); background: var(--surface); color: var(--ink); transition: background .12s ease, border-color .12s ease; }
.g-pillbtn:hover { background: var(--surface-2); border-color: #3a4150; }
.g-pillbtn.primary { background: var(--accent); color: #fff; border-color: transparent; box-shadow: var(--shadow); }
.g-pillbtn.primary:hover { filter: brightness(1.06); background: var(--accent); }
.g-pillbtn.rec { color: var(--rec); border-color: #5a2f2a; background: #241a18; }
.g-pillbtn.active { background: var(--sel); border-color: #3a4150; }
.g-pillbtn:disabled { opacity: .5; cursor: not-allowed; }
.g-iconbtn { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); }
.g-iconbtn:hover { background: var(--surface-2); color: var(--ink); }
.g-rec-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--rec); animation: g-pulse 1.4s ease-in-out infinite; }
@keyframes g-pulse { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,107,90,.45);} 50% { opacity: .55; box-shadow: 0 0 0 5px rgba(255,107,90,0);} }
@keyframes g-spin { to { transform: rotate(360deg); } }

.g-banner { display: flex; align-items: center; gap: 10px; padding: 9px 16px; background: #211B12; border-bottom: 1px solid #3A2F1A; font-size: 12.5px; color: #D8B877; }
.g-banner b { color: #F0CE8A; }
.g-banner button { margin-left: auto; }
.g-banner .g-link { color: var(--accent-ink); font-weight: 600; text-decoration: underline; cursor: pointer; }

.g-scroll { flex: 1; overflow-y: auto; }
.g-page { max-width: 760px; margin: 0 auto; padding: 30px 28px 80px; }
.g-title-input { width: 100%; border: none; outline: none; background: transparent; font-size: 28px; font-weight: 600; letter-spacing: -.025em; color: var(--ink); padding: 0; line-height: 1.2; }
.g-title-input::placeholder { color: var(--ink-3); }
.g-meta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 12px; color: var(--ink-2); font-size: 12.5px; }
.g-meta-chip { display: inline-flex; align-items: center; gap: 6px; }
.g-meta-chip > span:first-child { color: var(--ink-3); display: grid; }
.g-att-input { border: none; outline: none; background: transparent; font-size: 12.5px; color: var(--ink-2); width: 170px; }
.g-att-input::placeholder { color: var(--ink-3); }
.g-tmpl { appearance: none; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 4px 26px 4px 9px; font-size: 12px; color: var(--ink-2); cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A90A0' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
.g-tabs { display: flex; gap: 2px; margin: 22px 0 6px; border-bottom: 1px solid var(--line); }
.g-tab { position: relative; padding: 8px 13px 11px; font-size: 13px; font-weight: 500; color: var(--ink-3); transition: color .12s ease; }
.g-tab:hover { color: var(--ink-2); }
.g-tab.sel { color: var(--ink); }
.g-tab.sel::after { content:""; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; background: var(--accent); border-radius: 2px; }
.g-tab-count { margin-left: 6px; font-size: 11px; color: var(--ink-3); font-weight: 500; }
.g-notes-area { width: 100%; min-height: 340px; border: none; outline: none; resize: none; background: transparent; font-size: 15px; line-height: 1.7; color: var(--ink); margin-top: 16px; padding: 0; }
.g-notes-area::placeholder { color: var(--ink-3); }

.g-livestrip { position: sticky; bottom: 0; margin-top: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.g-livestrip-head { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-bottom: 1px solid var(--line-2); }
.g-livestrip-title { font-size: 12px; font-weight: 600; color: var(--ink); }
.g-livestrip-sub { font-size: 11.5px; color: var(--ink-3); }
.g-livestrip-body { max-height: 116px; overflow-y: auto; padding: 10px 12px; font-size: 12.5px; line-height: 1.6; color: var(--ink-2); }
.g-stopbtn { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--rec); padding: 4px 8px; border-radius: 7px; }
.g-stopbtn:hover { background: #241a18; }

.g-tr-controls { display: flex; gap: 8px; align-items: center; margin: 16px 0 10px; flex-wrap: wrap; }
.g-tr-area { width: 100%; min-height: 320px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); padding: 16px; font-size: 13.5px; line-height: 1.7; color: var(--ink); outline: none; resize: vertical; }
.g-tr-area::placeholder { color: var(--ink-3); }
.g-tr-hint { color: var(--ink-3); font-size: 12px; margin-top: 10px; }

.g-enh-lead { font-size: 14.5px; line-height: 1.65; color: var(--ink-2); margin: 18px 0 4px; }
.g-enh-section { margin-top: 22px; animation: g-rise .42s cubic-bezier(.2,.7,.3,1) both; }
@keyframes g-rise { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: none; } }
.g-enh-h { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 9px; letter-spacing: -.01em; }
.g-enh-ul { list-style: none; margin: 0; padding: 0; }
.g-enh-li { position: relative; padding-left: 19px; margin: 6px 0; font-size: 14.5px; line-height: 1.62; color: var(--ink); }
.g-enh-li::before { content: "•"; position: absolute; left: 4px; color: var(--accent); font-weight: 700; }
.g-enh-sub { list-style: none; margin: 4px 0 0; padding-left: 4px; }
.g-enh-subli { position: relative; padding-left: 16px; margin: 4px 0; font-size: 14px; line-height: 1.55; color: var(--ink-2); }
.g-enh-subli::before { content: "–"; position: absolute; left: 2px; color: var(--ink-3); }
.g-actions-card { margin-top: 26px; }
.g-action { display: flex; align-items: flex-start; gap: 11px; padding: 11px 0; border-top: 1px solid var(--line-2); }
.g-action:first-child { border-top: none; }
.g-check { width: 18px; height: 18px; flex: 0 0 18px; margin-top: 1px; border: 1.5px solid #3a4150; border-radius: 5px; display: grid; place-items: center; color: transparent; transition: all .12s ease; }
.g-check.done { background: var(--accent); border-color: var(--accent); color: #fff; }
.g-action-text { flex: 1; font-size: 14.5px; line-height: 1.5; }
.g-action-text.done { color: var(--ink-3); text-decoration: line-through; }
.g-action-owner { color: var(--accent-ink); font-weight: 600; }
.g-due { font-size: 11.5px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line); padding: 1px 8px; border-radius: 20px; white-space: nowrap; margin-top: 1px; }

.g-empty { text-align: center; padding: 64px 20px; color: var(--ink-3); }
.g-empty-ic { width: 46px; height: 46px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); display: inline-grid; place-items: center; color: var(--ink-3); margin-bottom: 14px; }
.g-empty h3 { font-size: 15px; font-weight: 600; color: var(--ink-2); margin: 0 0 5px; }
.g-empty p { font-size: 13px; line-height: 1.6; max-width: 340px; margin: 0 auto; }

.g-sk { margin-top: 22px; }
.g-sk-bar { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #1E222B 25%, #2A2F3A 50%, #1E222B 75%); background-size: 200% 100%; animation: g-shimmer 1.3s linear infinite; margin: 11px 0; }
@keyframes g-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.g-sk-label { display: inline-flex; align-items: center; gap: 8px; color: var(--accent-ink); font-size: 13px; font-weight: 500; }

.g-chat { width: 360px; flex: 0 0 360px; background: var(--surface); border-left: 1px solid var(--line); display: flex; flex-direction: column; height: 100%; }
.g-chat-head { display: flex; align-items: center; gap: 9px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.g-chat-head h2 { font-size: 14px; font-weight: 600; margin: 0; }
.g-chat-x { margin-left: auto; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3); }
.g-chat-x:hover { background: var(--surface-2); color: var(--ink); }
.g-chat-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.g-msg-user { align-self: flex-end; max-width: 86%; background: var(--accent); color: #fff; padding: 9px 13px; border-radius: 14px 14px 4px 14px; font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; }
.g-msg-ai { align-self: flex-start; max-width: 94%; font-size: 13.5px; line-height: 1.62; color: var(--ink); }
.g-msg-ai p { margin: 0 0 8px; }
.g-msg-ai p:last-child { margin-bottom: 0; }
.g-msg-ai ul { margin: 4px 0 8px; padding-left: 18px; }
.g-msg-ai li { margin: 3px 0; }
.g-msg-ai h4 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
.g-chat-empty { color: var(--ink-3); font-size: 13px; text-align: center; margin-top: 18px; line-height: 1.6; }
.g-quick { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; justify-content: center; }
.g-quick button { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); border: 1px solid var(--line); background: var(--surface-2); padding: 6px 10px; border-radius: 20px; transition: all .12s ease; }
.g-quick button:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-soft); }
.g-chat-foot { padding: 12px 14px 14px; border-top: 1px solid var(--line); }
.g-chat-inputwrap { display: flex; align-items: flex-end; gap: 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px; padding: 7px 7px 7px 12px; transition: border-color .12s ease; }
.g-chat-inputwrap:focus-within { border-color: #3a4150; }
.g-chat-input { flex: 1; border: none; outline: none; background: transparent; resize: none; font-size: 13.5px; line-height: 1.5; max-height: 120px; padding: 3px 0; }
.g-chat-input::placeholder { color: var(--ink-3); }
.g-sendbtn { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 9px; background: var(--accent); color: #fff; display: grid; place-items: center; transition: filter .12s ease; }
.g-sendbtn:hover { filter: brightness(1.07); }
.g-sendbtn:disabled { opacity: .4; cursor: not-allowed; }

.g-toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); background: #2A2F3A; color: var(--ink); border: 0.5px solid var(--line); font-size: 13px; padding: 10px 16px; border-radius: 10px; box-shadow: 0 10px 30px -10px rgba(0,0,0,.4); z-index: 60; animation: g-rise .25s ease both; max-width: 460px; }

.g-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 70; display: grid; place-items: center; padding: 20px; animation: g-fade .15s ease both; }
@keyframes g-fade { from { opacity: 0; } to { opacity: 1; } }
.g-modal { width: 100%; max-width: 460px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.4); overflow: hidden; }
.g-modal-head { display: flex; align-items: center; gap: 9px; padding: 16px 18px; border-bottom: 1px solid var(--line-2); }
.g-modal-head h2 { font-size: 15px; font-weight: 600; margin: 0; }
.g-modal-head .g-chat-x { margin-left: auto; }
.g-modal-body { padding: 18px; }
.g-field { margin-bottom: 16px; }
.g-field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
.g-field .hint { font-size: 12px; color: var(--ink-2); margin-top: 6px; line-height: 1.5; }
.g-input { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font-size: 13.5px; outline: none; background: var(--surface-2); }
.g-input:focus { border-color: #3a4150; }
.g-select { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; font-size: 13.5px; background: var(--surface-2); cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238A90A0' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 11px center; }
.g-modal-foot { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--line-2); }
.g-keytag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent-ink); background: var(--accent-soft); padding: 4px 9px; border-radius: 20px; }
.g-pathbox { font-size: 11.5px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 8px; padding: 8px 10px; word-break: break-all; margin-top: 6px; line-height: 1.45; }

.g-overlay { display: none; }
@media (max-width: 1080px) { .g-chat { width: 320px; flex-basis: 320px; } }
@media (max-width: 900px) {
  .g-sidebar { position: absolute; z-index: 30; height: 100%; box-shadow: 0 0 40px rgba(0,0,0,.5); transform: translateX(-100%); transition: transform .22s ease; }
  .g-sidebar.open { transform: none; }
  .g-hamburger { display: grid; }
  .g-overlay.show { display: block; position: absolute; inset: 0; background: rgba(0,0,0,.5); z-index: 25; }
  .g-chat { position: absolute; right: 0; z-index: 30; width: 100%; max-width: 380px; }
}
@media (prefers-reduced-motion: reduce) { .g-root *, .g-root *::before, .g-root *::after { animation: none !important; transition: none !important; } }
`;

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const TEMPLATES = {
  general: "General meeting",
  oneonone: "1:1",
  sales: "Sales / discovery call",
  standup: "Team standup",
  interview: "Interview",
  planning: "Planning / strategy",
};
const TEMPLATE_GUIDE = {
  general: "Organize into the natural topics discussed, then surface decisions and next steps.",
  oneonone: "Group into: updates & progress, blockers, feedback, growth/career, and follow-ups for each person.",
  sales: "Group into: current situation & pain, requirements, objections/concerns, competitive mentions, budget/timeline, and clear next steps with owners.",
  standup: "Group by person where possible: what shipped, what's in progress, and blockers. Keep it tight.",
  interview: "Group into: background, strengths/signals, concerns/risks, candidate questions, and a recommendation.",
  planning: "Group into: goals, options considered, trade-offs, decisions made, open questions, and owned next steps.",
};
const MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced, recommended)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 (most capable)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fastest, cheapest)" },
];

const DEMO_RAW =
`q3 pipeline sync

- pipeline at 68% of target, gap is mostly enterprise
- maya: paid is working but mid-market CAC creeping up
- stalled deals piling up at business case stage -> devin wants a template
- priya new messaging hasn't landed with sales yet
- tier 1 ABM list needs a refresh
- next: maya reforecast budget, devin business case template, priya enablement session`;

const DEMO_TRANSCRIPT_LINES = [
  "Maya: Okay, let's jump in. We're at sixty-eight percent of the Q3 pipeline target with five weeks to go.",
  "Maya: The gap is almost entirely enterprise. Mid-market and commercial are actually slightly ahead of plan.",
  "Devin: That tracks with what I'm seeing. Mid-market deals are moving, but enterprise keeps stalling at the business case stage.",
  "Maya: On paid, the channels are performing, but mid-market CAC is creeping up. It's about eleven percent higher than last quarter.",
  "Priya: Is that efficiency or is the new messaging just not converting yet?",
  "Maya: Mostly efficiency. We saturated the best segments, so we're paying more for the next tier of accounts.",
  "Devin: Can we talk about the stalled deals? I've got four enterprise opportunities sitting because procurement wants a formal business case and we're building each one from scratch.",
  "Maya: That's a real bottleneck. Devin, what would actually help you?",
  "Devin: A reusable business case template. ROI model, payback math, a security and compliance section. If marketing builds the shell, I can fill in the account specifics.",
  "Maya: Let's do it. Priya, can you own the template with Devin feeding the structure?",
  "Priya: Yes. I can have a v1 by next Thursday if Devin gives me the three deals to model against.",
  "Devin: I'll send those over today.",
  "Priya: Separate issue, the new positioning. Sales hasn't really internalized it. I'm hearing the old pitch on calls.",
  "Devin: Honestly, the team hasn't been briefed properly. We got the deck but no live walkthrough.",
  "Maya: Let's run an enablement session. Priya leads it, thirty minutes, with two recorded example calls.",
  "Priya: I'll schedule it for early next week and send a pre-read.",
  "Maya: Last thing, the Tier 1 ABM list is stale. A chunk of those accounts have gone quiet for two quarters.",
  "Devin: Agreed. I'd swap in the accounts showing recent intent. Maybe a third of the list.",
  "Maya: I'll refresh the list against intent data and reforecast the paid budget around the new targets by Monday.",
  "Maya: Quick recap. I reforecast budget and refresh the Tier 1 list by Monday. Priya owns the business case template, v1 by Thursday, and runs the enablement session next week. Devin sends the three deals today.",
  "Priya: Works for me.",
  "Devin: Same. Good session.",
];

const QUICK_PROMPTS = [
  { Icon: IList, label: "List action items", text: "List all the action items from this meeting with owners and due dates." },
  { Icon: IMail, label: "Draft a follow-up email", text: "Write a short, friendly follow-up email summarizing this meeting and the next steps." },
  { Icon: IFile, label: "Summarize for my manager", text: "Give me a 3-sentence summary of this meeting I can send to my manager." },
];

/* ------------------------------------------------------------------ */
/*  Claude bridge + helpers                                           */
/* ------------------------------------------------------------------ */
async function callClaude({ system, messages, max_tokens = 2048 }) {
  const res = await window.granola.claude({ system, messages, max_tokens });
  if (!res || !res.ok) {
    const code = res && res.error;
    const err = new Error(code === "no-key" ? "Add your Anthropic API key in Settings to use this." : code || "Request failed");
    err.code = code;
    throw err;
  }
  return res.text;
}
function extractJSON(text) {
  let t = (text || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e !== -1) t = t.slice(s, e + 1);
  return JSON.parse(t);
}
async function enhanceNotes({ rawNotes, transcript, template }) {
  const guide = TEMPLATE_GUIDE[template] || TEMPLATE_GUIDE.general;
  const system =
    "You are the note-enhancement engine for an AI meeting notepad. You receive a person's sparse, messy meeting notes plus a transcript of the meeting. " +
    "Your job: produce clean, structured, scannable notes that keep the person's intent and priorities, and fill in accuracy and detail from the transcript. " +
    "Preserve what the note-taker chose to write down as the backbone. Use the transcript to correct, complete, and add specifics (names, numbers, dates, commitments). " +
    "Be concise and factual. Never invent facts that aren't supported by the notes or transcript. " +
    "Return ONLY a valid JSON object, no markdown, no commentary. Schema: " +
    '{"title": string, "summary": string (one sentence), ' +
    '"sections": [{"heading": string, "bullets": [{"text": string, "sub": [string]}]}], ' +
    '"actions": [{"owner": string|null, "task": string, "due": string|null}], ' +
    '"decisions": [string]}. Keep sub arrays empty when not needed. Aim for 2-5 sections.';
  const user =
    "Template focus: " + guide + "\n\n=== MY SPARSE NOTES ===\n" + (rawNotes || "(none)") +
    "\n\n=== TRANSCRIPT ===\n" + (transcript ? transcript.slice(0, 14000) : "(none)") + "\n\nReturn the JSON now.";
  const text = await callClaude({ system, messages: [{ role: "user", content: user }], max_tokens: 4096 });
  return extractJSON(text);
}

const uid = () => Math.random().toString(36).slice(2, 10);
function makeNote(seed) {
  return { id: uid(), title: "", createdAt: Date.now(), updatedAt: Date.now(), template: "general",
    attendees: "", rawNotes: "", transcript: "", enhanced: null, doneActions: {}, chat: [], ...seed };
}
function demoNote() {
  return makeNote({ title: "Q3 Pipeline Sync", attendees: "Maya, Devin, Priya", template: "planning",
    rawNotes: DEMO_RAW, transcript: DEMO_TRANSCRIPT_LINES.join("\n"),
    createdAt: Date.now() - 1000 * 60 * 60 * 26, updatedAt: Date.now() - 1000 * 60 * 60 * 26 });
}
function fmtTime(ts) {
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString(undefined, sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" });
}
const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();

function enhancedToMarkdown(e, title) {
  if (!e) return "";
  let out = "# " + (e.title || title || "Notes") + "\n\n";
  if (e.summary) out += e.summary + "\n\n";
  (e.sections || []).forEach((s) => {
    out += "## " + s.heading + "\n";
    (s.bullets || []).forEach((b) => { out += "- " + b.text + "\n"; (b.sub || []).forEach((x) => (out += "  - " + x + "\n")); });
    out += "\n";
  });
  if (e.decisions && e.decisions.length) { out += "## Decisions\n"; e.decisions.forEach((d) => (out += "- " + d + "\n")); out += "\n"; }
  if (e.actions && e.actions.length) {
    out += "## Next steps\n";
    e.actions.forEach((a) => { out += "- [ ] " + (a.owner ? a.owner + ": " : "") + a.task + (a.due ? " (" + a.due + ")" : "") + "\n"; });
  }
  return out.trim();
}

function RichText({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let list = null;
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={k + "-" + i}>{p.slice(2, -2)}</strong> : <React.Fragment key={k + "-" + i}>{p}</React.Fragment>);
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const head = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || num) { if (!list) list = []; list.push(<li key={i}>{inline((bullet || num)[1], "b" + i)}</li>); return; }
    if (list) { blocks.push(<ul key={"ul" + i}>{list}</ul>); list = null; }
    if (head) { blocks.push(<h4 key={i}>{inline(head[1], "h" + i)}</h4>); return; }
    if (line.trim() === "") return;
    blocks.push(<p key={i}>{inline(line, "p" + i)}</p>);
  });
  if (list) blocks.push(<ul key="ul-last">{list}</ul>);
  return <>{blocks}</>;
}

/* ------------------------------------------------------------------ */
/*  Main app                                                          */
/* ------------------------------------------------------------------ */
function App() {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("notes");
  const [query, setQuery] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [interim, setInterim] = useState("");
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState({ hasKey: false, model: "claude-sonnet-4-6", notesPath: "", encrypted: false });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const recRef = useRef(null);
  const simRef = useRef(null);
  const chatBodyRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      let saved = null, s = null;
      try { saved = await window.granola.loadNotes(); } catch {}
      try { s = await window.granola.getSettings(); } catch {}
      if (!live) return;
      if (s) setSettings(s);
      if (saved && saved.length) { setNotes(saved); setActiveId(saved[0].id); }
      else { const d = demoNote(); const blank = makeNote({}); setNotes([blank, d]); setActiveId(blank.id); }
      setReady(true);
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => { window.granola.saveNotes(notes).catch(() => {}); }, 600);
    return () => clearTimeout(t);
  }, [notes, ready]);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);
  const updateNote = useCallback((id, patch) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }, []);
  const newNote = useCallback(() => {
    const n = makeNote({});
    setNotes((prev) => [n, ...prev]); setActiveId(n.id); setView("notes"); setSidebarOpen(false);
  }, []);
  const deleteNote = useCallback((id) => {
    setNotes((prev) => { const next = prev.filter((n) => n.id !== id); if (id === activeId) setActiveId(next[0] ? next[0].id : null); return next; });
  }, [activeId]);

  /* recording */
  const stopRecording = useCallback(() => {
    setRecording(false); setInterim("");
    if (recRef.current) { try { recRef.current.manualStop = true; recRef.current.stop(); } catch {} recRef.current = null; }
  }, []);
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Live mic transcription isn't available in this desktop build. Paste a transcript or click Simulate meeting."); setView("transcript"); return; }
    let rec;
    try { rec = new SR(); } catch { showToast("Couldn't start the microphone. Paste a transcript or use Simulate meeting."); setView("transcript"); return; }
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US"; rec.manualStop = false;
    const id = activeId;
    rec.onresult = (ev) => {
      let finalChunk = "", interimChunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalChunk += r[0].transcript.trim() + " "; else interimChunk += r[0].transcript;
      }
      if (finalChunk) setNotes((prev) => prev.map((n) => n.id === id ? { ...n, transcript: (n.transcript ? n.transcript + "\n" : "") + finalChunk.trim(), updatedAt: Date.now() } : n));
      setInterim(interimChunk);
    };
    rec.onerror = (e) => {
      const c = e && e.error;
      if (c === "not-allowed" || c === "service-not-allowed") { showToast("Microphone access is blocked in this build. Paste a transcript or use Simulate meeting."); setView("transcript"); }
      else if (c !== "no-speech") showToast("Transcription stopped. Paste a transcript or simulate a meeting.");
    };
    rec.onend = () => { if (recRef.current && !recRef.current.manualStop) { try { rec.start(); } catch { setRecording(false); } } };
    try { rec.start(); recRef.current = rec; setRecording(true); setView("notes"); }
    catch { showToast("Couldn't start the microphone. Paste a transcript or use Simulate meeting."); setView("transcript"); }
  }, [activeId, showToast]);
  const toggleRecording = () => (recording ? stopRecording() : startRecording());

  /* simulate */
  const stopSimulation = useCallback(() => {
    setSimulating(false); setInterim("");
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
  }, []);
  const simulateMeeting = useCallback(() => {
    if (!activeNote) return;
    if (simulating) { stopSimulation(); return; }
    const id = activeNote.id;
    setNotes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      const patch = { transcript: "", updatedAt: Date.now() };
      if (!n.title.trim()) patch.title = "Q3 Pipeline Sync";
      if (!n.attendees.trim()) patch.attendees = "Maya, Devin, Priya";
      if (!n.rawNotes.trim()) { patch.rawNotes = DEMO_RAW; patch.template = "planning"; }
      return { ...n, ...patch };
    }));
    setView("notes"); setSimulating(true);
    let i = 0;
    simRef.current = setInterval(() => {
      if (i >= DEMO_TRANSCRIPT_LINES.length) { stopSimulation(); showToast("Meeting captured. Hit Enhance to write up the notes."); return; }
      const line = DEMO_TRANSCRIPT_LINES[i];
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, transcript: (n.transcript ? n.transcript + "\n" : "") + line, updatedAt: Date.now() } : n));
      i++;
    }, 750);
  }, [activeNote, simulating, stopSimulation, showToast]);

  useEffect(() => () => { stopSimulation(); stopRecording(); }, [stopSimulation, stopRecording]);

  /* enhance */
  const runEnhance = useCallback(async () => {
    if (!activeNote) return;
    if (!settings.hasKey) { setSettingsOpen(true); showToast("Add your Anthropic API key in Settings to enhance notes."); return; }
    if (!activeNote.rawNotes.trim() && !activeNote.transcript.trim()) { showToast("Add a few notes or a transcript first, then Enhance."); return; }
    if (recording) stopRecording();
    if (simulating) stopSimulation();
    setView("enhanced"); setEnhancing(true);
    try {
      const result = await enhanceNotes({ rawNotes: activeNote.rawNotes, transcript: activeNote.transcript, template: activeNote.template });
      const patch = { enhanced: result, doneActions: {} };
      if (result.title && !activeNote.title.trim()) patch.title = result.title;
      updateNote(activeNote.id, patch);
    } catch (e) {
      if (e.code === "no-key") setSettingsOpen(true);
      showToast(e.message || "Enhancement failed. Try again.");
      setView("notes");
    } finally { setEnhancing(false); }
  }, [activeNote, settings.hasKey, recording, simulating, stopRecording, stopSimulation, updateNote, showToast]);

  /* chat */
  const sendChat = useCallback(async (overrideText) => {
    const text = (overrideText != null ? overrideText : chatInput).trim();
    if (!text || !activeNote || chatLoading) return;
    if (!settings.hasKey) { setSettingsOpen(true); showToast("Add your Anthropic API key in Settings to use Ask."); return; }
    setChatInput("");
    const userMsg = { role: "user", content: text };
    const history = [...(activeNote.chat || []), userMsg];
    updateNote(activeNote.id, { chat: history });
    setChatLoading(true);
    try {
      const context =
        "MEETING: " + (activeNote.title || "Untitled") +
        (activeNote.attendees ? "\nATTENDEES: " + activeNote.attendees : "") +
        "\n\nMY NOTES:\n" + (activeNote.rawNotes || "(none)") +
        "\n\nTRANSCRIPT:\n" + (activeNote.transcript ? activeNote.transcript.slice(0, 14000) : "(none)") +
        (activeNote.enhanced ? "\n\nENHANCED NOTES:\n" + enhancedToMarkdown(activeNote.enhanced, activeNote.title) : "");
      const system =
        "You are the meeting assistant inside an AI notepad. Answer questions about the specific meeting below using only its notes and transcript. " +
        "Be concise, direct, and practical. Use short paragraphs or bullets. Quote names and specifics when relevant. " +
        "If something wasn't covered, say so plainly rather than guessing.\n\n" + context;
      const answer = await callClaude({ system, messages: history.map((m) => ({ role: m.role, content: m.content })) });
      updateNote(activeNote.id, { chat: [...history, { role: "assistant", content: answer }] });
    } catch (e) {
      if (e.code === "no-key") setSettingsOpen(true);
      updateNote(activeNote.id, { chat: [...history, { role: "assistant", content: e.message || "Something went wrong. Please try again." }] });
    } finally { setChatLoading(false); }
  }, [chatInput, activeNote, chatLoading, settings.hasKey, updateNote, showToast]);

  useEffect(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight; }, [activeNote && activeNote.chat, chatLoading]);

  const copyEnhanced = useCallback(() => {
    if (!activeNote || !activeNote.enhanced) return;
    navigator.clipboard.writeText(enhancedToMarkdown(activeNote.enhanced, activeNote.title))
      .then(() => showToast("Enhanced notes copied as Markdown."), () => showToast("Couldn't copy."));
  }, [activeNote, showToast]);

  const exportEnhanced = useCallback(async () => {
    if (!activeNote || !activeNote.enhanced) return;
    const p = await window.granola.exportNote({ title: activeNote.title || "note", markdown: enhancedToMarkdown(activeNote.enhanced, activeNote.title) });
    if (p) showToast("Saved to " + p);
  }, [activeNote, showToast]);

  const toggleAction = (idx) => {
    if (!activeNote) return;
    const done = { ...(activeNote.doneActions || {}) }; done[idx] = !done[idx];
    updateNote(activeNote.id, { doneActions: done });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => (n.title || "").toLowerCase().includes(q) || (n.rawNotes || "").toLowerCase().includes(q) || (n.attendees || "").toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);
  const todayNotes = filtered.filter((n) => isToday(n.updatedAt));
  const earlierNotes = filtered.filter((n) => !isToday(n.updatedAt));
  const liveLines = useMemo(() => (activeNote ? (activeNote.transcript || "").split("\n").filter(Boolean).slice(-5) : []), [activeNote && activeNote.transcript]);

  const NoteRow = ({ n }) => (
    <button className={"g-item" + (n.id === activeId ? " sel" : "")} onClick={() => { setActiveId(n.id); setView("notes"); setSidebarOpen(false); }}>
      <div className="g-item-title">{n.title.trim() || "Untitled note"}</div>
      <div className="g-item-meta">
        {fmtTime(n.updatedAt)}
        {n.attendees ? " · " + n.attendees.split(",").filter(Boolean).length + " people" : ""}
        {n.enhanced ? " · enhanced" : ""}
      </div>
      <span className="g-item-del" role="button" aria-label="Delete note" onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}><ITrash size={14} /></span>
    </button>
  );

  return (
    <div className="g-root">
      <style>{STYLES}</style>
      <div className={"g-overlay" + (sidebarOpen ? " show" : "")} onClick={() => setSidebarOpen(false)} />

      <aside className={"g-sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="g-brand"><div className="g-brand-mark"><INotebook size={15} /></div><div className="g-brand-name">Debrief</div></div>
        <div className="g-side-pad">
          <button className="g-newbtn" onClick={newNote}><IPlus size={16} /> New note</button>
          <div className="g-search"><span><ISearch size={14} /></span><input placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        </div>
        <div className="g-list">
          {filtered.length === 0 && <div className="g-side-empty">No notes match that search.</div>}
          {todayNotes.length > 0 && <div className="g-group-label">Today</div>}
          {todayNotes.map((n) => <NoteRow key={n.id} n={n} />)}
          {earlierNotes.length > 0 && <div className="g-group-label">Earlier</div>}
          {earlierNotes.map((n) => <NoteRow key={n.id} n={n} />)}
        </div>
        <div className="g-side-foot">
          <button className="g-foot-btn" onClick={() => setSettingsOpen(true)}><ISettings size={15} /> Settings</button>
          <button className="g-foot-btn" onClick={() => window.granola.openNotesFolder()}><IFolder size={15} /> Notes folder</button>
        </div>
      </aside>

      <main className="g-main">
        <div className="g-topbar">
          <button className="g-hamburger" onClick={() => setSidebarOpen((s) => !s)} aria-label="Toggle sidebar"><IMenu size={18} /></button>
          <div className="g-top-spacer" />
          {activeNote && (
            <>
              <button className={"g-pillbtn" + (recording ? " rec" : "")} onClick={toggleRecording} disabled={simulating}>
                {recording ? <><span className="g-rec-dot" /> Stop</> : <><IMic size={15} /> Record</>}
              </button>
              <button className="g-pillbtn primary" onClick={runEnhance} disabled={enhancing}>
                {enhancing ? <ILoader size={15} style={{ animation: "g-spin 1s linear infinite" }} /> : <ISparkles size={15} />}
                {enhancing ? "Enhancing" : "Enhance"}
              </button>
              <button className={"g-pillbtn" + (chatOpen ? " active" : "")} onClick={() => setChatOpen((s) => !s)}><IChat size={15} /> Ask</button>
              <button className="g-iconbtn" onClick={() => setSettingsOpen(true)} aria-label="Settings"><ISettings size={16} /></button>
            </>
          )}
        </div>

        {ready && !settings.hasKey && (
          <div className="g-banner">
            <ISparkles size={15} />
            <span><b>Add your Anthropic API key</b> to turn on Enhance and Ask. Notes and typing work without it.</span>
            <button className="g-link" onClick={() => setSettingsOpen(true)}>Open Settings</button>
          </div>
        )}

        <div className="g-scroll">
          {!activeNote ? (
            <div className="g-page"><div className="g-empty">
              <span className="g-empty-ic"><INotebook size={20} /></span>
              <h3>No note selected</h3><p>Create a new note to start capturing a meeting.</p>
              <div style={{ marginTop: 18 }}><button className="g-pillbtn primary" onClick={newNote} style={{ display: "inline-flex" }}><IPlus size={15} /> New note</button></div>
            </div></div>
          ) : (
            <div className="g-page">
              <input className="g-title-input" placeholder="Untitled note" value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} />
              <div className="g-meta-row">
                <span className="g-meta-chip"><span><ICal size={14} /></span> {new Date(activeNote.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="g-meta-chip"><span><IUsers size={14} /></span>
                  <input className="g-att-input" placeholder="Add attendees" value={activeNote.attendees} onChange={(e) => updateNote(activeNote.id, { attendees: e.target.value })} />
                </span>
                <select className="g-tmpl" value={activeNote.template} onChange={(e) => updateNote(activeNote.id, { template: e.target.value })}>
                  {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="g-tabs">
                <button className={"g-tab" + (view === "notes" ? " sel" : "")} onClick={() => setView("notes")}>My notes</button>
                <button className={"g-tab" + (view === "enhanced" ? " sel" : "")} onClick={() => setView("enhanced")}>Enhanced{activeNote.enhanced && <span className="g-tab-count">●</span>}</button>
                <button className={"g-tab" + (view === "transcript" ? " sel" : "")} onClick={() => setView("transcript")}>Transcript{activeNote.transcript && <span className="g-tab-count">{activeNote.transcript.split("\n").filter(Boolean).length}</span>}</button>
              </div>

              {view === "notes" && (
                <>
                  <textarea className="g-notes-area"
                    placeholder="Type your notes here. Write as much or as little as you like. Granola fills in the detail from the conversation when you Enhance."
                    value={activeNote.rawNotes}
                    onChange={(e) => updateNote(activeNote.id, { rawNotes: e.target.value })}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runEnhance(); } }} />
                  {(recording || simulating) && (
                    <div className="g-livestrip">
                      <div className="g-livestrip-head">
                        <span className="g-rec-dot" />
                        <span className="g-livestrip-title">{simulating ? "Capturing meeting" : "Listening"}</span>
                        <span className="g-livestrip-sub">transcribing in the background</span>
                        <button className="g-stopbtn" onClick={() => (simulating ? stopSimulation() : stopRecording())}><ISquare size={11} /> Stop</button>
                      </div>
                      <div className="g-livestrip-body">
                        {liveLines.length === 0 && !interim && <span style={{ color: "var(--ink-3)" }}>Waiting for speech…</span>}
                        {liveLines.map((l, i) => <div key={i}>{l}</div>)}
                        {interim && <div style={{ opacity: .55 }}>{interim}</div>}
                      </div>
                    </div>
                  )}
                </>
              )}

              {view === "enhanced" && (
                <>
                  {enhancing ? (
                    <div className="g-sk">
                      <div className="g-sk-label"><ISparkles size={15} /> Enhancing your notes…</div>
                      <div className="g-sk-bar" style={{ width: "40%" }} /><div className="g-sk-bar" style={{ width: "90%" }} />
                      <div className="g-sk-bar" style={{ width: "78%" }} /><div className="g-sk-bar" style={{ width: "85%" }} />
                      <div className="g-sk-bar" style={{ width: "55%", marginTop: 22 }} /><div className="g-sk-bar" style={{ width: "92%" }} />
                    </div>
                  ) : activeNote.enhanced ? (
                    <EnhancedView e={activeNote.enhanced} done={activeNote.doneActions || {}} onToggle={toggleAction} onCopy={copyEnhanced} onExport={exportEnhanced} onReEnhance={runEnhance} />
                  ) : (
                    <div className="g-empty"><span className="g-empty-ic"><ISparkles size={20} /></span>
                      <h3>No enhanced notes yet</h3>
                      <p>Jot rough notes and capture a transcript, then hit Enhance. Claude turns it into clean, structured notes with action items.</p>
                    </div>
                  )}
                </>
              )}

              {view === "transcript" && (
                <>
                  <div className="g-tr-controls">
                    <button className={"g-pillbtn" + (simulating ? " rec" : "")} onClick={simulateMeeting}>
                      {simulating ? <><span className="g-rec-dot" /> Stop</> : <><IPlay size={14} /> Simulate meeting</>}
                    </button>
                    <button className={"g-pillbtn" + (recording ? " rec" : "")} onClick={toggleRecording} disabled={simulating}>
                      {recording ? <><span className="g-rec-dot" /> Stop</> : <><IMic size={14} /> Record</>}
                    </button>
                    {activeNote.transcript && <button className="g-pillbtn" onClick={() => updateNote(activeNote.id, { transcript: "" })}><ITrash size={14} /> Clear</button>}
                  </div>
                  <textarea className="g-tr-area"
                    placeholder="No transcript yet. Paste a transcript from Zoom, Meet, or Teams here, or click Simulate meeting to see the whole flow with a sample call."
                    value={activeNote.transcript} onChange={(e) => updateNote(activeNote.id, { transcript: e.target.value })} />
                  <div className="g-tr-hint">Tip: paste any meeting transcript, then switch to My notes, jot what matters, and Enhance.</div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {chatOpen && activeNote && (
        <aside className="g-chat">
          <div className="g-chat-head"><IChat size={16} style={{ color: "var(--accent)" }} /><h2>Ask anything</h2>
            <button className="g-chat-x" onClick={() => setChatOpen(false)} aria-label="Close chat"><IX size={16} /></button></div>
          <div className="g-chat-body" ref={chatBodyRef}>
            {(activeNote.chat || []).length === 0 && !chatLoading && (
              <>
                <div className="g-chat-empty">Ask about this meeting. I have your notes and the transcript.</div>
                <div className="g-quick">{QUICK_PROMPTS.map((q) => <button key={q.label} onClick={() => sendChat(q.text)}><q.Icon size={13} /> {q.label}</button>)}</div>
              </>
            )}
            {(activeNote.chat || []).map((m, i) => m.role === "user"
              ? <div key={i} className="g-msg-user">{m.content}</div>
              : <div key={i} className="g-msg-ai"><RichText text={m.content} /></div>)}
            {chatLoading && <div className="g-msg-ai" style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}><ILoader size={14} style={{ animation: "g-spin 1s linear infinite" }} /> Thinking…</div>}
          </div>
          <div className="g-chat-foot">
            <div className="g-chat-inputwrap">
              <textarea className="g-chat-input" rows={1} placeholder="Ask about this meeting…" value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button className="g-sendbtn" onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} aria-label="Send"><ISend size={15} /></button>
            </div>
          </div>
        </aside>
      )}

      {settingsOpen && (
        <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)}
          onSave={async (patch) => { try { const s = await window.granola.setSettings(patch); setSettings(s); showToast("Settings saved."); } catch { showToast("Couldn't save settings."); } setSettingsOpen(false); }}
          onOpenFolder={() => window.granola.openNotesFolder()} />
      )}

      {toast && <div className="g-toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enhanced view                                                     */
/* ------------------------------------------------------------------ */
function EnhancedView({ e, done, onToggle, onCopy, onExport, onReEnhance }) {
  const sCount = (e.sections || []).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 2 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 20 }}><ISparkles size={12} /> Enhanced</span>
        <div style={{ flex: 1 }} />
        <button className="g-pillbtn" onClick={onReEnhance} style={{ padding: "5px 10px", fontSize: 12 }}><ISparkles size={13} /> Re-enhance</button>
        <button className="g-pillbtn" onClick={onCopy} style={{ padding: "5px 10px", fontSize: 12 }}><ICopy size={13} /> Copy</button>
        <button className="g-pillbtn" onClick={onExport} style={{ padding: "5px 10px", fontSize: 12 }}><IDownload size={13} /> Export</button>
      </div>
      {e.summary && <p className="g-enh-lead">{e.summary}</p>}
      {(e.sections || []).map((s, si) => (
        <div className="g-enh-section" key={si} style={{ animationDelay: si * 70 + "ms" }}>
          <div className="g-enh-h">{s.heading}</div>
          <ul className="g-enh-ul">
            {(s.bullets || []).map((b, bi) => (
              <li className="g-enh-li" key={bi}>{b.text}
                {b.sub && b.sub.length > 0 && <ul className="g-enh-sub">{b.sub.map((x, xi) => <li className="g-enh-subli" key={xi}>{x}</li>)}</ul>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {e.decisions && e.decisions.length > 0 && (
        <div className="g-enh-section" style={{ animationDelay: sCount * 70 + "ms" }}>
          <div className="g-enh-h">Decisions</div>
          <ul className="g-enh-ul">{e.decisions.map((d, i) => <li className="g-enh-li" key={i}>{d}</li>)}</ul>
        </div>
      )}
      {e.actions && e.actions.length > 0 && (
        <div className="g-actions-card g-enh-section" style={{ animationDelay: (sCount + 1) * 70 + "ms" }}>
          <div className="g-enh-h">Next steps</div>
          {e.actions.map((a, i) => (
            <div className="g-action" key={i} onClick={() => onToggle(i)} style={{ cursor: "pointer" }}>
              <span className={"g-check" + (done[i] ? " done" : "")}>{done[i] && <ICheck size={13} />}</span>
              <span className={"g-action-text" + (done[i] ? " done" : "")}>{a.owner && <span className="g-action-owner">{a.owner}: </span>}{a.task}</span>
              {a.due && <span className="g-due">{a.due}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings modal                                                    */
/* ------------------------------------------------------------------ */
function SettingsModal({ settings, onClose, onSave, onOpenFolder }) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(settings.model || "claude-sonnet-4-6");
  return (
    <div className="g-modal-bg" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div className="g-modal-head"><ISettings size={17} /><h2>Settings</h2><button className="g-chat-x" onClick={onClose} aria-label="Close"><IX size={16} /></button></div>
        <div className="g-modal-body">
          <div className="g-field">
            <label>Anthropic API key</label>
            {settings.hasKey
              ? <div className="g-keytag"><ICheck size={13} /> A key is saved {settings.encrypted ? "and encrypted" : ""} on this computer</div>
              : null}
            <input className="g-input" type="password" placeholder={settings.hasKey ? "Enter a new key to replace it" : "sk-ant-..."} value={key} onChange={(e) => setKey(e.target.value)} style={{ marginTop: settings.hasKey ? 8 : 0 }} />
            <div className="hint">Get a key from the Anthropic Console under API Keys. It is stored only on this machine and used to call Anthropic directly from this app. Usage is billed to your own Anthropic account.</div>
          </div>
          <div className="g-field">
            <label>Model</label>
            <select className="g-select" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="g-field" style={{ marginBottom: 0 }}>
            <label>Where notes are stored</label>
            <div className="g-pathbox">{settings.notesPath || "(loading)"}</div>
            <button className="g-pillbtn" onClick={onOpenFolder} style={{ marginTop: 8, fontSize: 12, padding: "6px 10px" }}><IFolder size={13} /> Open notes folder</button>
          </div>
        </div>
        <div className="g-modal-foot">
          <div style={{ flex: 1 }} />
          <button className="g-pillbtn" onClick={onClose}>Cancel</button>
          <button className="g-pillbtn primary" onClick={() => onSave({ apiKey: key || undefined, model })}>Save</button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
