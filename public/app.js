/* chatmany web UI (Section 7A). Vanilla JS SPA served from the Worker. A single-owner token
   (stored in localStorage) authorizes every /api call. The UI is a config editor + monitor over
   the same campaigns/events/conversations tables the engine uses — no new funnel behavior. */

const TOKEN_KEY = "chatmany_token";
const GH_URL = "https://github.com/";

const store = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  status: null,
  page: "automations",
  media: [],
  campaigns: [],
  automationStats: {}, // campaign_id -> { runs, ctr }
  draft: null,
  // JSON snapshot of the draft as it was last loaded or saved. Anything different
  // means there are unsaved edits — see isDirty(). Snapshotting the whole draft
  // catches click-driven toggles too, not just typed input.
  savedSnapshot: null,
  previewTab: "dm",
  captionExpanded: false,
  dash: null,
  contacts: [],
  dashDays: 30,
  dashCampaign: "",
  contactsCampaign: "",
  automationsSearch: "",
  automationsState: "",
  selectedAutomations: new Set(),
  archiveCampaigns: [],
  archiveSearch: "",
  mediaShowAll: false,
  // Builder: which preview bubble mirrors the focused field, and the post picked before "any post".
  previewFocus: null,
  lastMediaId: "",
  // Automations list: folder filter ("" = all) and list/grid view (remembered in this browser).
  autoFolder: "",
  autoView: (() => {
    try {
      return localStorage.getItem("chatmany_view") === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  })(),
};

/* ---------------- embedding + theme + language ----------------
   Postiz shows this UI on its Automations page as ?embed=1&theme=dark|light&lang=<code> and
   posts { type: "postiz:theme", theme } / { type: "postiz:language", language } to this frame
   whenever its light/dark switch or language changes. Templates stay in English; i18n.js
   translates what is rendered (see there). */
const params = new URLSearchParams(location.search);
const i18n = window.chatmanyI18n;
i18n.setLanguage(params.get("lang") || navigator.language);
const EMBEDDED = params.get("embed") === "1";
const THEMES = ["dark", "light"];
// Instagram refuses to render inside a frame, so when embedded the connect flow opens a new tab.
const CONNECT_TARGET = EMBEDDED ? ' target="_blank" rel="noopener"' : "";

function applyTheme(theme) {
  if (THEMES.includes(theme)) document.documentElement.dataset.theme = theme;
}

// Postiz passes a short-lived single sign-on ticket in the fragment (#sso=...), which never
// reaches a server log or Referer. Read it once and drop it from the address right away.
const SSO_TICKET = new URLSearchParams(location.hash.slice(1)).get("sso") || "";
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

applyTheme(params.get("theme") || "dark");
i18n.watch(document.body);
if (EMBEDDED) {
  document.body.classList.add("embedded");
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === "postiz:theme") applyTheme(e.data.theme);
    if (e.data.type === "postiz:language" && i18n.setLanguage(e.data.language) !== undefined) {
      // Re-render from the English templates so the new language applies everywhere.
      if (store.status) renderApp();
      else if (!store.token) renderSignedOut();
    }
  });
}

const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = (s) =>
  String(s || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "campaign";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${store.token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    store.token = "";
    localStorage.removeItem(TOKEN_KEY);
    if (EMBEDDED) renderSignedOut();
    else renderLogin("Session token was rejected. Enter it again.");
    throw new Error("unauthorized");
  }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

function toast(msg, isErr = false) {
  const t = el(`<div class="toast ${isErr ? "err" : ""}">${esc(i18n.t(msg))}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 2400);
}

/* ---------------- icons ---------------- */
const ICON = {
  spark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>`,
  create: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`,
  automations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  contacts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.22-3.37-1.22-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.33 4.81-4.56 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.5 5.5c2 0 3.2 1.2 3.5 2 .3-.8 1.5-2 3.5-2 3.5 0 5 3.5 3 7C19 16.65 12 21 12 21z"/></svg>`,
  heartO: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.5 5.5c2 0 3.2 1.2 3.5 2 .3-.8 1.5-2 3.5-2 3.5 0 5 3.5 3 7C19 16.65 12 21 12 21z"/></svg>`,
  cmt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`,
};

/* ---------------- boot ---------------- */
async function boot() {
  if (SSO_TICKET) await signInWithPostiz(SSO_TICKET);
  if (!store.token) return EMBEDDED ? renderSignedOut() : renderLogin();
  try {
    store.status = await api("/api/status");
  } catch {
    return; // renderLogin already shown on 401
  }
  renderApp();
}

// Embedded, Instagram is connected in another tab; pick the new connection up when the owner
// comes back. Only while disconnected, so a re-render never discards an in-progress draft.
if (EMBEDDED) {
  window.addEventListener("focus", async () => {
    if (!store.token || (store.status && store.status.connected)) return;
    try {
      store.status = await api("/api/status");
      if (store.status.connected) renderApp();
    } catch {
      /* 401 handled */
    }
  });
}

/** Trade Postiz's ticket for a session token; on failure keep whatever token was stored. */
async function signInWithPostiz(ticket) {
  try {
    const res = await fetch("/auth/sso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
    if (!res.ok) return;
    const { token } = await res.json();
    if (!token) return;
    store.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* network error: fall through to the stored token, if any */
  }
}

/**
 * Embedded in Postiz there is no owner-token form: Postiz signs the owner in. When that fails
 * (single sign-on not configured, or a session that expired), say how to get back in.
 */
function renderSignedOut() {
  document.title = "chatmany";
  $("#app").innerHTML = `
    <div class="gate-wrap"><div class="gate-card">
      <div class="gate-icon">${ICON.spark}</div>
      <h2>Couldn't sign you in</h2>
      <p>Reload this page in Postiz to sign in again. If it keeps happening, check that CHATMANY_SSO_SECRET in Postiz matches POSTIZ_SSO_SECRET in chatmany.</p>
    </div></div>`;
}

/* ---------------- login / connect ---------------- */
function renderLogin(err) {
  document.title = "chatmany — sign in";
  const app = $("#app");
  app.innerHTML = "";
  const card = el(`
    <div class="login-wrap"><div class="login-card">
      <div class="brand"><span class="spark">${ICON.spark}</span><span class="name">chatmany</span></div>
      <h2>Owner sign in</h2>
      <p>Enter the owner token you set as the <code>OWNER_TOKEN</code> secret.</p>
      ${err ? `<div class="banner">${esc(err)}</div>` : ""}
      <label class="field"><span class="label">Owner token</span>
        <input type="password" id="tok" placeholder="Your OWNER_TOKEN" autocomplete="off" /></label>
      <button class="btn primary" id="go" style="width:100%">Continue</button>
    </div></div>`);
  app.appendChild(card);
  const submit = async () => {
    const val = $("#tok").value.trim();
    if (!val) return;
    store.token = val;
    try {
      store.status = await api("/api/status");
      localStorage.setItem(TOKEN_KEY, val);
      renderApp();
    } catch {
      /* 401 handled */
    }
  };
  $("#go").onclick = submit;
  $("#tok").onkeydown = (e) => {
    if (e.key === "Enter") submit();
  };
}

/* ---------------- app shell ---------------- */
function renderApp() {
  document.title = "chatmany";
  const s = store.status || {};
  const app = $("#app");
  app.innerHTML = "";
  const layout = el(`
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><span class="spark">${ICON.spark}</span><span class="name">chatmany</span></div>
        <nav class="nav">
          <button class="nav-item" data-page="automations">${ICON.automations}<span>Automations</span></button>
          <button class="nav-item" data-page="create">${ICON.create}<span>Create</span></button>
          <button class="nav-item" data-page="dashboard">${ICON.dashboard}<span>Dashboard</span></button>
          <button class="nav-item" data-page="contacts">${ICON.contacts}<span>Contacts</span></button>
          <button class="nav-item" data-page="archive">${ICON.archive}<span>Archive</span></button>
        </nav>
        <div class="sidebar-footer">
          <div class="profile">
            <img class="avatar" src="${esc(s.profile_picture_url || "")}" alt="" onerror="this.style.visibility='hidden'"/>
            <div class="who">
              <div class="handle">${s.connected ? "@" + esc(s.username || "account") : "Not connected"}</div>
              <span class="tag">self-hosted</span>
            </div>
          </div>
          <a class="gh-link" href="${GH_URL}" target="_blank" rel="noopener">${ICON.github}<span>Star on GitHub</span></a>
          <div class="legal-links">
            <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
            <span>·</span>
            <a href="/data-deletion" target="_blank" rel="noopener">Data deletion</a>
          </div>
        </div>
      </aside>
      <main class="main"><div class="main-wrap" id="view"></div></main>
    </div>`);
  app.appendChild(layout);
  layout.querySelectorAll(".nav-item").forEach((b) => {
    b.onclick = () => {
      if (store.page === "create" && b.dataset.page !== "create" && !confirmDiscard("leave this page")) return;
      store.page = b.dataset.page;
      paintNav();
      route();
    };
  });
  paintNav();
  route();
}

function paintNav() {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === store.page));
}

// /auth/authorize is owner-gated. A link navigation cannot send an Authorization header, so the
// token goes in the query; the redirect it returns sets Referrer-Policy: no-referrer.
function authorizeUrl() {
  return `/auth/authorize?token=${encodeURIComponent(store.token)}`;
}

// When Postiz manages Instagram (status.managed_by === "postiz") the connect step lives there:
// Add Channel -> Instagram (Standalone) on its calendar page, at the address /api/status reports.
function postizManaged() {
  return (store.status || {}).managed_by === "postiz";
}

function postizChannelsUrl() {
  try {
    const base = (store.status || {}).postiz_url;
    return base ? `${new URL(base).origin}/launches` : "";
  } catch {
    return "";
  }
}

function connectLink(attrs = "") {
  if (!postizManaged()) return `<a ${attrs} href="${authorizeUrl()}"${CONNECT_TARGET}>Connect Instagram</a>`;
  const href = postizChannelsUrl();
  return href
    ? `<a ${attrs} href="${esc(href)}" target="${EMBEDDED ? "_top" : "_blank"}" rel="noopener">Connect Instagram in Postiz</a>`
    : `<span>Connect it in Postiz: Add Channel → Instagram (Standalone)</span>`;
}

function connectBanner() {
  const s = store.status || {};
  if (s.connected && !s.token_expired) return "";
  const msg = s.connected && s.token_expired ? "Your Instagram token expired — reconnect to resume." : "No Instagram account connected yet.";
  return `<div class="banner">${msg} ${connectLink()}</div>`;
}

/**
 * Hard gate for automation pages: until an Instagram account is connected there is nothing a
 * campaign could run against, so the list/builder are replaced by a connect prompt instead of
 * rendering dead controls. An expired token does NOT gate (the connector exists — the banner
 * already prompts a reconnect and history stays browsable).
 */
function renderConnectGate(view, what) {
  view.innerHTML = `
    <div class="gate-wrap"><div class="gate-card">
      <div class="gate-icon">${ICON.send}</div>
      <h2>Connect Instagram first</h2>
      <p>${esc(what)} need a connected Instagram Professional account — there's nothing for an automation to watch or send until one is linked.</p>
      ${connectLink('class="btn primary"')}
      <p class="gate-hint">${
        postizManaged()
          ? "Connect it once in Postiz (Add Channel → Instagram (Standalone)); it's used here automatically."
          : "You'll approve access on Instagram's own page. chatmany never sees your password."
      }</p>
    </div></div>`;
}

function route() {
  const view = $("#view");
  view.innerHTML = `<div class="empty">Loading…</div>`;
  if (store.page === "automations") renderAutomations();
  else if (store.page === "create") renderCreate();
  else if (store.page === "dashboard") renderDashboard();
  else if (store.page === "contacts") renderContacts();
  else if (store.page === "archive") renderArchive();
}

/** Relative time string ("4 hours ago") from a unix-seconds timestamp. */
function timeAgo(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

/** Open the Create builder pre-loaded with an existing campaign, or blank for a new one. */
function openInBuilder(campaign) {
  store.draft = campaign ? draftFromCampaign(campaign) : defaultDraft();
  markSaved();
  store.mediaShowAll = false;
  store.page = "create";
  paintNav();
  route();
}

/** Delete one or more campaigns by id, then refresh the automations list. */
async function deleteCampaigns(ids) {
  if (ids.length === 0) return;
  const label = ids.length === 1 ? "this automation" : `these ${ids.length} automations`;
  if (!confirm(i18n.t(`Delete ${label}? This can't be undone.`))) return;
  try {
    await Promise.all(ids.map((id) => api("/api/campaigns/delete", { method: "POST", body: { campaign_id: id } })));
    store.selectedAutomations.clear();
    toast(ids.length === 1 ? "Automation deleted" : `${ids.length} automations deleted`);
    renderAutomations();
  } catch (e) {
    toast(e.message, true);
  }
}

/**
 * Archive (or restore) one or more campaigns by id. Unlike delete, this is non-destructive —
 * archiving stops the automation and hides it from the main list, but keeps every conversation,
 * event, and comment record intact, and it can be restored from the Archive tab at any time.
 */
async function archiveCampaigns(ids, archived) {
  if (ids.length === 0) return;
  try {
    await Promise.all(ids.map((id) => api("/api/campaigns/archive", { method: "POST", body: { campaign_id: id, archived } })));
    store.selectedAutomations.clear();
    toast(
      archived
        ? ids.length === 1 ? "Automation archived" : `${ids.length} automations archived`
        : ids.length === 1 ? "Automation restored" : `${ids.length} automations restored`,
    );
    archived ? renderAutomations() : renderArchive();
  } catch (e) {
    toast(e.message, true);
  }
}

/* ================= AUTOMATIONS (list) ================= */
async function renderAutomations() {
  const view = $("#view");
  // Skip Instagram check for demo/dev: allows viewing automations UI without connection
  // if (!(store.status || {}).connected) return renderConnectGate(view, "Automations");
  try {
    store.campaigns = (await api("/api/campaigns")).campaigns || [];
  } catch (e) {
    view.innerHTML = connectBanner() + `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  try {
    if (store.media.length === 0 && store.status.connected && !store.status.token_expired) {
      const r = await api("/api/media");
      store.media = r.media || [];
    }
  } catch {
    // thumbnails are a nice-to-have; don't block the list on a media fetch failure
  }

  // Pull lightweight all-time stats (runs = opening_sent, ctr = clicks/opens) per campaign.
  const statsEntries = await Promise.all(
    store.campaigns.map(async (c) => {
      try {
        const d = await api(`/api/dashboard?campaign_id=${encodeURIComponent(c.campaign_id)}&days=3650`);
        return [c.campaign_id, { runs: d.cards.sends, ctr: d.cards.ctr }];
      } catch {
        return [c.campaign_id, { runs: 0, ctr: 0 }];
      }
    }),
  );
  store.automationStats = Object.fromEntries(statsEntries);
  if (store.autoFolder && !allFolders().includes(store.autoFolder)) store.autoFolder = "";

  view.innerHTML = `
    ${connectBanner()}
    <div class="page-head">
      <div><div class="page-title">My automations</div><div class="page-sub">Every comment-to-DM funnel in this instance.</div></div>
      <button class="btn primary" id="newauto">+ New automation</button>
    </div>
    <div class="automations-toolbar">
      <div class="search-wrap">${ICON.search}<input class="search" id="autosearch" type="text" placeholder="Search all automations" value="${esc(store.automationsSearch)}"/></div>
      <select id="autotrigger"><option>Any trigger</option><option>Comment</option></select>
      <select id="autostate"><option value="">Any trigger states</option>
        <option value="live" ${store.automationsState === "live" ? "selected" : ""}>Live</option>
        <option value="stopped" ${store.automationsState === "stopped" ? "selected" : ""}>Stopped</option>
      </select>
    </div>
    <div class="automations-row2">
      <button class="folder-btn" id="newfolder">${ICON.folder} New folder</button>
      <button class="trash-link" id="trashlink">${ICON.archive} Archive</button>
    </div>
    <div class="folder-chips" id="folderchips"></div>
    <div class="automations-row3"><button class="grid-link" id="gridlink">${ICON.grid} <span>${
      store.autoView === "grid" ? "View as list" : "View as grid"
    }</span></button></div>
    <div id="autolist"></div>`;

  $("#newauto").onclick = () => openInBuilder(null);
  $("#newfolder").onclick = () => {
    const name = (prompt(i18n.t("Folder name")) || "").trim().slice(0, 60);
    if (!name) return;
    saveExtraFolders([...extraFolders(), name]);
    store.autoFolder = name;
    paintFolderChips();
    paintAutoList();
  };
  $("#trashlink").onclick = () => { store.page = "archive"; paintNav(); route(); };
  $("#gridlink").onclick = () => {
    store.autoView = store.autoView === "grid" ? "list" : "grid";
    try {
      localStorage.setItem(VIEW_KEY, store.autoView);
    } catch {
      /* the choice just won't be remembered */
    }
    $("#gridlink span").textContent = store.autoView === "grid" ? "View as list" : "View as grid";
    paintAutoList();
  };
  $("#autotrigger").onchange = () => {}; // only one trigger type exists today (comment); reserved for future triggers
  $("#autosearch").oninput = (e) => {
    store.automationsSearch = e.target.value;
    paintAutoList();
  };
  $("#autostate").onchange = (e) => {
    store.automationsState = e.target.value;
    paintAutoList();
  };

  paintFolderChips();
  paintAutoList();
}

/* ---------------- folders ----------------
   A folder is just a name on the campaign (campaign.folder). Folders created here before anything
   is filed in them are remembered in this browser until an automation uses them. */
const FOLDERS_KEY = "chatmany_folders";
const VIEW_KEY = "chatmany_view";

function extraFolders() {
  try {
    const list = JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((f) => typeof f === "string" && f) : [];
  } catch {
    return [];
  }
}

function saveExtraFolders(list) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify([...new Set(list)]));
  } catch {
    /* not remembered across reloads; the folder still works for this session */
  }
}

function allFolders() {
  const used = store.campaigns.map((c) => c.folder).filter(Boolean);
  return [...new Set([...used, ...extraFolders()])].sort((a, b) => a.localeCompare(b));
}

function paintFolderChips() {
  const box = $("#folderchips");
  if (!box) return;
  const folders = allFolders();
  if (!folders.length) {
    box.innerHTML = "";
    return;
  }
  const count = (f) => store.campaigns.filter((c) => (c.folder || "") === f).length;
  const chip = (value, label, n) =>
    `<button class="folder-chip ${store.autoFolder === value ? "active" : ""}" data-folder="${esc(value)}">${value ? ICON.folder : ""}<span>${esc(label)}</span><span class="n">${n}</span></button>`;
  box.innerHTML = chip("", "All", store.campaigns.length) + folders.map((f) => chip(f, f, count(f))).join("");
  box.querySelectorAll(".folder-chip").forEach((b) => {
    b.onclick = () => {
      store.autoFolder = b.dataset.folder;
      paintFolderChips();
      paintAutoList();
    };
  });
}

/** File the given automations under `folder` ("" = no folder). */
async function moveToFolder(ids, folder) {
  try {
    await Promise.all(
      ids.map((id) => {
        const c = store.campaigns.find((x) => x.campaign_id === id);
        if (!c) return null;
        return api("/api/campaigns", { method: "POST", body: { campaign: { ...c, folder: folder || undefined }, active: !!c.active } });
      }),
    );
    store.selectedAutomations.clear();
    toast(folder ? "Moved to folder" : "Removed from folder");
    renderAutomations();
  } catch (e) {
    toast(e.message, true);
  }
}

/** What fires the automation, in words: which post, which words. */
function triggerSummary(c) {
  const anyPost = c.media_id === ANY_MEDIA;
  const thumb = anyPost ? "" : (store.media.find((m) => m.id === c.media_id) || {}).thumbnail_url || "";
  const words = c.match_any ? "any word" : (c.keywords || [])[0] || "—";
  return { anyPost, thumb, words };
}

function paintAutoList() {
  const box = $("#autolist");
  if (!box) return;
  const q = store.automationsSearch.trim().toLowerCase();
  const rows = store.campaigns.filter((c) => {
    if (q && !(c.name || c.campaign_id).toLowerCase().includes(q)) return false;
    if (store.automationsState === "live" && !c.active) return false;
    if (store.automationsState === "stopped" && c.active) return false;
    if (store.autoFolder && (c.folder || "") !== store.autoFolder) return false;
    return true;
  });

  if (store.campaigns.length === 0) {
    box.innerHTML = `<div class="empty">${ICON.automations}<div>No automations yet. Click "+ New automation" to build your first comment-to-DM funnel.</div></div>`;
    return;
  }
  if (rows.length === 0) {
    box.innerHTML = `<div class="empty">No automations match your search.</div>`;
    return;
  }

  // Selection can only ever contain ids currently visible; drop any that scrolled out via filtering.
  const visibleIds = new Set(rows.map((c) => c.campaign_id));
  for (const id of [...store.selectedAutomations]) if (!visibleIds.has(id)) store.selectedAutomations.delete(id);
  const n = store.selectedAutomations.size;

  box.innerHTML = "";
  if (n > 0) {
    const folders = allFolders();
    box.appendChild(
      el(`<div class="bulk-bar"><span>${n} selected</span><div class="spacer"></div>
        <select id="bulkfolder" class="bulk-folder"><option value="">Move to folder…</option>${folders
          .map((f) => `<option value="${esc(f)}">${esc(f)}</option>`)
          .join("")}<option value="__none">No folder</option><option value="__new">New folder…</option></select>
        <button class="btn ghost sm" id="bulkarchive">${ICON.archive} Archive</button>
        <button class="btn danger sm" id="bulkdelete">${ICON.trash} Delete</button>
        <button class="btn ghost sm" id="bulkcancel">Cancel</button></div>`),
    );
  }

  if (store.autoView === "grid") {
    const grid = el(`<div class="auto-grid"></div>`);
    rows.forEach((c) => {
      const { anyPost, thumb, words } = triggerSummary(c);
      const stats = store.automationStats[c.campaign_id] || { runs: 0, ctr: 0 };
      const card = el(`
        <div class="auto-card" data-id="${esc(c.campaign_id)}" tabindex="0">
          <div class="auto-card-media">
            ${thumb ? `<img src="${esc(thumb)}" alt=""/>` : `<div class="placeholder">${anyPost ? ICON.grid : ICON.automations}<span>${anyPost ? "Any post or reel" : ""}</span></div>`}
            <span class="status-pill ${c.active ? "live" : "stopped"}">${c.active ? "live" : "stopped"}</span>
          </div>
          <div class="auto-card-body">
            <div class="auto-name">${esc(c.name || c.campaign_id)}</div>
            <div class="auto-trigger"><span class="kw-pill">${esc(words)}</span>${c.folder ? `<span class="folder-tag">${ICON.folder}${esc(c.folder)}</span>` : ""}</div>
            <div class="auto-card-stats"><span><b>${stats.runs}</b> Runs</span><span><b>${stats.runs > 0 ? stats.ctr + "%" : "n/a"}</b> CTR</span></div>
          </div>
        </div>`);
      card.onclick = () => openInBuilder(c);
      card.onkeydown = (e) => e.key === "Enter" && openInBuilder(c);
      grid.appendChild(card);
    });
    box.appendChild(grid);
  } else {
    box.appendChild(
      el(`<div class="auto-list-head"><span></span><span>Name ▾</span><span>Runs</span><span>CTR</span><span>Modified ▾</span></div>`),
    );
    rows.forEach((c) => {
      const { anyPost, thumb, words } = triggerSummary(c);
      const stats = store.automationStats[c.campaign_id] || { runs: 0, ctr: 0 };
      const checked = store.selectedAutomations.has(c.campaign_id);
      const row = el(`
        <div class="auto-row ${checked ? "selected" : ""}" data-id="${esc(c.campaign_id)}">
          <input type="checkbox" ${checked ? "checked" : ""}/>
          <div class="auto-name-cell">
            <div class="auto-name-line">
              <span class="status-pill ${c.active ? "live" : "stopped"}">${c.active ? "live" : "stopped"}</span>
              <span class="auto-name">${esc(c.name || c.campaign_id)}</span>
              ${c.folder && !store.autoFolder ? `<span class="folder-tag">${ICON.folder}${esc(c.folder)}</span>` : ""}
            </div>
            <div class="auto-trigger">
              ${anyPost ? `<span class="any-pill">${ICON.grid}<span>Any post or reel</span></span>` : thumb ? `<img src="${esc(thumb)}" alt=""/>` : ""}
              <span>User comments and comment contains</span>
              <span class="kw-pill">${esc(words)}</span>
            </div>
          </div>
          <div><span class="num">${stats.runs}</span></div>
          <div><span class="num">${stats.runs > 0 ? stats.ctr + "%" : "n/a"}</span></div>
          <div class="muted">${timeAgo(c.updated_at)}</div>
        </div>`);
      row.querySelector('input[type="checkbox"]').onclick = (e) => {
        e.stopPropagation();
        if (e.target.checked) store.selectedAutomations.add(c.campaign_id);
        else store.selectedAutomations.delete(c.campaign_id);
        paintAutoList();
      };
      row.onclick = () => openInBuilder(c);
      box.appendChild(row);
    });
  }

  const bulkFolder = $("#bulkfolder");
  if (bulkFolder) {
    bulkFolder.onchange = (e) => {
      const ids = [...store.selectedAutomations];
      let folder = e.target.value;
      if (!folder) return;
      if (folder === "__new") {
        folder = (prompt(i18n.t("Folder name")) || "").trim().slice(0, 60);
        if (!folder) return (e.target.value = "");
        saveExtraFolders([...extraFolders(), folder]);
      }
      moveToFolder(ids, folder === "__none" ? "" : folder);
    };
  }
  const bulkArchive = $("#bulkarchive");
  if (bulkArchive) bulkArchive.onclick = (e) => { e.stopPropagation(); archiveCampaigns([...store.selectedAutomations], true); };
  const bulkDelete = $("#bulkdelete");
  if (bulkDelete) bulkDelete.onclick = (e) => { e.stopPropagation(); deleteCampaigns([...store.selectedAutomations]); };
  const bulkCancel = $("#bulkcancel");
  if (bulkCancel) bulkCancel.onclick = (e) => { e.stopPropagation(); store.selectedAutomations.clear(); paintAutoList(); };
}

/* ================= ARCHIVE ================= */
async function renderArchive() {
  const view = $("#view");
  try {
    store.archiveCampaigns = (await api("/api/campaigns?archived=1")).campaigns || [];
  } catch (e) {
    view.innerHTML = connectBanner() + `<div class="empty">${esc(e.message)}</div>`;
    return;
  }

  view.innerHTML = `
    ${connectBanner()}
    <div class="page-head">
      <div><div class="page-title">Archive</div><div class="page-sub">Stopped automations, kept out of the way but not deleted — restore any of them at any time.</div></div>
    </div>
    <div class="automations-toolbar">
      <div class="search-wrap">${ICON.search}<input class="search" id="archsearch" type="text" placeholder="Search archived automations" value="${esc(store.archiveSearch)}"/></div>
    </div>
    <div id="archlist"></div>`;

  $("#archsearch").oninput = (e) => {
    store.archiveSearch = e.target.value;
    paintArchiveList();
  };

  paintArchiveList();
}

function paintArchiveList() {
  const box = $("#archlist");
  if (!box) return;
  const q = store.archiveSearch.trim().toLowerCase();
  const rows = store.archiveCampaigns.filter((c) => !q || (c.name || c.campaign_id).toLowerCase().includes(q));

  if (store.archiveCampaigns.length === 0) {
    box.innerHTML = `<div class="empty">${ICON.archive}<div>Nothing archived. Archive an automation from the Automations tab to keep it around without it running.</div></div>`;
    return;
  }
  if (rows.length === 0) {
    box.innerHTML = `<div class="empty">No archived automations match your search.</div>`;
    return;
  }

  box.innerHTML = "";
  box.appendChild(
    el(`<div class="auto-list-head"><span></span><span>Name ▾</span><span></span><span></span><span>Archived ▾</span></div>`),
  );
  rows.forEach((c) => {
    const kw = (c.keywords || [])[0] || "—";
    const row = el(`
      <div class="auto-row archived-row" data-id="${esc(c.campaign_id)}">
        <span></span>
        <div class="auto-name-cell">
          <div class="auto-name-line">
            <span class="status-pill stopped">archived</span>
            <span class="auto-name">${esc(c.name || c.campaign_id)}</span>
          </div>
          <div class="auto-trigger"><span>User comments and comment contains</span><span class="kw-pill">${esc(kw)}</span></div>
        </div>
        <div></div>
        <div class="archive-actions">
          <button class="btn ghost sm" data-act="restore">Restore</button>
          <button class="btn danger sm" data-act="delete">Delete</button>
        </div>
        <div class="muted">${timeAgo(c.updated_at)}</div>
      </div>`);
    row.querySelector('[data-act="restore"]').onclick = (e) => {
      e.stopPropagation();
      archiveCampaigns([c.campaign_id], false);
    };
    row.querySelector('[data-act="delete"]').onclick = (e) => {
      e.stopPropagation();
      deleteFromArchive(c.campaign_id);
    };
    box.appendChild(row);
  });
}

/** Permanently delete an archived campaign, then refresh the archive list. */
async function deleteFromArchive(id) {
  if (!confirm(i18n.t("Permanently delete this automation? This can't be undone."))) return;
  try {
    await api("/api/campaigns/delete", { method: "POST", body: { campaign_id: id } });
    toast("Automation permanently deleted");
    renderArchive();
  } catch (e) {
    toast(e.message, true);
  }
}

/* ================= CREATE (builder) ================= */
// Starter copy for a new automation. These are the messages followers receive, so they are
// written in the UI language up front (never translated on screen, unlike the rest of the UI).
const DEFAULT_COPY = {
  en: {
    name: "My automation",
    keyword: "Link",
    public_replies: ["Sent you a DM! 📩", "Check your DMs 👀"],
    opening: "Hey! Tap below to grab the link 👇",
    opening_button: "Send it to me",
    follow_gate: "Make sure you're following so you don't miss the next one 🙌 Not following yet? Follow, then tap below.",
    follow_button: "✅ I followed",
    email_ask: "Want it in your inbox too? Tap your email or reply with it.",
    delivery: "Here you go 🎉 {reward}",
    followup: "Did you catch it? Here's your link again 👉 {reward}",
  },
  pt: {
    name: "Minha automação",
    keyword: "Link",
    public_replies: ["Te mandei uma DM! 📩", "Confere sua DM 👀"],
    opening: "Oi! Toca no botão abaixo pra receber o link 👇",
    opening_button: "Quero receber",
    follow_gate: "Me segue pra não perder as próximas 🙌 Ainda não segue? Segue e depois toca abaixo.",
    follow_button: "✅ Já sigo",
    email_ask: "Quer receber no e-mail também? Toca no seu e-mail ou responde com ele.",
    delivery: "Aqui está 🎉 {reward}",
    followup: "Viu o link? Tá aqui de novo 👉 {reward}",
  },
};

/** "Any post or reel" (must match ANY_MEDIA in src/types.ts). */
const ANY_MEDIA = "*";

/** Follow-up delays offered in the builder, in minutes — all inside Instagram's 24 h window. */
const FOLLOWUP_DELAYS = [15, 30, 60, 120, 240, 480, 720, 1380];
const delayLabel = (min) => (min < 60 ? `${min} min` : `${min / 60} h`);

function defaultDraft() {
  const c = DEFAULT_COPY[i18n.language()] || DEFAULT_COPY.en;
  return {
    campaign_id: "",
    name: c.name,
    media_id: "",
    media_thumb: "",
    folder: "",
    keywords: [c.keyword],
    match_any: false,
    exclude: [],
    public_reply: { enabled: false, texts: [...c.public_replies] },
    opening_enabled: true,
    check_follow: false,
    ask_email: false,
    reward: { type: "link", value: "" },
    copy: {
      opening: c.opening,
      opening_button: c.opening_button,
      follow_gate: c.follow_gate,
      follow_button: c.follow_button,
      email_ask: c.email_ask,
      delivery: c.delivery,
    },
    followup: { enabled: false, delay_minutes: 60, text: c.followup },
    recommendation: { enabled: false, delay_minutes: 60, message: "", button_label: "", link: "" },
    active: false,
  };
}

function draftFromCampaign(c) {
  return {
    campaign_id: c.campaign_id,
    name: c.name || c.campaign_id,
    media_id: c.media_id,
    media_thumb: (store.media.find((m) => m.id === c.media_id) || {}).thumbnail_url || "",
    folder: c.folder || "",
    keywords: c.keywords || [],
    match_any: !!c.match_any,
    exclude: c.exclude || [],
    public_reply: c.public_reply || { enabled: false, texts: ["Sent you a DM! 📩"] },
    opening_enabled: true,
    check_follow: !!c.check_follow,
    ask_email: !!c.ask_email,
    reward: c.reward || { type: "link", value: "" },
    copy: Object.assign(defaultDraft().copy, c.copy || {}),
    followup: Object.assign(defaultDraft().followup, c.followup || {}),
    recommendation: Object.assign(defaultDraft().recommendation, c.recommendation || {}),
    active: !!c.active,
  };
}

async function renderCreate() {
  const view = $("#view");
  // Skip Instagram check for demo/dev: allows viewing builder UI without connection
  // if (!(store.status || {}).connected) return renderConnectGate(view, "The automation builder and its media picker");
  if (!store.draft) {
    store.draft = defaultDraft();
    markSaved();
  }
  try {
    if (store.media.length === 0 && store.status.connected && !store.status.token_expired) {
      const r = await api("/api/media");
      store.media = r.media || [];
    }
    store.campaigns = (await api("/api/campaigns")).campaigns || [];
  } catch (e) {
    // media may fail if not connected; keep going with what we have
  }
  const d = store.draft;

  view.innerHTML = "";
  view.appendChild(el(connectBanner() || "<span></span>"));

  // top bar
  const top = el(`
    <div class="builder-topbar">
      <input class="name" id="cname" value="${esc(d.name)}" />
      <span class="status-pill ${d.active ? "live" : "stopped"}" id="statuspill">${d.active ? "live" : "stopped"}</span>
      <span class="folder-field">${ICON.folder}<input id="cfolder" list="folderlist" value="${esc(d.folder)}" placeholder="No folder"/></span>
      <datalist id="folderlist">${allFolders().map((f) => `<option value="${esc(f)}"></option>`).join("")}</datalist>
      <div class="spacer"></div>
      <select id="loadsel" style="width:auto"><option value="">New automation…</option>${store.campaigns
        .map((c) => `<option value="${esc(c.campaign_id)}" ${c.campaign_id === d.campaign_id ? "selected" : ""}>${esc(c.name || c.campaign_id)}</option>`)
        .join("")}</select>
      ${d.campaign_id ? `<button class="btn danger sm" id="deletebtn">${ICON.trash} Delete</button>` : ""}
      <button class="btn ghost sm" id="savebtn" title="Changes do not take effect until saved">Save</button>
      <button class="btn primary sm" id="golive">${d.active ? "Stop" : "Go live"}</button>
    </div>`);
  view.appendChild(top);

  view.appendChild(el(`<div id="issues"></div>`));
  const split = el(`<div class="builder"><div class="sections" id="sections"></div><div class="preview-col" id="previewcol"></div></div>`);
  view.appendChild(split);

  renderSections();
  renderPreview();
  refreshDirtyUI();

  $("#cname").oninput = (e) => {
    d.name = e.target.value;
  };
  $("#cfolder").oninput = (e) => {
    d.folder = e.target.value.trim();
  };
  $("#loadsel").onchange = (e) => {
    const id = e.target.value;
    if (!confirmDiscard("switch automations")) {
      // Put the dropdown back on the automation the user is actually editing.
      e.target.value = store.draft.campaign_id || "";
      return;
    }
    if (!id) store.draft = defaultDraft();
    else {
      const c = store.campaigns.find((x) => x.campaign_id === id);
      if (c) store.draft = draftFromCampaign(c);
    }
    markSaved();
    renderCreate();
  };
  $("#savebtn").onclick = () => saveCampaign(false);
  $("#golive").onclick = () => saveCampaign(!d.active ? "activate" : "deactivate");
  const deleteBtn = $("#deletebtn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm(i18n.t(`Delete "${d.name || d.campaign_id}"? This can't be undone.`))) return;
      try {
        await api("/api/campaigns/delete", { method: "POST", body: { campaign_id: d.campaign_id } });
        toast("Automation deleted");
        store.page = "automations";
        paintNav();
        route();
      } catch (e) {
        toast(e.message, true);
      }
    };
  }
}

function bindLive(root) {
  // re-render preview on any input change within the sections
  // Assigned, not added: the sections re-render in place and must not stack a listener per render.
  root.oninput = renderPreview;
  root.onchange = renderPreview;
}

const MEDIA_ROW_SIZE = 5;

/** Feature definitions for the 12 modular automation functions. Organized by flow stage. */
const FEATURES_BY_STAGE = {
  "Comment Detection": [
    { id: "commentMonitoring", name: "Monitor for keywords", desc: "Watch comments for your keywords" },
  ],
  "Public Reply": [
    { id: "publicReply", name: "Reply publicly", desc: "Post reply under the comment with @mention" },
  ],
  "Private Message Flow": [
    { id: "initialDM", name: "Send opening DM", desc: "Private reply with button (starts the funnel)" },
    { id: "initialButton", name: "Opening button", desc: "Button in the opening message" },
  ],
  "Follow Gate": [
    { id: "followGate", name: "Ask to follow", desc: "Request user to follow before continuing" },
    { id: "followButton", name: "Confirmation button", desc: "Show 'Already following' button" },
    { id: "followVerification", name: "Verify via API", desc: "Check if they really followed" },
    { id: "followRepeat", name: "Retry if not confirmed", desc: "Resend message if follow not verified" },
  ],
  "Reward Delivery": [
    { id: "autoDelivery", name: "Send the link", desc: "Deliver final link/reward automatically" },
    { id: "linkTracking", name: "Track clicks", desc: "Record when they open the link" },
    { id: "reminderMessage", name: "Reminder after 24h", desc: "Follow-up DM if link never opened" },
  ],
  "Email Collection": [
    { id: "emailCollection", name: "Ask for email", desc: "Request email via Instagram chip" },
  ],
};

/** Render organized feature toggles. */
function renderFeatureCards(campaign) {
  const features = campaign.features || {};
  let html = "";
  for (const [stage, items] of Object.entries(FEATURES_BY_STAGE)) {
    html += `<div class="feature-stage">
      <div class="fs-title">${stage}</div>
      <div class="fs-items">
        ${items.map((f) => `<div class="feature-toggle-row">
          <div><div class="ft-name">${f.name}</div><div class="ft-desc">${f.desc}</div></div>
          <label class="switch"><input type="checkbox" class="feature-toggle" data-feature="${f.id}" ${features[f.id] !== false ? "checked" : ""}/><span class="slider"></span></label>
        </div>`).join("")}
      </div>
    </div>`;
  }
  return html;
}

function renderSections() {
  const d = store.draft;
  const box = $("#sections");
  const anyPost = d.media_id === ANY_MEDIA;
  const shownMedia = store.mediaShowAll ? store.media : store.media.slice(0, MEDIA_ROW_SIZE);
  const hasMore = store.media.length > MEDIA_ROW_SIZE;
  const mediaGrid =
    store.media.length > 0
      ? shownMedia
          .map(
            (m) => `<div class="media-thumb ${m.id === d.media_id ? "selected" : ""}" data-mid="${esc(m.id)}" data-thumb="${esc(m.thumbnail_url || m.media_url || "")}">
              <img src="${esc(m.thumbnail_url || m.media_url || "")}" alt="" loading="lazy"/></div>`,
          )
          .join("")
      : `<div class="muted" style="padding:8px 0;grid-column:1/-1">Connect Instagram to load your posts. You can still edit the copy and preview below.</div>`;
  const seeMoreBtn = hasMore
    ? `<button class="btn ghost sm" id="mediaSeeMore" style="margin-top:10px">${
        store.mediaShowAll ? "Show less" : `See more (${store.media.length - MEDIA_ROW_SIZE})`
      }</button>`
    : "";
  const radio = (group, value, selected, title, sub) =>
    `<div class="radio-row ${selected ? "selected" : ""}" role="radio" tabindex="0" aria-checked="${selected}" data-group="${group}" data-value="${value}">
      <span class="radio-dot"></span><div><div class="rr-title">${title}</div>${sub ? `<div class="rr-sub">${sub}</div>` : ""}</div></div>`;
  const toggle = (id, on, title, sub) =>
    `<div class="toggle-row"><div><div class="tr-title">${title}</div><div class="tr-sub">${sub}</div></div>
      <label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}/><span class="slider"></span></label></div>`;
  const rewardBtn = (target) => `<button type="button" class="insert-var" data-target="${target}">+ insert link {reward}</button>`;
  const suggested = i18n.language() === "pt" ? ["Quero", "Link", "Eu quero", "Preço", "Info"] : ["Link", "Price", "Shop", "Info"];
  const suggestions = suggested.filter(
    (k) => !d.keywords.some((x) => x.toLowerCase() === k.toLowerCase()),
  );
  const tracking = (store.status || {}).link_tracking;

  box.innerHTML = `
    <div class="card" id="sec-media">
      <h3><span class="section-num">1</span>When someone comments on</h3>
      <div class="hint">Pick the post or reel this automation watches.</div>
      ${radio("media", "one", !anyPost, "A specific post or reel", "Only comments on the selected media trigger the funnel.")}
      ${radio("media", "any", anyPost, "Any post or reel", "Every post on the account, including the next ones you publish.")}
      <div id="media_one" style="${anyPost ? "display:none" : ""}">
        <div class="media-grid" id="mediagrid">${mediaGrid}</div>
        ${seeMoreBtn}
      </div>
      <div class="note" id="media_any" style="${anyPost ? "" : "display:none"}">A post with its own automation keeps using that one; this covers all the others. Without webhooks, your 5 most recent posts are checked.</div>
    </div>

    <div class="card" id="sec-words">
      <h3><span class="section-num">2</span>And this comment has</h3>
      <div class="hint">Whole-word match, case-insensitive — “ai” fires on “I like this ai”, not “fair”.</div>
      ${radio("words", "some", !d.match_any, "A specific word or words", "")}
      ${radio("words", "any", d.match_any, "Any word", "Every comment starts the funnel (except the excluded words below).")}
      <div id="kw_wrap" style="${d.match_any ? "display:none" : ""}">
        <label class="field"><span class="label">Keywords</span><div id="kw_box"></div>
          <span class="hint">Press Enter after each word.</span></label>
        <div class="chips" id="kwchips">${suggestions.map((k) => `<span class="chip" data-kw="${k}">+ ${k}</span>`).join("")}</div>
      </div>
      <label class="field" style="margin-top:14px"><span class="label">Exclude words (optional)</span><div id="ex_box"></div></label>

      <div style="margin-top:8px">
        ${toggle("pr_enabled", d.public_reply.enabled, "Reply to their comment", "Post a public reply under the comment (rotates to look human).")}
        <div id="pr_texts_wrap" style="${d.public_reply.enabled ? "" : "display:none"}">
          <label class="field"><span class="label">Public replies (one per line, rotated)</span>
            <textarea id="pr_texts">${esc((d.public_reply.texts || []).join("\n"))}</textarea></label>
        </div>
        <div class="toggle-row disabled"><div><div class="tr-title">Like their comment</div><div class="tr-sub">Not possible — Instagram's API has no way to like a comment.</div></div>
          <label class="switch"><input type="checkbox" disabled/><span class="slider"></span></label></div>
      </div>
    </div>

    <div class="card" id="sec-dm">
      <h3><span class="section-num">3</span>They will get</h3>
      ${toggle("opening_enabled", d.opening_enabled, "An opening DM", "Sent as a private reply with a button so it survives the Requests folder. Required to start the funnel.")}
      <div id="opening_wrap" style="${d.opening_enabled ? "" : "display:none"}">
        <label class="field"><span class="label">Opening message</span><textarea id="c_opening" data-max="1000">${esc(d.copy.opening)}</textarea></label>
        <label class="field"><span class="label">Button label</span><input type="text" id="c_opening_button" maxlength="20" data-max="20" value="${esc(d.copy.opening_button)}"/></label>
      </div>
      ${toggle("check_follow", d.check_follow, "Ask them to follow you first", "Self-attestation — the tap advances (the API can’t verify a specific follow).")}
      <div id="follow_wrap" style="${d.check_follow ? "" : "display:none"}">
        <label class="field"><span class="label">Follow message</span><textarea id="c_follow_gate" data-max="1000">${esc(d.copy.follow_gate)}</textarea></label>
        <label class="field"><span class="label">Follow button label</span><input type="text" id="c_follow_button" maxlength="20" data-max="20" value="${esc(d.copy.follow_button)}"/></label>
        <label class="field"><span class="label">Texto do botão visitar perfil</span><input type="text" id="c_follow_profile_button" maxlength="20" data-max="20" value="${esc(d.copy.follow_profile_button || "Visitar perfil")}"/></label>
        <label class="field"><span class="label">Profile link</span><input type="text" id="c_follow_profile_url" maxlength="500" data-max="500" value="${esc(d.copy.follow_profile_url || "")}"/></label>
      </div>
      ${toggle("ask_email", d.ask_email, "Ask for their email", "Uses Instagram’s email chip, with a typed-reply fallback.")}
      <div id="email_wrap" style="${d.ask_email ? "" : "display:none"}">
        <label class="field"><span class="label">Email ask message</span><textarea id="c_email_ask" data-max="1000">${esc(d.copy.email_ask)}</textarea></label>
      </div>
    </div>

    <div class="card" id="sec-reward">
      <h3><span class="section-num">4</span>And then, they will get</h3>
      <div class="hint">The reward, delivered by DM. Use <code>{reward}</code> to place your link.</div>
      <label class="field"><span class="label">Button name</span><input type="text" id="c_delivery_button" maxlength="30" data-max="30" value="${esc(d.copy.delivery_button || "Get material")}"/></label>
      <label class="field"><span class="label">Material delivery link</span><input type="url" id="c_delivery_url" maxlength="500" data-max="500" value="${esc(d.copy.delivery_url || "")}"/></label>
      ${toggle("fu_enabled", d.followup.enabled, "Follow-up DM if they don’t click", "Goes only to people who tapped the button but never opened the link — Instagram allows it within 24 hours.")}
      <div id="fu_wrap" style="${d.followup.enabled ? "" : "display:none"}">
        ${tracking === false ? `<div class="banner">Follow-ups start working once chatmany is online with a public https address — that is how it knows who opened the link.</div>` : ""}
        <label class="field"><span class="label">Send it after</span>
          <select id="fu_delay">${FOLLOWUP_DELAYS.map((m) => `<option value="${m}" ${m === d.followup.delay_minutes ? "selected" : ""}>${delayLabel(m)}</option>`).join("")}</select></label>
        <label class="field"><span class="label">Reminder message</span><textarea id="c_followup_message" data-max="1000">${esc(d.copy.followup_message || "")}</textarea></label>
        <label class="field"><span class="label">Reminder button name</span><input type="text" id="c_followup_button" maxlength="30" data-max="30" value="${esc(d.copy.followup_button || "")}"/></label>
      </div>
      ${toggle("rec_enabled", d.recommendation.enabled, "Recommendation DM (suggest another product)", "Goes to people who completed the funnel. Sent after a delay to suggest something else.")}
      <div id="rec_wrap" style="${d.recommendation.enabled ? "" : "display:none"}">
        <label class="field"><span class="label">Send it after</span>
          <select id="rec_delay">${FOLLOWUP_DELAYS.map((m) => `<option value="${m}" ${m === d.recommendation.delay_minutes ? "selected" : ""}>${delayLabel(m)}</option>`).join("")}</select></label>
        <label class="field"><span class="label">Recommendation message</span><textarea id="c_recommendation_message" data-max="1000">${esc(d.recommendation.message || "")}</textarea></label>
        <label class="field"><span class="label">Recommendation button name</span><input type="text" id="c_recommendation_button" maxlength="30" data-max="30" value="${esc(d.recommendation.button_label || "")}"/></label>
        <label class="field"><span class="label">Recommendation link (optional)</span><input type="url" id="c_recommendation_link" maxlength="500" data-max="500" value="${esc(d.recommendation.link || "")}"/></label>
      </div>
    </div>

    <div class="card" id="sec-features">
      <h3><span class="section-num">5</span>Automation features</h3>
      <div class="hint">Turn each function on or off independently. All are enabled by default.</div>
      <div class="features-grid" id="features-grid">
        ${renderFeatureCards(d)}
      </div>
    </div>`;

  wireSections();
  bindLive(box);
}

/**
 * Which phone screen and which bubble a builder field shows up in, so the preview follows what is
 * being edited: focusing a field switches the phone to its screen and highlights its bubble.
 */
const FIELD_PREVIEW = {
  kw_input: ["comments", "comment"],
  ex_input: ["comments", "comment"],
  pr_texts: ["comments", "reply"],
  c_opening: ["dm", "opening"],
  c_opening_button: ["dm", "opening_button"],
  c_follow_gate: ["dm", "follow_gate"],
  c_follow_button: ["dm", "follow_button"],
  c_follow_profile_button: ["dm", "follow_gate"],
  c_email_ask: ["dm", "email_ask"],
  c_delivery: ["dm", "delivery"],
  c_delivery_button: ["dm", "delivery"],
  c_delivery_url: ["dm", "delivery"],
  c_followup_message: ["dm", "followup"],
  c_followup_button: ["dm", "followup"],
  c_recommendation_message: ["dm", "recommendation"],
  c_recommendation_button: ["dm", "recommendation"],
  c_recommendation_link: ["dm", "recommendation"],
  rec_enabled: ["dm", "recommendation"],
  rec_delay: ["dm", "recommendation"],
  reward_value: ["dm", "delivery"],
  fu_delay: ["dm", "followup"],
  fu_text: ["dm", "followup"],
};

function wireSections() {
  const d = store.draft;
  const ui = window.chatmanyUi;

  // radio groups (clickable and keyboard-accessible)
  const choose = (group, value) => {
    if (group === "media") {
      if (value === "any") {
        if (d.media_id !== ANY_MEDIA) store.lastMediaId = d.media_id;
        d.media_id = ANY_MEDIA;
        d.media_thumb = "";
      } else if (d.media_id === ANY_MEDIA) {
        d.media_id = store.lastMediaId || "";
        d.media_thumb = (store.media.find((m) => m.id === d.media_id) || {}).thumbnail_url || "";
      }
      store.previewTab = "post";
    } else {
      d.match_any = value === "any";
      store.previewTab = "comments";
    }
    renderSections();
    renderPreview();
  };
  $("#sections").querySelectorAll(".radio-row[data-group]").forEach((r) => {
    r.onclick = () => choose(r.dataset.group, r.dataset.value);
    r.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(r.dataset.group, r.dataset.value);
      }
    };
  });

  // media
  $("#mediagrid")?.querySelectorAll(".media-thumb").forEach((t) => {
    t.onclick = () => {
      d.media_id = t.dataset.mid;
      d.media_thumb = t.dataset.thumb;
      $("#mediagrid").querySelectorAll(".media-thumb").forEach((x) => x.classList.toggle("selected", x === t));
      store.previewTab = "post";
      renderPreview();
    };
  });
  const seeMore = $("#mediaSeeMore");
  if (seeMore) {
    seeMore.onclick = () => {
      store.mediaShowAll = !store.mediaShowAll;
      renderSections();
    };
  }

  // keyword and exclude chips
  const kw = ui.chipInput($("#kw_box"), {
    values: d.keywords,
    placeholder: "Link, Guide",
    inputId: "kw_input",
    onChange: (list) => {
      d.keywords = list;
      $("#kwchips")?.querySelectorAll(".chip").forEach((c) => {
        c.style.display = list.some((x) => x.toLowerCase() === c.dataset.kw.toLowerCase()) ? "none" : "";
      });
      previewFor("kw_input");
      refreshDirtyUI();
    },
  });
  $("#kwchips")?.querySelectorAll(".chip").forEach((c) => (c.onclick = () => kw.add(c.dataset.kw)));
  ui.chipInput($("#ex_box"), {
    values: d.exclude || [],
    placeholder: "scam, fake",
    inputId: "ex_input",
    onChange: (list) => {
      d.exclude = list;
      refreshDirtyUI();
    },
  });

  const bindText = (id, fn) => {
    const node = $("#" + id);
    if (node) node.oninput = (e) => fn(e.target.value);
  };
  bindText("pr_texts", (v) => (d.public_reply.texts = v.split("\n").map((x) => x.trim()).filter(Boolean)));
  bindText("c_opening", (v) => (d.copy.opening = v));
  bindText("c_opening_button", (v) => (d.copy.opening_button = v));
  bindText("c_follow_gate", (v) => (d.copy.follow_gate = v));
  bindText("c_follow_button", (v) => (d.copy.follow_button = v));
  bindText("c_follow_profile_button", (v) => (d.copy.follow_profile_button = v || undefined));
  bindText("c_follow_profile_url", (v) => (d.copy.follow_profile_url = v || undefined));
  bindText("c_email_ask", (v) => (d.copy.email_ask = v));
  bindText("c_delivery", (v) => (d.copy.delivery = v));
  bindText("c_delivery_button", (v) => (d.copy.delivery_button = v || undefined));
  bindText("c_delivery_url", (v) => (d.copy.delivery_url = v || undefined));
  bindText("c_followup_message", (v) => (d.copy.followup_message = v || undefined));
  bindText("c_followup_button", (v) => (d.copy.followup_button = v || undefined));
  bindText("reward_value", (v) => (d.reward.value = v.trim()));
  bindText("fu_text", (v) => (d.followup.text = v));
  const delay = $("#fu_delay");
  if (delay) delay.onchange = (e) => (d.followup.delay_minutes = Number(e.target.value));
  bindText("c_recommendation_message", (v) => (d.recommendation.message = v));
  bindText("c_recommendation_button", (v) => (d.recommendation.button_label = v));
  bindText("c_recommendation_link", (v) => (d.recommendation.link = v || undefined));
  const recDelay = $("#rec_delay");
  if (recDelay) recDelay.onchange = (e) => (d.recommendation.delay_minutes = Number(e.target.value));

  // Switching a step on or off shows it on the phone right away (its screen, its message).
  const bindToggle = (id, fn, wrapId) => {
    const node = $("#" + id);
    if (!node) return;
    node.onchange = (e) => {
      fn(e.target.checked);
      if (wrapId) $("#" + wrapId).style.display = e.target.checked ? "" : "none";
      previewFor(id);
    };
  };
  bindToggle("pr_enabled", (v) => (d.public_reply.enabled = v), "pr_texts_wrap");
  bindToggle("opening_enabled", (v) => (d.opening_enabled = v), "opening_wrap");
  bindToggle("check_follow", (v) => (d.check_follow = v), "follow_wrap");
  bindToggle("ask_email", (v) => (d.ask_email = v), "email_wrap");
  bindToggle("fu_enabled", (v) => (d.followup.enabled = v), "fu_wrap");
  bindToggle("rec_enabled", (v) => (d.recommendation.enabled = v), "rec_wrap");

  // Feature toggles (12 independent functions)
  $("#features-grid")?.querySelectorAll(".feature-toggle").forEach((toggle) => {
    toggle.onchange = (e) => {
      if (!d.features) d.features = {};
      d.features[e.target.dataset.feature] = e.target.checked;
      refreshDirtyUI();
      previewFor("sec-features");
    };
  });

  // "+ insert link {reward}"
  $("#sections").querySelectorAll(".insert-var").forEach((b) => {
    b.onclick = () => ui.insertAtCursor($("#" + b.dataset.target), "{reward}");
  });

  ui.counters($("#sections"));

  // The phone follows the field being edited. Browsers have no `onfocusin` property, so this is a
  // listener — attached once, since the sections container survives every re-render.
  const sections = $("#sections");
  if (!sections.dataset.followsFocus) {
    sections.dataset.followsFocus = "1";
    sections.addEventListener("focusin", (e) => previewFor(e.target.id));
    // Clicking anywhere in a step (not just a field) shows that step's screen.
    sections.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input, textarea, select, label.switch, .radio-row, .media-thumb, .chip, .insert-var")) return;
      const card = e.target.closest(".card[id]");
      if (card && SECTION_PREVIEW[card.id]) previewFor(card.id);
    });
  }
}

/** Default phone screen for each builder step, when the click is not on a specific field. */
const SECTION_PREVIEW = {
  "sec-media": ["post", null],
  "sec-words": ["comments", "comment"],
  "sec-dm": ["dm", "opening"],
  "sec-reward": ["dm", "delivery"],
  "sec-features": ["dm", "delivery"],
};
/** Toggles show the message they switch on or off. */
const TOGGLE_PREVIEW = {
  pr_enabled: ["comments", "reply"],
  opening_enabled: ["dm", "opening"],
  check_follow: ["dm", "follow_gate"],
  ask_email: ["dm", "email_ask"],
  fu_enabled: ["dm", "followup"],
};

/** Show the phone screen (and highlight the message) that a field, toggle or step belongs to. */
function previewFor(id) {
  const link = FIELD_PREVIEW[id] || TOGGLE_PREVIEW[id] || SECTION_PREVIEW[id];
  if (link) {
    store.previewTab = link[0];
    store.previewFocus = link[1];
  }
  renderPreview();
}

/* ---------------- live phone preview ----------------
   An iPhone running Instagram in dark mode, as the connected account (@username, photo, real post,
   caption and counts), showing the post, the comment thread or the DM funnel — and following the
   builder step by step (see FIELD_PREVIEW / previewFor). Instagram's own labels go through i18n.t();
   the messages followers will receive are shown exactly as written (the .iphone subtree is skipped
   by the automatic translation). */
const PHONE_ICON = {
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  dots: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 3 10v10a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1V10z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>`,
  reels: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8h18M8 3l3 5M13 3l3 5M10 12v5l4-2.5z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.5 5.5c2 0 3.2 1.2 3.5 2 .3-.8 1.5-2 3.5-2 3.5 0 5 3.5 3 7C19 16.65 12 21 12 21z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21 12 16l-7 5V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`,
  sticker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8l7-7V6a3 3 0 0 0-3-3z"/><path d="M14 21v-4a3 3 0 0 1 3-3h4"/></svg>`,
  call: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>`,
  wifi: `<svg viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 0C4.9 0 2.5 1 .6 2.7a.6.6 0 0 0 0 .9l1 1a.6.6 0 0 0 .8 0A8 8 0 0 1 7.5 2.6a8 8 0 0 1 5.1 1.9.6.6 0 0 0 .8 0l1-1a.6.6 0 0 0 0-.9A10.5 10.5 0 0 0 7.5 0Zm0 4a6 6 0 0 0-4 1.5.6.6 0 0 0 0 .9l1 1a.6.6 0 0 0 .8 0 3.4 3.4 0 0 1 4.4 0 .6.6 0 0 0 .8 0l1-1a.6.6 0 0 0 0-.9A6 6 0 0 0 7.5 4Zm0 4a2.2 2.2 0 0 0-1.5.6.6.6 0 0 0 0 .9l1 1a.6.6 0 0 0 .8 0l1-1a.6.6 0 0 0 0-.9A2.2 2.2 0 0 0 7.5 8Z"/></svg>`,
  signal: `<svg viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>`,
};

/** The connected account's avatar: the photo when there is one, its initial otherwise. */
function phoneAvatar(cls) {
  const s = store.status || {};
  const initial = esc(((s.username || "?")[0] || "?").toUpperCase());
  const photo = s.profile_picture_url ? `<img src="${esc(s.profile_picture_url)}" alt="" onerror="this.remove()"/>` : "";
  return `<span class="ig-av ${cls}"><span>${initial}</span>${photo}</span>`;
}

function renderPreview() {
  refreshDirtyUI();
  const d = store.draft;
  const s = store.status || {};
  const col = $("#previewcol");
  if (!col) return;
  const t = i18n.t;
  const uname = s.username || "yourbrand";
  const media = store.media.find((m) => m.id === d.media_id) || store.media[0] || {};
  const thumb = d.media_thumb || media.thumbnail_url || media.media_url || "";
  const kw = d.keywords[0] || "Link";
  // Placeholders for what isn't chosen yet (no link, no post) are preview-only, so they follow
  // the UI language; everything the owner wrote is shown as is.
  const reward = d.reward.value || t("your link");
  const deliveryText = (d.copy.delivery || "").replace(/\{reward\}/g, reward);
  const caption = media.caption || t(`New drop is live 🔥 comment "${kw}" and I'll send it.`);
  const captionLong = caption.length > 70;
  const captionShown = store.captionExpanded || !captionLong ? caption : caption.slice(0, 70) + "…";
  const posted = media.timestamp
    ? new Date(media.timestamp).toLocaleDateString(i18n.language() === "pt" ? "pt-BR" : "en-US", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const comments = (media.comments_count ?? 0) + (d.public_reply.enabled ? 1 : 0);
  const reply = d.public_reply.enabled && (d.public_reply.texts[0] || "");

  const postHeader = `
    <div class="ig-appbar">${PHONE_ICON.back}
      <div class="title stacked"><span class="over">${esc(uname.toUpperCase())}</span><span>${t("Publication")}</span></div>
      <span class="ig-icon-spacer"></span></div>`;
  const postBody = `
    <div class="ig-posthead">${phoneAvatar("sm")}<span class="u">${esc(uname)}</span>${PHONE_ICON.dots}</div>
    ${thumb ? `<img class="ig-media" src="${esc(thumb)}" alt=""/>` : `<div class="ig-media empty">${PHONE_ICON.camera}</div>`}`;

  let screen = "";
  if (store.previewTab === "post") {
    screen = `
      ${postHeader}
      <div class="ig-content" data-k="post">
        ${postBody}
        <div class="ig-actions">
          <span class="act">${PHONE_ICON.heart}<b>${(media.like_count ?? 0).toLocaleString()}</b></span>
          <span class="act">${PHONE_ICON.comment}<b>${comments}</b></span>
          <span class="act">${PHONE_ICON.send}</span><span class="grow"></span>${PHONE_ICON.bookmark}</div>
        <div class="ig-caption"><span class="u">${esc(uname)}</span>${esc(captionShown)}${
          captionLong ? `<span class="ig-caption-toggle" id="captoggle"> ${t(store.captionExpanded ? "less" : "more")}</span>` : ""
        }</div>
        <div class="ig-muted">${t("View all comments")}</div>
        ${posted ? `<div class="ig-date">${esc(posted)}</div>` : ""}
      </div>
      <div class="ig-bottomnav">${PHONE_ICON.home}${PHONE_ICON.search}${PHONE_ICON.plus}${PHONE_ICON.reels}${phoneAvatar("xs")}</div>`;
  } else if (store.previewTab === "comments") {
    const commentRow = (who, avatar, text, key) => `
      <div class="cmt" data-k="${key}">${avatar}
        <div class="body"><div><span class="u">${who}</span><span class="when">${t("Now")}</span></div>
          <div class="text">${text}</div><div class="meta">${t("Reply")}</div></div>
        <span class="like">${PHONE_ICON.heart}</span></div>`;
    screen = `
      ${postHeader}
      <div class="ig-behind">${postBody}</div>
      <div class="ig-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-head"><span>${t("Comments")}</span>${PHONE_ICON.send}</div>
        <div class="ig-content">
          ${commentRow(t("User"), `<span class="ig-av sm guest"></span>`, esc(d.match_any ? t("Love this! 😍") : kw), "comment")}
          ${reply ? `<div class="cmt-reply">${commentRow(esc(uname), phoneAvatar("sm"), esc(reply), "reply")}</div>` : ""}
        </div>
        <div class="ig-emojis"><span>❤️</span><span>🙌</span><span>🔥</span><span>👏</span><span>😢</span><span>😍</span><span>😮</span><span>😂</span></div>
        <div class="ig-inputrow">${phoneAvatar("sm")}<span class="fake-input">${esc(t(`Add a comment for ${uname}...`))}</span></div>
      </div>`;
  } else {
    // DM funnel as the follower sees it: our messages on the left in cards (a button belongs to the
    // message it came with), their taps echoed on the right, our avatar under each run of ours.
    const ours = (inner, key) => `<div class="dm-row" data-k="${key}"><div class="dm-card">${inner}</div></div>`;
    const button = (label, key) => `<div class="dm-card-btn" data-k="${key}">${esc(label)}</div>`;
    const theirs = (text) => `<div class="bubble out">${esc(text)}</div>`;
    const blocks = [];
    if (d.opening_enabled) {
      const label = d.copy.opening_button || "Continue";
      blocks.push(ours(`<div class="dm-text">${esc(d.copy.opening)}</div>${button(label, "opening_button")}`, "opening"));
      blocks.push(theirs(label));
      blocks.push(`<div class="dm-note">${t("tap moves the chat out of Requests →")}</div>`);
    } else {
      blocks.push(`<div class="dm-note">${t("Opening DM is off — the funnel won’t start.")}</div>`);
    }
    if (d.check_follow) {
      const followLabel = d.copy.follow_button || "✅ I followed";
      const profileLabel = d.copy.follow_profile_button || "👤 Visitar perfil";
      blocks.push(ours(`<div class="dm-text">${esc(d.copy.follow_gate)}</div>${button(followLabel, "follow_button")}<div style="margin-top:8px">${button(profileLabel, "follow_profile")}</div>`, "follow_gate"));
      blocks.push(theirs(followLabel));
    }
    if (d.ask_email) {
      blocks.push(ours(`<div class="dm-text">${esc(d.copy.email_ask)}</div>`, "email_ask"));
      blocks.push(`<div class="qr"><span class="pill">${esc(t("your@email.com"))}</span></div>`);
      blocks.push(theirs(t("your@email.com")));
    }
    const deliveryMsg = "Aqui está 🎁 seu material";
    const deliveryBtnLabel = d.copy.delivery_button || "Get material";
    blocks.push(ours(`<div class="dm-text">${esc(deliveryMsg)}</div>${button(deliveryBtnLabel, "delivery_button")}`, "delivery"));
    if (d.followup.enabled) {
      const followupMsg = d.copy.followup_message || "Still interested? Here's your link again 👇";
      const followupBtnLabel = d.copy.followup_button || "Get material";
      blocks.push(`<div class="dm-note">${esc(t(`If they don't open the link, ${delayLabel(d.followup.delay_minutes)} later:`))}</div>`);
      blocks.push(ours(`<div class="dm-text">${esc(followupMsg)}</div>${button(followupBtnLabel, "followup_button")}`, "followup"));
    }
    if (d.recommendation.enabled) {
      const recMsg = d.recommendation.message || "Check this out!";
      const recBtnLabel = d.recommendation.button_label || "See more";
      blocks.push(`<div class="dm-note">${esc(t(`After they complete the funnel, ${delayLabel(d.recommendation.delay_minutes)} later:`))}</div>`);
      blocks.push(ours(`<div class="dm-text">${esc(recMsg)}</div>${button(recBtnLabel, "recommendation_button")}`, "recommendation"));
    }
    const dmHeader = `
      <div class="ig-appbar">${PHONE_ICON.back}<span class="chat-who" title="${t("Visit profile")}" style="cursor:pointer">${phoneAvatar("sm")}<span class="name">${esc(uname)}</span></span><span style="color:#a8a8a8;font-size:11px;margin-left:auto;padding-right:8px;cursor:pointer" title="${t("Visit profile")}">👤</span>${PHONE_ICON.call}${PHONE_ICON.video}</div>`;
    screen = `
      ${dmHeader}
      <div class="ig-content"><div class="dm">${groupWithAvatar(blocks.join(""))}</div></div>
      <div class="ig-composer"><span class="cam">${PHONE_ICON.camera}</span><span class="ph">${t("Message...")}</span>${PHONE_ICON.image}${PHONE_ICON.sticker}${PHONE_ICON.plus}</div>`;
  }

  const getTime = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false });
  const tabBtn = (id, label) => `<button class="${store.previewTab === id ? "active" : ""}" data-tab="${id}">${label}</button>`;
  col.innerHTML = `
    <div class="iphone"><div class="iphone-screen">
      <div class="iphone-island"></div>
      <div class="ig-status"><span id="phone-time">${getTime()}</span><span class="icons">${PHONE_ICON.signal}${PHONE_ICON.wifi}<span class="battery"></span></span></div>
      ${screen}
      <div class="iphone-home"></div>
    </div></div>
    <div class="preview-tabs">${tabBtn("post", "Post")}${tabBtn("comments", "Comments")}${tabBtn("dm", "DM")}</div>`;

  // Update time every second without re-rendering the whole preview
  const timeEl = col.querySelector("#phone-time");
  if (timeEl && !window._phoneTimeInterval) {
    window._phoneTimeInterval = setInterval(() => {
      const t = col.querySelector("#phone-time");
      if (t) t.textContent = getTime();
    }, 1000);
  }

  col.querySelectorAll(".preview-tabs button").forEach((b) => (b.onclick = () => {
    store.previewTab = b.dataset.tab;
    store.previewFocus = null;
    store.captionExpanded = false;
    renderPreview();
  }));
  const capToggle = $("#captoggle");
  if (capToggle) {
    capToggle.onclick = () => {
      store.captionExpanded = !store.captionExpanded;
      renderPreview();
    };
  }
  // Highlight what is being edited (see FIELD_PREVIEW) and keep it in view inside the phone.
  const focused = store.previewFocus && col.querySelector(`.ig-content [data-k="${store.previewFocus}"]`);
  if (focused) {
    focused.classList.add("hl");
    const content = focused.closest(".ig-content");
    if (content) content.scrollTop = Math.max(0, focused.offsetTop - content.clientHeight / 2);
  }
}

/** Put the account's avatar under the last card of each run of our messages, like Instagram. */
function groupWithAvatar(html) {
  const box = document.createElement("div");
  box.innerHTML = html;
  const rows = [...box.children];
  rows.forEach((row, i) => {
    if (!row.classList.contains("dm-row")) return;
    const next = rows[i + 1];
    if (!next || !next.classList.contains("dm-row")) row.insertAdjacentHTML("afterbegin", phoneAvatar("xs dm-av"));
    else row.insertAdjacentHTML("afterbegin", `<span class="ig-av xs dm-av ghost"></span>`);
  });
  return box.innerHTML;
}

/* ---------------- unsaved-changes tracking ----------------
   Editing a live automation does nothing until it's saved. Before this, the only
   hint was a quiet "Save" button next to a loud "Go live" — and since Go live
   also saves, stopping and restarting appeared to "fix" edits that were simply
   never saved. Now the button announces pending changes and every exit is guarded. */

function draftSnapshot() {
  if (!store.draft) return null;
  const d = store.draft;
  return JSON.stringify({ ...d, __active: d.active });
}

/** Call after loading a campaign into the draft, or after a successful save. */
function markSaved() {
  store.savedSnapshot = draftSnapshot();
  refreshDirtyUI();
}

function isDirty() {
  return !!store.draft && store.savedSnapshot !== null && store.savedSnapshot !== draftSnapshot();
}

/** Repaint the Save button so pending changes are impossible to miss. */
function refreshDirtyUI() {
  const btn = document.querySelector("#savebtn");
  if (!btn) return;
  const dirty = isDirty();
  btn.className = `btn ${dirty ? "primary" : "ghost"} sm`;
  btn.textContent = dirty ? "Save changes •" : "Save";
}

/**
 * Guard an action that would discard unsaved edits. Returns true if it's safe
 * to proceed (nothing pending, or the user chose to discard).
 */
function confirmDiscard(what = "leave") {
  if (!isDirty()) return true;
  return confirm(
    i18n.t(
      `You have unsaved changes to "${store.draft.name || "this automation"}".\n\n` +
        `They will NOT take effect until you save. If you ${what} now, the changes are lost.\n\n` +
        `OK to discard them, or Cancel to go back and save.`,
    ),
  );
}

// Typed edits don't re-render, so refresh the button straight from the DOM event.
document.addEventListener("input", () => {
  if (store.page === "create") refreshDirtyUI();
});

// Closing the tab / hitting back with pending edits.
window.addEventListener("beforeunload", (e) => {
  if (!isDirty()) return;
  e.preventDefault();
  e.returnValue = "";
});

/* ---------------- save ---------------- */
function buildCampaignFromDraft() {
  const d = store.draft;
  return {
    campaign_id: d.campaign_id || `${slug(d.name)}-${Math.random().toString(36).slice(2, 8)}`,
    name: d.name,
    media_id: d.media_id,
    folder: d.folder || undefined,
    keywords: d.match_any ? [] : d.keywords,
    match_any: d.match_any,
    exclude: d.exclude,
    public_reply: d.public_reply.enabled ? { enabled: true, texts: d.public_reply.texts } : { enabled: false, texts: d.public_reply.texts },
    check_follow: d.check_follow,
    ask_email: d.ask_email,
    reward: d.reward,
    copy: d.copy,
    followup: d.followup,
  };
}

/**
 * Everything that keeps the automation from going live, each with the field to jump to. Shown as a
 * clickable checklist (see showIssues) rather than one toast at a time.
 */
function draftIssues(d) {
  const issues = [];
  if (!d.media_id) issues.push({ msg: "Select a post or reel in section 1.", target: "sec-media" });
  if (!d.match_any && !d.keywords.length) issues.push({ msg: "Add at least one keyword in section 2.", target: "kw_input" });
  if (!d.opening_enabled) issues.push({ msg: "Turn on the opening DM — it’s required to start the funnel.", target: "opening_enabled" });
  if (!d.reward.value) issues.push({ msg: "Add your link or reward in section 4.", target: "reward_value" });
  if (d.followup.enabled && !d.followup.text.trim()) issues.push({ msg: "Write the follow-up message in section 4.", target: "fu_text" });
  return issues;
}

/** The go-live checklist above the sections; each item scrolls to and focuses its field. */
function showIssues(issues) {
  const box = $("#issues");
  if (!box) return;
  if (!issues.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="issues"><div class="issues-title">${ICON.send}<span>Before going live:</span></div>${issues
    .map((it) => `<button type="button" class="issue" data-target="${it.target}">${esc(it.msg)}<span>→</span></button>`)
    .join("")}</div>`;
  box.querySelectorAll(".issue").forEach((b) => {
    b.onclick = () => {
      const target = document.getElementById(b.dataset.target);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 1400);
      if (target.matches("input, textarea, select")) target.focus({ preventScroll: true });
    };
  });
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveCampaign(activation) {
  const d = store.draft;
  const issues = draftIssues(d);
  showIssues(activation === "deactivate" ? [] : issues);
  if (issues.length && activation !== "deactivate") return toast(issues[0].msg, true);
  const campaign = buildCampaignFromDraft();
  // persist name inside config via copy? name is stored on the campaign object (config_json).
  campaign.name = d.name;
  const active = activation === "activate" ? true : activation === "deactivate" ? false : d.active;
  try {
    await api("/api/campaigns", { method: "POST", body: { campaign, active } });
    if (activation) await api("/api/campaigns/status", { method: "POST", body: { campaign_id: campaign.campaign_id, active } });
    d.campaign_id = campaign.campaign_id;
    d.active = active;
    if (activation) {
      markSaved();
      // Going live or stopping is the "I'm done editing" signal — land back on the automations list.
      toast(activation === "activate" ? "Automation is live" : "Automation stopped");
      store.page = "automations";
      paintNav();
      route();
      return;
    }
    markSaved();
    $("#statuspill").className = `status-pill ${active ? "live" : "stopped"}`;
    $("#statuspill").textContent = active ? "live" : "stopped";
    $("#golive").textContent = active ? "Stop" : "Go live";
    toast("Saved");
  } catch (e) {
    toast(e.message, true);
  }
}

/* ================= DASHBOARD ================= */
async function renderDashboard() {
  const view = $("#view");
  try {
    store.campaigns = (await api("/api/campaigns")).campaigns || [];
  } catch {}
  const qs = new URLSearchParams();
  if (store.dashCampaign) qs.set("campaign_id", store.dashCampaign);
  qs.set("days", String(store.dashDays));
  let data;
  try {
    data = await api("/api/dashboard?" + qs.toString());
  } catch (e) {
    view.innerHTML = connectBanner() + `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  const c = data.cards;
  const card = (val, label, sub) => `<div class="metric"><div class="m-val">${val}</div><div class="m-label">${label}</div>${sub ? `<div class="m-sub">${sub}</div>` : ""}</div>`;

  view.innerHTML = `
    ${connectBanner()}
    <div class="page-head"><div><div class="page-title">Dashboard</div><div class="page-sub">Performance from logged funnel events.</div></div>
      <div class="toolbar">
        <div class="select-inline"><span class="muted">Campaign</span>
          <select id="dashcamp"><option value="">All campaigns</option>${store.campaigns.map((x) => `<option value="${esc(x.campaign_id)}" ${x.campaign_id === store.dashCampaign ? "selected" : ""}>${esc(x.name || x.campaign_id)}</option>`).join("")}</select></div>
        <div class="select-inline"><span class="muted">Range</span>
          <select id="dashdays">${[7, 30, 90].map((n) => `<option value="${n}" ${n === store.dashDays ? "selected" : ""}>Last ${n} days</option>`).join("")}</select></div>
      </div>
    </div>
    <div class="metrics">
      ${card(c.comments, "Comments")}
      ${card(c.sends, "Opening DMs")}
      ${card(c.clicks, "Clicks", c.ctr + "% of DMs")}
      ${card(c.follows, "Follows")}
      ${card(c.emails, "Emails")}
      ${card(c.delivered, "Delivered")}
      ${card(c.link_clicks ?? 0, "Link opens")}
      ${card(c.followups ?? 0, "Follow-ups sent")}
    </div>
    <div class="card">
      <h3>Conversion funnel</h3>
      <div class="hint">Percentages are relative to comments with the keyword.</div>
      <div id="funnel"></div>
    </div>`;

  const funnel = $("#funnel");
  data.funnel.forEach((f) => {
    funnel.appendChild(
      el(`<div class="funnel-bar"><div class="fb-top"><span>${f.label}</span><span class="muted">${f.value} · ${f.pct}%</span></div>
        <div class="fb-track"><div class="fb-fill" style="width:${Math.max(2, f.pct)}%"></div></div></div>`),
    );
  });

  $("#dashcamp").onchange = (e) => {
    store.dashCampaign = e.target.value;
    renderDashboard();
  };
  $("#dashdays").onchange = (e) => {
    store.dashDays = Number(e.target.value);
    renderDashboard();
  };
}

/* ================= CONTACTS ================= */
function pillClass(state) {
  if (state === "DONE") return "done";
  if (state === "AWAITING_FOLLOW" || state === "AWAITING_EMAIL") return "wait";
  return "open";
}

async function renderContacts() {
  const view = $("#view");
  try {
    store.campaigns = (await api("/api/campaigns")).campaigns || [];
  } catch {}
  const qs = new URLSearchParams();
  if (store.contactsCampaign) qs.set("campaign_id", store.contactsCampaign);
  let rows = [];
  try {
    rows = (await api("/api/contacts?" + qs.toString())).contacts || [];
  } catch (e) {
    view.innerHTML = connectBanner() + `<div class="empty">${esc(e.message)}</div>`;
    return;
  }

  view.innerHTML = `
    ${connectBanner()}
    <div class="page-head"><div><div class="page-title">Contacts</div><div class="page-sub">Everyone who entered a campaign.</div></div>
      <div class="toolbar">
        <div class="select-inline"><span class="muted">Campaign</span>
          <select id="ccamp"><option value="">All campaigns</option>${store.campaigns.map((x) => `<option value="${esc(x.campaign_id)}" ${x.campaign_id === store.contactsCampaign ? "selected" : ""}>${esc(x.name || x.campaign_id)}</option>`).join("")}</select></div>
        <button class="btn ghost sm" id="exportcsv">Export CSV</button>
      </div>
    </div>
    <div id="contactlist"></div>`;

  const list = $("#contactlist");
  if (rows.length === 0) {
    list.innerHTML = `<div class="empty">${ICON.inbox}<div>No contacts yet. Once people comment your keyword, they’ll appear here.</div></div>`;
  } else {
    rows.forEach((r) => {
      const initial = (r.username || "?")[0].toUpperCase();
      list.appendChild(
        el(`<div class="contact-row">
          <div class="who"><div class="av">${esc(initial)}</div><span class="uname">${r.username ? "@" + esc(r.username) : esc(r.igsid)}</span></div>
          <div><span class="pill ${pillClass(r.state)}">${esc(r.status_label)}</span></div>
          <div class="col-hide">${r.followed ? "✓ followed" : '<span class="dash">—</span>'}</div>
          <div class="col-hide">${r.email ? esc(r.email) : '<span class="dash">—</span>'}</div>
          <div class="col-hide muted">${new Date(r.updated_at * 1000).toLocaleDateString()}</div>
        </div>`),
      );
    });
  }

  $("#ccamp").onchange = (e) => {
    store.contactsCampaign = e.target.value;
    renderContacts();
  };
  $("#exportcsv").onclick = async () => {
    // Fetch with the auth header (not a token in the URL) and download the blob.
    try {
      const res = await fetch("/api/contacts/export?" + qs.toString(), {
        headers: { authorization: `Bearer ${store.token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "chatmany-contacts.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast("Export failed: " + e.message, true);
    }
  };
}

boot();
