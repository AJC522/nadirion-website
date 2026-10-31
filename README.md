# Nadirion Company Website

Static marketing site for Nadirion, built around selling **Nadirion Desktop** (formerly the
Threat Operations Toolset) and its add-on modules. Every license starts with Nadirion
Desktop; each of the 33 modules is a separate add-on. Buyers can purchase direct or through
a certified reseller, and companies and individuals can apply to become one. Nadirion's
consulting, training, and autonomous-platform work keeps its own pages under "Services".

Plain HTML, CSS, and JavaScript: no build step, no framework, no runtime dependencies, and
nothing loaded from another origin.

## Design

- **Palette:** black, white, and silver only, with metallic gradients for accent text.
- **Theme:** astronomy and space, including an animated starfield, a constellation
  illustration in the About section, and zenith/nadir markers that tie back to the company
  name.
- **Typography:** Space Grotesk for display, Inter for body copy, JetBrains Mono for
  labels and the console mockups.
- **Motion:** CSS animations run a set number of times, the starfield draws only while it
  is on screen and the tab is visible, and the home hero has a Pause motion button. The
  choice is kept in `localStorage` (`nadirion.motion`); visitors who prefer reduced motion
  start paused.

### Fonts

The fonts are self-hosted WOFF2 subsets in `assets/fonts/` (Latin and Latin Extended for
each family, Greek for JetBrains Mono, and small symbol subsets for arrows and check marks),
declared with `@font-face` at the top of `styles.css`. Each family's SIL Open Font License
ships beside the files (`OFL-Inter.txt`, `OFL-SpaceGrotesk.txt`, `OFL-JetBrainsMono.txt`)
and must stay there. Metric-matched local fallbacks ("Inter Fallback" and the others) keep
text from jumping when the web fonts arrive. Hosts cache font files for a year as
immutable, so a changed font needs a new filename (update `@font-face` and the preloads in
`tools/sync-heads.py` to match).

## Structure

```
index.html                        home: product hero, how licensing works, module
                                  categories, console, principles, resellers teaser, about
desktop.html                      Nadirion Desktop: what every license includes, console,
                                  install
modules.html                      module catalog: search, category filter, "add to license"
pricing.html                      licensing model, ways to buy, buying steps, FAQ
resellers.html                    certified reseller program, tracks, application form,
                                  verify a reseller
contact.html                      quotes (with the license being built), demos, security
                                  reports, everything else
privacy.html                      what this website does with information
404.html                          not-found page (root-absolute URLs, noindex)
cyber.html                        service: Cyber Operations
software-development.html         service: Software Development
digital-forensics.html            service: Digital Forensics
it-consulting.html                service: IT Consulting
training.html                     service: Training (business, IT, cyber, and sales tracks)
satellites.html                   platform: Satellites
maritime-drones.html              platform: Maritime Drones
aerial-drones.html                platform: Aerial Drones
assets/css/styles.css             font faces, design tokens, and all styling
assets/js/boot.js                 marks <html> with class "js" before first paint
assets/js/catalog.js              module ids, names, categories, and prices (the commercial
                                  record)
assets/js/main.js                 nav, menus, reveal, starfield and motion, catalog, license
                                  tray, forms
assets/fonts/                     self-hosted fonts and their licenses
assets/img/                       logo mark, favicon.svg, select caret, app icons (PNG), and
                                  og-image.png (1200x630 link preview)
favicon.ico                       32px icon for clients that only ask for /favicon.ico
site.webmanifest                  name, colors, and icons
sitemap.xml                       every indexable page at its canonical URL
robots.txt                        allows all crawling; points at the sitemap
.well-known/security.txt          RFC 9116 contact for vulnerability reports
_headers                          security and cache headers (Netlify, Cloudflare Pages)
.nojekyll                         makes GitHub Pages publish the files as they are
tools/check-site.mjs              invariant checks; run before every commit
tools/sync-heads.py               rebuilds every <head> from one template
tools/sync-furniture.py           rewrites the shared header, footer, and breadcrumbs
.github/workflows/check-site.yml  runs the checks on every push and pull request
```

Every page lives at the repo root, so internal links are flat filenames. The home page is
linked as `./` (and `./#about`), never `index.html`, so links match its canonical URL.
404.html is the one exception to relative links; see [Hosting](#hosting).

### Page furniture

The head, header, footer, and breadcrumbs are copied into every page, since the site has
no build step. Two scripts keep the copies identical (see
[Shared head and furniture](#shared-head-and-furniture)), so edit the templates in those
scripts rather than any one page.

The header links the four product pages, a Services menu (grouped into "Digital & Security
Services" and "Autonomous Platforms"), and a Request a Quote button; the current page is
marked with `aria-current="page"`. The footer has the brand and four link groups: Product,
Resellers, Services & Platforms, and Company (About, Contact, Privacy, and the email
address). Every page except the home page and 404.html has a breadcrumb,
`<nav class="crumb">` with an `<ol>`; pages in the Services menu read Home / Services (or
Autonomous Platforms) / page, with the middle level as plain text.

### The head

Every `<head>` holds, in this order:

1. `<meta charset>`, the viewport, and the Content Security Policy as a `<meta>`. The CSP
   must come before every `<link>` and `<script>`: a meta policy covers only what follows
   it.
2. The referrer policy, `<title>`, description, canonical URL, and theme color.
3. Open Graph and Twitter card tags, all pointing at `assets/img/og-image.png`.
4. Icons and the web manifest.
5. Preloads for Inter and Space Grotesk (Latin), the two fonts every page needs first.
6. `assets/js/boot.js`, then the stylesheet. boot.js is one line that adds class `js` to
   `<html>` before first paint, so CSS scoped to `html.js` (reveal animations, controls
   that need the script) never flashes. It stays a separate file, loaded without `defer`.
7. Structured data (JSON-LD): the Organization on every page, WebSite on the home page,
   SoftwareApplication on desktop.html, and a BreadcrumbList built from the visible
   breadcrumb. It carries no prices or ratings, because the site states none.

### Content Security Policy

Every page carries the same policy, and `_headers` sends it again as a header with
`frame-ancestors 'none'` added (browsers honor `frame-ancestors` only in a header; in a
`<meta>` it is ignored and logs an error):

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'self';
object-src 'none'; require-trusted-types-for 'script'; trusted-types 'none';
upgrade-insecure-requests
```

What that means for anyone editing:

- **No inline script.** Scripts load only from `assets/js/`. No `<script>` blocks (the
  JSON-LD block is data, so it is allowed), no `onclick=` or other `on*` attributes, no
  `javascript:` links. Bind events in `main.js`.
- **No inline style.** No `<style>` blocks and no `style=""` attributes; add a class to
  `styles.css`. Setting `el.style.something` from a script is fine.
- **No HTML strings in JavaScript.** Trusted Types makes the browser refuse `innerHTML`,
  `outerHTML`, `insertAdjacentHTML`, `document.write`, and `srcdoc`. Build elements with
  `createElement` and set text with `textContent`.
- **Everything from this site.** Images, fonts, and requests must come from nadirion.us:
  no `data:` URIs (the select caret is a file for this reason), no hotlinked images, no
  font or analytics services, and `fetch` only to the same origin (see [Forms](#forms)).

Both policies are enforced and the stricter one wins, so a source added to one but not the
other stays blocked. To change the policy, edit `CSP` in `tools/sync-heads.py` and the
`/*` rule in `_headers` together, run sync-heads, then run the checks, which compare the
two.

## Selling: modules, prices, and quotes

### Module catalog

`modules.html` lists every module as an `<article class="mod-card">` grouped by category.
The module set mirrors the module list in the Nadirion Desktop source: the 33 modules in
shipping sections are sold as add-ons, and the two in its Development Preview section
(Intelligence Map, Investigation Queue) are shown as "in development" without an add
button. Each card's `data-aliases` holds the app's search aliases, so the site's search
finds the same modules the app's does ("autoruns", "evtx", "netstat").

When a module is added, removed, or renamed, change its card in `modules.html` and its
entry in `assets/js/catalog.js` (same id; the card id is the same id with hyphens), then
run `node tools/check-site.mjs`. It compares the two and reports every count or name that
no longer matches, wherever it is quoted: the title, description, heading, and per-category
counts on modules.html; the hero, stat strip, headings, and category cards (count and
listed modules) on the home page; the plan and per-category list on pricing.html; and the
figures on desktop.html, resellers.html (products to sell is the desktop plus the
add-ons), and cyber.html. Spelled-out numbers ("Thirty-three") are checked too.

### Prices

Prices live only in `assets/js/catalog.js`. Every price starts as `null`, which sells that
item on quote: nothing price-shaped appears for it. Set a number and it shows on the module
card, in the license tray, on the pricing page (for Nadirion Desktop), and in the quote
form. The tray and quote form show a total only when every item in the license is priced.
`currency` and `priceUnit` ("per seat") apply to every price.

### The license being built

The "Add to license" buttons store the selected module ids in `localStorage`
(`nadirion.license.modules`), with an in-memory fallback when storage is unavailable. The
tray's Request a Quote link also carries the ids in the URL (`?modules=a,b`), and the
contact page lists them in the quote box and sends them with the request. privacy.html
names both storage keys; update it if either changes.

### Forms

The contact and reseller forms (`form.js-send`, `method="post"`) send in one of two ways:

- **With `data-endpoint` set** on the `<form>` to a URL that accepts a POST and answers
  2xx, the form posts there and confirms only after a successful response.
- **Without it** (the default), submitting opens the visitor's email app with a message to
  `contact@nadirion.us` (override with `data-to`) already written, and says so. Nothing is
  reported as sent when it was not.

The CSP's `connect-src 'self'` lets a form post only to this site, such as a handler the
host serves at `/api/contact`. An endpoint on another origin needs three changes in the
same commit: add its exact origin (for example `https://formspree.io`) to `connect-src` in
the CSP meta of every page (the `CSP` constant in `tools/sync-heads.py`) and in `_headers`,
then update privacy.html, which today says the forms only open the visitor's email app.
Until all three are done the browser refuses the request, and the checks fail.

Each form has a note for each mode (`.form-note[data-send-mode="email"]` and
`[data-send-mode="endpoint"]`); the script shows the one that applies. Without JavaScript
the form is hidden and a `.no-js-note` gives the email address instead. The hidden
`_gotcha` field (`data-trap`) is a spam trap: it is left out of the message, and a filled
one stops the send.

Rows marked `data-show-when="field:value|value"` appear only while that field has one of
those values; while hidden they are disabled, so their required fields don't block sending.
Links can preselect a choice: `contact.html?interest=<option value>` and
`resellers.html?track=company|individual`.

## Hosting

The site has no publish step: the host serves the repo root as it is.

- **Which host reads what.** Netlify and Cloudflare Pages read `_headers`: the CSP with
  `frame-ancestors`, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` on
  fonts, CSS, and JavaScript, and the cache rules. GitHub Pages ignores `_headers`, so
  there only the meta CSP (without `frame-ancestors`) and the meta referrer apply: no
  clickjacking protection, no HSTS beyond the Enforce HTTPS setting, and GitHub's own
  caching. For the full set on GitHub Pages, put Cloudflare in front of it.
- **.nojekyll.** GitHub Pages runs Jekyll unless this empty file exists, and Jekyll drops
  folders that start with a dot, so `/.well-known/security.txt` would 404. Netlify and
  Cloudflare Pages ignore it.
- **URL form.** Canonical URLs, `og:url`, JSON-LD, and `sitemap.xml` use
  `https://nadirion.us/<page>.html`, with the home page as `https://nadirion.us/`.
  Cloudflare Pages strips `.html` (it redirects `/desktop.html` to `/desktop`), so on that
  host every canonical would point at a redirect. If the site moves there, switch the URL
  form in `page_url` in `tools/sync-heads.py`, in `sitemap.xml`, and in `canonicalFor` in
  `tools/check-site.mjs` together. On Netlify, leave Pretty URLs off.
- **What gets published.** Serving the repo root also publishes `README.md`, `tools/`, and
  `.github/` (this file is public at `/README.md`). Nothing in them is secret, and it must
  stay that way: keep internal names, paths, and credentials out of every file. To hide
  them, give the host a publish directory, or on Netlify add `_redirects` rules such as
  `/README.md /404.html 404` (Cloudflare Pages `_redirects` cannot return a 404). If the
  site is ever served from a plain web server or bucket, do not upload `.git/`, and turn
  off directory listing.
- **HSTS.** `_headers` sends HSTS for a year with `includeSubDomains`, which makes
  browsers refuse plain HTTP on every nadirion.us subdomain for that year. Confirm each
  subdomain serves HTTPS before launch, or drop `includeSubDomains`. Consider preload only
  after a stable period.
- **Caching.** Fonts are cached for a year as immutable (rename a changed font). CSS and
  JavaScript keep their names between releases, so browsers revalidate them on every load
  (a cheap 304); images and security.txt keep for a day; HTML uses the host's default. A
  path that matches several `_headers` rules gets all their headers, so each header name is
  set by only one rule that can match a given path.
- **404.html.** Hosts serve it at whatever path was missing, so every URL in it is
  root-absolute (`/assets/css/styles.css`, `/desktop.html`, `/`); relative ones would break
  under `/some/missing/path`. It has `noindex`, no canonical or structured data, and is not
  in the sitemap. Write new links in it root-absolute, or run `tools/sync-furniture.py`,
  which converts them.
- **security.txt.** Lists the contact address, an expiry date, the preferred language, its
  canonical URL, and the policy (the Security reports section of contact.html). **Renew
  Expires before 2027-10-30**: an expired security.txt must not stay published, and
  RFC 9116 asks for a date less than a year ahead. The checks warn 30 days before it
  expires and fail once it has. After a deploy,
  `curl -sI https://nadirion.us/.well-known/security.txt` should answer 200 with
  `Content-Type: text/plain`.
- **sitemap.xml and robots.txt.** The sitemap lists every page except 404.html at its
  canonical URL; add new pages to it and keep `lastmod` accurate. robots.txt allows
  everything (search engines need the CSS and JS to render pages) and names the sitemap.

## Maintenance

### Checks

`node tools/check-site.mjs` needs Node 18 or later and nothing else. It checks the rules a
site with fourteen copies of everything tends to drift from:

- markup basics: one `<h1>` and `<main>`, heading levels, unique ids, every
  `aria-controls`/`aria-labelledby`/`for` target, `<button type>`, labelled `<nav>`s
- every local link, `#fragment`, `?interest=`/`?track=` value, and CSS `url()` target
- the CSP rules above, in markup, CSS, and scripts, and any `data-endpoint` origin
- the head: element order, one CSP everywhere equal to `_headers` minus `frame-ancestors`,
  canonical = `og:url` = sitemap `<loc>`, unique titles and descriptions, font preloads,
  JSON-LD that parses and a BreadcrumbList that matches the visible breadcrumb
- header and footer identical on every page apart from `aria-current`
- the catalog against modules.html and every count quoted from it
- sitemap.xml, robots.txt, security.txt (including its expiry), `_headers`, `.nojekyll`,
  and site.webmanifest
- no em dashes in the site's own files, and no retired wording ("Get a Quote", "Focus
  Area")

It prints each problem as `file:line`, exits 1 on any error, and lists unused CSS
selectors as warnings (`--quiet` hides warnings). Run it before every commit. GitHub
Actions runs it on every push and pull request (`.github/workflows/check-site.yml`, with
read-only permissions and `actions/checkout` pinned to a commit SHA).

### Shared head and furniture

Two idempotent scripts (Python 3.9 or later, no packages) rewrite the copied parts of
every page in the repo they live in. Run the checks after either one.

- **`python3 tools/sync-heads.py`** rebuilds every `<head>` from one template. Each page
  keeps only its own `<title>` and meta description (`OVERRIDES` can replace them); the
  script writes the CSP, canonical and `og:url`, social tags, icons, preloads, boot.js, and
  the JSON-LD, deriving the BreadcrumbList from the page's visible breadcrumb. 404.html
  gets a reduced, root-absolute, noindex head.
- **`python3 tools/sync-furniture.py`** rewrites the header, footer, and breadcrumbs from
  the `HEADER` and `FOOTER` templates in the script. It marks each page's own nav link
  with `aria-current`, rebuilds each breadcrumb as an ordered list (with the Services or
  Autonomous Platforms level from `SECTION`), and makes every local URL in 404.html
  root-absolute.

To add a page, copy contact.html, change its `<title>`, description, breadcrumb label, and
`<main>`, and add it to `sitemap.xml` (and to `HEADER`, `FOOTER`, and `SECTION` if it
belongs in them). Then run sync-furniture, sync-heads, and the checks.
