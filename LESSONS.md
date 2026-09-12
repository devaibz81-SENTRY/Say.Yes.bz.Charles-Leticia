# LESSONS — Charles & Leticia RSVP (live site)

Retrospective compiled from the real git history of this project (`main`, 2026-08 → 2026-09).
Goal: **never drop another RSVP.** Every failure below was shipped live, then had to be fixed.
The invariant everything protects:

> **A real guest's RSVP must ALWAYS land in the Convex DB — never in a success-screen lie, never a dead route, never a hidden field.**

---

## 1. The Single/Couple Split — the $64,000 mistake

### What we shipped
A single universal page (`rsvp.html`) that was supposed to "adapt": show Guest 1 for singles, Guest 1 + Guest 2 for couples, toggled by JS.

### What broke
- `903ca35` split into `single.html` + `couple.html` + a router — but Vercel `cleanUrls` 404'd the routes (`b7e3118`, `4fd1a22`, `2e3615e`, `4fa3c2c`, `e0432a5`).
- `e0432a5` disabled the router and parked **everyone on `rsvp.html`**.
- Result: singles on `rsvp.html` still rendered **"GUEST 2 — OPTIONAL"** text and input fields. The page said "1 Guest Allowed" and yet showed a second-guest form. Verified fresh-render, not cache: `coupleFields` present, `guest2Text:true`.

### The fix (final, `e4a215c2`)
- `index.html` invitation button reads the link params and targets the **right dedicated page**:
  - `max=1` / `type=single` → `single.html` (a page whose markup contains **zero** Guest 2)
  - `spouse=` / `type=couple` / `max>1` → `couple.html`
- `rsvp.html` became a **dispatcher**: legacy links auto-redirect to the correct page.
- `single.html` markup has NO `coupleFields`, NO `nameB`, NO "Guest 2" text — nothing to leak.

### Rules
- **Never** decide single/couple by hiding/removing a Guest 2 block. The Guest 2 section must not *exist* in the single page's markup.
- New personalized links are **not** needed for the fix — existing WhatsApp links keep working because routing happens in the pages, not in the link.

---

## 2. Verification lies — my own check bug

### What broke
The fix appeared "verified" with `document.body.innerText.indexOf('Guest 2')` — which is **case-sensitive**, but the page renders "GUEST 2 — OPTIONAL" in all caps. It returned `false` and we shipped believing singles were clean. They weren't.

### Rules
- Never rely on one string check. Dump the **full** `innerText`, check the **DOM**, and check the actual **input fields** (`nameB`, `lastNameB` existence), not just text.
- A single link is verified only when ALL of: `coupleFields === absent`, `nameB === absent`, and no "guest 2" text **in any case**.
- Test in a **fresh tab** (`Page.navigate` to a new target, confirm `location.href` before reading the DOM). Reusing a tab that's still sitting on `couple.html` produces phantom results.

---

## 3. Silent RSVP writes — the worst possible bug

### What shipped
- `postRsvp()` treated *any* outcome as `{ ok: true }` — including network failure — and `res.json()` failures as `{ ok: true, fallback: true }`.
- Old submit path could show **"YOUR RSVP HAS BEEN RECEIVED"** without anything being written to Convex.

### Why it was so dangerous
- `localStorage` (`cl_rsvps`) is per-device; it hides failed saves, and it doesn't sync across phones.
- Jose & Javier/Jasmine were still `invited` in the DB with zero trace — the UI had said success.

### The fix
- Backend is the only source of truth. After submit, reconcile via `GET /api/rsvp/status?guestId=…` and admin live counts (`confirmedGuests / confirmedSeats / totalInvited`).
- If the DB list and live count disagree → **treat as an unsaved RSVP** and investigate before trusting it.

### Rules
- "Success screen" ≠ "saved". Verify in the DB.
- localStorage is a cache, never the record.

---

## 4. Dead routes and the Vercel `cleanUrls` trap

### What shipped
- Router redirects to `single.html` / `couple.html` **before** we knew cleanUrls was stripping/rewriting them → 404s (`18a6a00` slug rewrites mostly failed, `4fa3c2c` loop + guard).
- One "fix" loop was: disable router → universal page → singles see Guest 2 (see §1).

### Rules
- URL paths matter more than UI. Test the **actual deployed URL**, not the local file.
- Keep `vercel.json` minimal and valid: `cleanUrls: true`, `/admin` → `Pages/admin.html` rewrite, `.html` headers `public, max-age=0, must-revalidate`.
- `vercel.json` got corrupted/committed broken twice (`fe0eec6`, `7538c17`) — always `node -e "JSON.parse(...)"` it before deploy.

---

## 5. Couple wiring crashes that also blocked singles

### What shipped
- Couple form referenced missing radios / missing `singleFields` and **threw during init**, breaking the whole RSVP wiring (`0f56946`, `e0db8bd`, `c67972a`).
- Guest 2 held Guest 1 hostage: validation demanded Guest 2 attendance before submitting Guest 1.

### The fix
- Null-guard **everything** (`makeChoices` null-safe, guard `singleFields`/`guestField`/`lastNameField`).
- Guest 2 defaults to **Ask Later** and is fully optional — Guest 1 can always submit.
- Dedicated `couple.html` keeps names prefilled (`nameA`/`lastNameA`/`nameB`/`lastNameB`) even when the DB fetch is slow.

---

## 6. Real guests blocked at the gate

### What shipped
- Strict "guest-list verification" that rejected invited guests whose link had no personal `id` (`7fba878`).

### The fix
- Soft resolution: resolve by `id`, then normalized name, then auto-enroll (`a77f403`, `c645c9a`). **Never block a real invited guest.**
- Read-only "Invited Guest" card replaced the editable name field so plus-one confusion died (`0dec20c`).

---

## 7. Admin must tell the truth

### What shipped
- Admin rows showed the couple's RSVP `plus_names` **including the lead guest twice** ("Lead, PlusOne").

### The fix
- `f76c734` (show plus_names), `7eb1d2e` (edit modal), `ba12321` (strip the lead guest from display).

---

## 8. Deployment rules (memorize)

- **Vercel does NOT auto-redeploy on push.** Always: `npx vercel deploy --prod --yes`. Verify the alias `sayyesbzcharles-leticia.vercel.app`.
- **The folder path contains `&`** (`Charles & Leticia - wedding 2`) — it breaks PowerShell `npx`. Work around by deploying from a safe dir (e.g. `C:\tmp\convex-backend` copy) or quoting the path.
- **Convex CLI needs a deploy key** (`CONVEX_DEPLOY_KEY`), no browser login. Known-good dev deployment: `canny-hummingbird-920` (dev/trey-cabb).
- A duplicate `OPTIONS` route on `/api/guest` blocked `npx convex deploy` (`efcf49b`) — when deploy dies, check `http.ts` route duplicates first.
- Watch the **phone/browser cache**: WhatsApp's in-app browser caches HTML hard. Always verify in a fresh tab / incognito, not inside WhatsApp.

---

## 9. Countdown → Belize Central Standard Time (verified + updated 5 PM)

**Source (`index.html:1901`):**
```js
var wedding = new Date('2026-12-31T17:00:00-06:00');
```

- Target = **Dec 31, 2026, 5:00 PM Belize time** = `2026-12-31T23:00:00.000Z` (epoch `1798765200000`). Updated from 6:00 PM per the couple's 5 PM start; ceremony card is now 5 PM, cocktail 6 PM, reception 7 PM (`index.html:1330`, `1387`, `1395`, `1403`). Calendar links + ICS on rsvp/single/couple shifted DTSTART `20261231T230000Z` / DTEND `20270101T070000Z` and `Time: 5:00 PM`.
- **Belize is UTC-6 (Central Standard Time) year-round — no DST,** so `-06:00` is correct for every day of the year.
- The math is epoch-based (`wedding.getTime() - Date.now()`), so it is identical on every device/browser regardless of the viewer's timezone.
- After the wedding moment, the countdown **flips to count-up** (`elapsed = Date.now() - wedding.getTime()`), label swaps to "Forever & a day" — it becomes "how long we've been married". No more "big night arrived" dead panel.

**The rule (from the previous project's disaster):** every `new Date('...')` must carry an explicit offset — `-06:00` for Belize, or `Z` for UTC. Ambiguous strings ("2026-12-31T18:00:00") parse as local time in Chrome and UTC in Safari — a multi-hour countdown lie. Also: when the couple says "time changed to X", **update every surface** — hero strip, schedule cards, countdown target, Google Calendar TEMPLATE dates, and the ICS DTSTART/DTEND — not just the countdown line.

---

## 10. Release ritual — pre-deploy checklist

1. `git status` clean intentions; commit message explains **why**.
2. `node --check` on any edited inline JS (extract the script blocks).
3. Deploy backend first (`convex deploy` from a safe dir with key), then `npx vercel deploy --prod --yes`.
4. **Fresh-tab headless render** of at least: one couple link (Guest 1 + Guest 2 prefilled), one single link (`coupleFields`/`nameB` **absent**, no "guest 2" text in any case).
5. Confirm the DB writes: admin list + live count in sync.
6. Announce, don't assume. Vercel deploy shell output must show `Aliased:` for the main alias.

---

## 11. Parallax leak — the last photo escaping its darken overlay

**Symptom (couple-reported):** "the last photo is revealing [itself] from behind the darken overlay."

**Root cause (`index.html`):** the closing-hero section (last photo, `galery (1)`) wrapped its background photo in `.ch-photo` whose sibling overlay `.ch-vignette` is `position:absolute; inset:0; z-index:1`. The parallax JS (`index.html:2212-2236`) sets a per-frame `translate3d(0, y, 0) scale(...)` on the `img`, and CSS `ambDrift` (line 1021-1031) continuously scales the wrapper up to `scale(1.18)`. Because `.closing-hero` had `overflow: visible !important`, the drifting photo grew **beyond the vignette** — measured headlessly via `getBoundingClientRect`: 30-38 px above/below and 59-75 px left/right of the section box — so bright photo pixels poked out past the darkened overlay at the page's very bottom where there's nothing below to clip it.

**Fix:** `.closing-hero { overflow: hidden !important }` (was `visible`). The other four backdrop sections (`.cinematic-break`, `.rsvp-photo-section`, `.gallery-section` photo, `.dresscode-section`) all already had `overflow: hidden`, so only the final hero could leak.

**Verification rule:** a parallax bug can't be seen in a screenshot at rest — `ambDrift` maxes out on a 20 s loop. Freeze it at peak: `ph.style.animation='none'; ph.style.transform='scale(1.18)` then read `getBoundingClientRect` on `.closing-hero` vs `.ch-photo` (or capture a frame). If the photo's box exceeds the section box and the section has `overflow: visible`, you have the leak — fix the clip, not the animation.