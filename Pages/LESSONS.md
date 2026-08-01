# Lessons Learned — Wedding Invitation Project

A retrospective on building `https://wedinvitation-ruddy.vercel.app` for Andrew & Rosanna's wedding (July 4, 2026, Belize).

---

## 1. Time & Date — The Timezone Trap

### The Bug
```js
const wedding = new Date('2026-07-04T14:00:00');
```
This is **ambiguous**. Different browsers interpret ISO-like strings differently:
- Chrome treats it as **local time** (your machine's timezone)
- Safari treats it as **UTC**

So on a machine in EST (UTC-5), 2pm would be interpreted as 2pm local, which means the countdown showed the wrong remaining time by 5+ hours.

### The Fix
```js
const wedding = new Date('2026-07-04T14:00:00-06:00');
```
Always include the timezone offset. Central Standard Time (Belize, Chicago) is `-06:00`.

### The Rule
**Every date/time in JavaScript needs an explicit timezone.** Never write `new Date('YYYY-MM-DDTHH:mm:ss')` without the offset. Use `-05:00` (EST), `-06:00` (CST), or `Z` (UTC).

### Post-Event Handling
The countdown doesn't stop on the wedding day. After 2pm CST July 4:
- The title changes to **"How long we've been married"**
- The timer keeps ticking **up** (absolute value of diff)
- Both `index.html` and `invitation.html` needed this logic

**Two codebases, two bugs.** `invitation.html` originally just showed "Today is the Day!" and stopped. Had to rewrite it to match `index.html`.

---

## 2. Video — The Three-Headed Monster

This project ended up with **three separate video elements** all playing the same file (`DJI_0932_1.mp4`):

### Video 1: Intro Overlay (invitation.html)
- `<video id="intro-video">` replaces the original invitation GIF
- `preload="auto"` starts downloading immediately while the overlay shows
- `muted loop playsinline poster="..."` for autoplay compliance
- Starts playing on **first tap** (when music starts)
- Flies away with the overlay on second tap

### Video 2: Hero Background (invitation.html)
- `<video id="hero-video">` behind the hero text
- Same `preload="auto" muted loop playsinline` attributes
- Starts playing on **second tap** (when entering the site)
- Browser caches the video from Video 1, so no extra download

### Video 3: Main Card Photo (both pages)
- `<video class="gallery-main-photo">` in the gallery grid
- Same file, different element
- `autoplay` needed because it's triggered by scroll, not user tap

### Things That Hurt

**`autoplay` is blocked unless:**
- The video is `muted`
- The user has interacted with the page first
- Chrome also requires `playsinline` on mobile

**Poster images still matter.**
```html
<video poster="photos/main-card-photo.gif">
```
The poster shows while the video loads. Without it, the video area is black/empty.

**`preload="auto"` preload links:**
```html
<link rel="preload" as="video" href="..." type="video/mp4" fetchpriority="high">
```
Use `as="video"`, not `as="image"` or `as="fetch"`. And include `type="video/mp4"`.

**The old `primeMediaCache` function uses `new Image()` — doesn't work for video.**
Had to remove `main-card-photo.gif` from the image cache array when replacing it with a video.

### Aspect Ratio Lesson
```css
/* Parent overrides child */
.photo-rounded-holder {
  aspect-ratio: 3/4;  /* This wins */
}
.photo-rounded-holder video {
  aspect-ratio: 1/1;  /* This loses */
}
```
Set `aspect-ratio` on the **container**, not the child. The child fills the container with `object-fit: cover`.

---

## 3. Google Apps Script — The Phantom Deploy

### The Trap
Editing code in the Apps Script editor is **not enough**. The deployed web app runs the code that was live when you last clicked **Deploy > New Deployment**. You can stare at the updated code in the editor all day — it won't run until you create a new deployment version.

### The Workflow
1. Edit `code-gs.txt` locally
2. Open `script.google.com`
3. Paste the full code
4. **Deploy > New Deployment** (not just save)
5. Copy the new URL
6. Update the URL in all HTML files
7. Test with `curl` or browser

### The Consequence
The seating feature shipped with **old Apps Script code** that doesn't have the `saveSeating`/`getSeating` endpoints. The 99 pre-assigned table numbers only work because of **embedded fallback JSON** in both `admin.html` and `tables.html`.

---

## 4. Convex — The Half-Working Backend

### Known Issues
- **`POST /api/guest` returns 500** from CLI/PowerShell/curl
- Works from the browser admin page (different auth context?)
- Cannot write `table_number` or any field programmatically

### What Works
- Reading guest data (`GET /api/guest`)
- Writing via the admin page's JavaScript
- RSVP form submissions

### The Lesson
**Always test API endpoints from multiple contexts** before committing to an architecture. If the admin panel is the only way to write data, build all write operations through the admin page — don't try to write from scripts or CLIs.

### Auth Token Pattern
The admin uses a simple token-based auth:
```js
const ADMIN_TOKEN = '944a4f16-9bf5-4f4a-9a06-00d338e550b9';
```
This is stored in `localStorage` and checked on page load. Every fetch includes the token. Simple, but works for a wedding site.

---

## 5. Seating — The Manual Matching Nightmare

### The Problem
99 guest names from a physical seating chart needed to match against Convex guest records. Names don't always match exactly:
- "Elvis Usher" in seating list vs "Elvis U" in Convex
- Kids without individual entries
- Spouses listed differently
- Middle names/informals

### The Solution
1. User provided a text list of `"Name" → Table N` mappings
2. Manually matched each name to a Convex `_id`
3. Embedded the 99 matching pairs as a JavaScript object in both `admin.html` and `tables.html`
4. Unmatched names (kids, spouses without entries) were excluded

### The Architecture
```
Admin Page:
  "Load Pre-assigned" button → fills localStorage with the 99 pairs
  "Save All" button → POST to Apps Script → Google Sheets "Seating" sheet
  Editable table → user can modify before saving
  localStorage → survives page refresh, cleared on "Save All"

Table Finder (tables.html):
  Search box → filter names → show table number + tablemates
  Fallback data → identical embedded JSON, works without Apps Script
  QR code link → `/tables` URL so venue can scan and look up
```

### The Lesson
**Manual name matching is unavoidable** when you don't have a shared unique identifier. Next time:
- Add a `seating_name` field to guest records during import
- Or use a unique invite code for each guest
- Or build the seating chart into the same database, not a separate sheet

---

## 6. The Admin Login Dance

### The Bug
```js
// Wrong
const token = admin;  // undefined

// Right
const token = adminToken;
```

The variable was renamed from `admin` to `adminToken` somewhere in the history, but not all references were updated. The QR scanner check-in broke because of this.

### Where Auth Lives
- `SESSION_KEY` in localStorage (`rosepassy_admin_session`)
- Same key used across `admin.html`, `checkin.html`, and `tables.html`
- Login form checks against hardcoded password

### The Lesson
When renaming variables, **grep for ALL usages**. Better yet, use a single auth module/script shared across pages.

---

## 7. QR Code — Position Hell

It took **20+ commits** to get the QR code in the right position on the RSVP confirmation card.

### The Iteration
```
QR code → bottom of card (too low)
       → right side (too far)
       → 100px right → 900px right → 1100px right → 1220px right
       → up 100px → up 200px → up 600px
       → collapsible dropdown → own space → inside card → outside card
       → bigger → with border → without border
```

### The Lesson
**Design in the browser, not in your head.** The RSVP card is rendered by JS with absolute positioning — every change needed a new deploy to test. Next time:
- Use CSS Grid or Flexbox for the card layout
- Or build the card in HTML and use a screenshot library
- Or accept that the QR code position will take 10+ tries

---

## 8. Easy Mode — The Two-Faced RSVP

### The Concept
Two modes for the RSVP form:
- **Easy Mode** (`?easy=1`): Show only first name + attendance (Yes/No/Later). Minimal, mobile-friendly.
- **Advanced Mode** (`?advanced=1` or default): Full form with plus-ones, song requests, dietary notes.

### The Implementation
```js
const urlParams = new URLSearchParams(window.location.search);
const isEasy = urlParams.get('easy') === '1';
const isAdvanced = urlParams.get('advanced') === '1';
```

Admin page has a checkbox per guest: "Enable Easy Mode." When checked, the RSVP link includes `?easy=1`.

### The Gotcha
**Existing RSVP links were already sent** before Easy Mode existed. The fix: make Easy Mode the **default** for all links (`?easy=1` is implied), and use `?advanced=1` to get the full form. This way old links automatically get the simpler experience.

---

## 9. Vercel — The Silent Deploy

### Custom Domain
The production URL `https://wedinvitation-ruddy.vercel.app` is a custom domain alias. Pushing to GitHub doesn't automatically deploy to this URL — you need:
```bash
npx vercel --prod --yes
```
The `--prod` flag is essential. Without it, Vercel creates a preview deployment with a random URL.

### Git Email Blocking Deploys
Vercel was silently failing deploys because the git author email was wrong:
```
devaibz81.sentry@example.com  ← Vercel blocked this
devaibz81@gmail.com           ← Fixed
```

### Route Config (vercel.json)
```json
{
  "cleanUrls": true,
  "routes": [
    { "src": "/", "dest": "/index.html" },
    { "src": "/rsvp", "dest": "/rsvp.html" },
    { "src": "/admin", "dest": "/admin.html" },
    { "src": "/tables", "dest": "/tables.html" },
    { "src": "/messages", "dest": "/messages.html" },
    { "src": "/playlist", "dest": "/playlist.html" }
  ]
}
```
`cleanUrls: true` removes `.html` extensions from URLs. Every new HTML page needs a route entry.

---

## 10. CSS & Styling — The Hidden Mines

### Color Palette
```css
--gold: #c9a84c;
--cream: #faf7f2;
--champagne: #f5e6d3;
--ivory: #fffff0;
--black: #1a1a1a;
--green: #7a8e78;
```

### Video Background Text Readability
**White/gold text on video needs a dark overlay.**
```css
#hero-overlay {
  background: rgba(0,0,0,0.4);
  z-index: 1;
}
#hero > *:not(#hero-video):not(#hero-overlay) {
  position: relative;
  z-index: 2;
}
```

### The `::before` Surprise
The hero section's `::before` pseudo-element had `z-index: auto` (default), which meant it sat on top of the video. Had to explicitly set `z-index: 1` on `::before` to keep the gradient over the video but under the text.

### Mobile Dark Mode Override
```css
@media (prefers-color-scheme: dark) {
  .hero-names { color: #ffffff !important; }
  /* ... multiple !important overrides ... */
}
```
Dark mode media queries can break your carefully chosen colors. Test with dark mode enabled on both desktop and mobile.

### Flip Clock CSS
The countdown uses a 3D card-flip animation:
```css
.count-number {
  box-shadow: inset 0 15px 50px #202020, 0 3px 10px #111;
  border-top: 1px solid #393939;
  border-bottom: 1px solid #111;
}
```
The fake 3D effect comes from the inset shadow + top/bottom border contrast. Cheap but effective.

---

## 11. The RSVP Confirmation Card

### Architecture
The card is **generated entirely in JavaScript** — not HTML/CSS. It uses:
- A container `div` with explicit width/height
- Absolutely positioned text elements
- A QR code generated by `qrcode.js` library
- An external photo loaded and drawn onto a canvas

### The Photo Loading Nightmare
```js
const photo = await loadImage('photos/main-card-photo.gif');
```
The card generation waits for the photo to load. If it fails, the card shows broken. The fix was to **preload** the photo early:
```js
// At page load, start loading the photo
const img = new Image();
img.src = 'photos/main-card-photo.gif';
```

### The Lesson
For generated images/cards:
1. Preload ALL assets at page load, not when the user clicks "RSVP"
2. Handle loading failures gracefully (fallback colors)
3. Cache the generated card so re-renders are instant

---

## 12. Guest Params in URL — The Fragile Chain

### The Flow
1. Guest clicks personalized link like `invitation.html?name=Elvis&id=abc123`
2. Parameters are carried through to `rsvp.html?name=Elvis&id=abc123&opened=1`
3. RSVP form pre-fills the name from URL params
4. On submit, the guest ID is sent to Convex

### The Bug Potential
- If `opened=1` isn't set, the RSVP redirect might not work
- If params are dropped anywhere in the chain, the guest is anonymous
- URL params in navigation links (`<a href="rsvp.html">`) need to be dynamically updated

```js
const guestParams = new URLSearchParams(window.location.search || '');
if (guestParams.toString()) {
  guestParams.set('opened', '1');
  const rsvpQuery = `?${guestParams.toString()}`;
  document.querySelectorAll('a[href="rsvp.html"]').forEach((link) => {
    link.href = `rsvp.html${rsvpQuery}`;
  });
}
```

---

## 13. The Python Script Pipeline

### 15 scripts, each doing one thing:
| Script | What it did |
|--------|------------|
| `split_site.py` | Split single page into index + invitation |
| `replace_colors.py` | Swap gold/cream to black/white |
| `apply_aura.py` | Add animated gradient background |
| `apply_copy.py` | Click-to-copy bank details |
| `apply_scribble.py` | Hand-drawn checkmark SVG |
| `apply_radio.py` | Animated radio button SVGs |
| `apply_premium_flipper.py` | Flip clock countdown |
| `apply_nav_quote.py` | RSVP nav link + quote card |
| `apply_form_style.py` | Pill-shaped form inputs |
| `apply_widgets.py` | Heart preloader + flip clock CSS |
| `enhance_gift_card.py` | Gift modal with copy button |
| `clean_gift.py` | Deduplicate bank details |
| `update_admin_and_font.py` | Font fixes, textarea for WhatsApp |

### The Approach
Each script reads the HTML file, applies string replacements/regex transformations, and writes it back. **No build step, no template engine.** Just raw find-and-replace.

### The Lesson
This works for a single-page site but **doesn't scale**. Next time:
- Use a real template engine (Nunjucks, EJS, Handlebars)
- Or a static site generator (11ty, Astro)
- Or at minimum, extract shared CSS/JS into separate files

---

## 14. Git & Workflow

### Rules That Emerged
- **Always check `git status` before committing** — caught the root-level video file
- **Commit messages should explain why, not what** — "Fix countdown to use CST timezone" is better than "Update date"
- **Push after each working change** — the user was checking the live site immediately
- **Vercel auto-deploys from main branch** — but `--prod` is needed for the custom domain

### The Email Debacle
```bash
git config user.email "devaibz81@gmail.com"
```
Vercel checks the git author email against your Vercel account. If they don't match, deploys fail silently. The error message doesn't tell you this — you have to dig through build logs.

---

## 15. localStorage — The Accidental Database

### Used For
- **Admin session**: `rosepassy_admin_session` — persists login
- **Seating assignments**: Pre-load data survives page refresh
- **QR scanner session**: Check-in state across page reloads

### The Pattern
```js
// Save
localStorage.setItem('seatingAssignments', JSON.stringify(data));

// Load
const saved = localStorage.getItem('seatingAssignments');
if (saved) assignments = JSON.parse(saved);

// Clear
localStorage.removeItem('seatingAssignments');
```

### The Lesson
localStorage is perfect for:
- Temporary draft data (seating before "Save All")
- Session tokens (admin login)
- User preferences (Easy Mode)

It's wrong for:
- Permanent data (use a real DB)
- Sensitive data (it's readable in DevTools)
- Large data (>5MB limit)

---

## 16. Mobile Responsiveness — The Constant Battle

### Key Techniques Used
```css
/* Fluid sizing */
font-size: clamp(1rem, 3vw, 2rem);
width: min(90vw, 400px);

/* Full viewport height */
min-height: 100dvh;  /* dynamic viewport height — handles mobile browser chrome */

/* Touch-friendly */
-webkit-tap-highlight-color: transparent;

/* Gallery grid collapse */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: 1fr;  /* single column on mobile */
  }
  .photo-frame.tall {
    grid-column: 1 / -1;  /* full width */
  }
}
```

### `100vh` vs `100dvh`
`100vh` on mobile includes the browser chrome (address bar, toolbar). `100dvh` uses the dynamic viewport — the actual visible area. Always use `dvh` for full-screen sections on mobile.

---

## 17. Security — The Bare Minimum

### Password (Hardcoded)
```
RosePassy-Admin-2026!
```
Stored in `admin.html` as a JavaScript string. Not secure by any professional standard, but sufficient for a wedding site.

### Admin Token
```
944a4f16-9bf5-4f4a-9a06-00d338e550b9
```
Sent as a query parameter in every API call. The Convex backend checks this token.

### The Threat Model
This is a wedding website, not a bank. The security measures prevent:
- Accidental access by guests
- Casual vandalism
- Search engine indexing of admin pages

They don't prevent:
- A determined attacker with browser DevTools
- Anyone who reads the source code

### The Lesson
**Match your security to your threat model.** A wedding site with 150 guests doesn't need OAuth2. A hardcoded password + token is fine. But **extract secrets into environment variables** if you ever make the repo public.

---

## 18. Checklist for Your Next Project

### Before Starting
- [ ] Pick your stack (framework? database? hosting?)
- [ ] Set up **GitHub + Vercel** auto-deploy
- [ ] Configure git email to match Vercel account
- [ ] Choose a **single timezone** and standardize all dates
- [ ] Set up environment variables for secrets
- [ ] Decide on mobile-first or desktop-first design

### During Build
- [ ] Use `<link rel="preload">` for all critical assets
- [ ] Handle loading/error/empty states for every component
- [ ] Test API endpoints from both browser and curl
- [ ] Test on real mobile devices, not just DevTools
- [ ] Test in dark mode
- [ ] Set `aspect-ratio` on containers, not children
- [ ] Don't deploy Apps Script — **deploy a new version**
- [ ] `muted + playsinline + autoplay` for every video

### Before Launch
- [ ] Check git author email matches Vercel account
- [ ] `npx vercel --prod --yes` to promote to custom domain
- [ ] Clear localStorage and test fresh visit
- [ ] Print QR codes and test scanning
- [ ] Test RSVP flow end-to-end (link → form → confirmation)
- [ ] Check analytics (if any) are working

### The Golden Rule
**If you changed it in the code, deploy it to production before telling anyone.** Half the bugs in this project were "I fixed it but didn't deploy" issues.

---

## 19. File Organization — What Goes Where

```
photos/
├── invitation-3.gif       ← Original intro GIF (now replaced by video)
├── intro.gif              ← Index page intro GIF 
├── main-card-photo.gif    ← Poster for videos + RSVP card
├── main-card-video.mp4    ← Church exit video (gallery)
├── hero-video.mp4         ← Same video (hero background)
├── dinner.gif             ← Gallery photo
├── cheers.gif             ← Gallery photo
├── story-photo.gif        ← Story section photo
└── new_dress_code.jpeg    ← Dress code image

audio/
└── MUSIC.mp3              ← Background music
```

**Two copies of the same video file** (`main-card-video.mp4` and `hero-video.mp4`) because HTML video elements reference separate paths. The browser caches it so no extra bandwidth, but the file takes up space in git. Next time: use symlinks or a single path.

---

## 20. Random Gems

### `requestIdleCallback` for Non-Critical Preloading
```js
if ('requestIdleCallback' in window) {
  requestIdleCallback(warm, { timeout: 1200 });
} else {
  setTimeout(warm, 250);
}
```
Preload images when the browser is idle, not at page load. Falls back to a timeout for older browsers.

### The Enter-Prompt Two-Click Flow
1. First click: starts music + intro video
2. Wait 10 seconds (show "Tap to Enter")
3. Second click: enter the site

This gives the video time to buffer before the user enters. Without the delay, the hero video would stutter on start.

### `history.scrollRestoration = 'manual'`
Prevents the browser from restoring scroll position on reload. Essential for the intro overlay — without it, the page sometimes starts scrolled down, showing the hero instead of the overlay.

### Petal Animation
Floating petals are pure CSS:
```css
@keyframes petalFall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
  10% { opacity: 0.6; }
  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
}
```
18 `<div>` elements created with JS, each with random position and animation delay. Simple, no JS physics library needed.

---

## Final Thought

> "The second site will take half the time and be twice as good."

Every mistake here is a lesson for next time. The timezone bug alone cost hours of debugging. The Apps Script deploy trap cost a weekend. The QR positioning took 20 attempts.

But now you know. And the next project — whatever it is — will be smoother because of everything this one taught you.
