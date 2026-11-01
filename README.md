# Nadirion Company Website

Static marketing site for Nadirion, built around selling **Nadirion Desktop** (formerly the
Threat Operations Toolset) and its add-on modules. Every license starts with Nadirion
Desktop; each of the 33 modules is a separate add-on. Buyers can purchase direct or through
a certified reseller, and companies and individuals can apply to become one. Nadirion
Desktop is the only thing the site sells; new products and services still in research or
development are described on the "In Development" page until they go on sale.

## Design

- **Palette:** black, white, and silver only, with metallic gradients for accent text.
- **Theme:** astronomy and space, including an animated starfield, a constellation
  illustration in the About section, and zenith/nadir markers that tie back to the company
  name.
- **Typography:** Space Grotesk for display, Inter for body copy, JetBrains Mono for
  labels and the console mockups.
- **Motion:** scroll-driven and kept in `main.js` and the "Motion and finish" section at
  the end of `styles.css`, where each area (inner pages, heroes, type, scroll
  choreography, frame, surfaces, catalog and commerce) has its own block. A comet-style
  reading-progress line runs along the header.
  - **Heroes:** every hero has a starfield with depth and parallax, and its stars stretch
    into streaks when the page is scrolled fast. The home hero adds:
    - a headline that rises line by line, after which a glint lights its metal line
    - a sunrise drifting along the planet's rim
    - a product window that tilts toward the pointer, searches by itself, and catches one
      sweep of light, with a floating license panel over its corner

    Inner-page glyphs draw themselves stroke by stroke and turn away as the hero scrolls
    off.
  - **Section content:** headings rise word by word, ledes are uncovered line by line,
    and mono labels decrypt into place. Light sections open out from a rounded inset
    panel. Numbered sections carry a faint outlined numeral, and dark sections a soft
    horizon of light at their top edge.
  - **Page features:**
    - Stat figures count up, then catch a glint.
    - Consoles type themselves behind a glass finish.
    - The constellation draws in and turns.
    - The module ticker speeds up, reverses, and leans with the scroll.
    - On pricing, the license plans glide together.
    - On In Development, the stages fill in order.
    - On Resellers, the reseller requirements tick on and the verify band draws a seal.
    - The contact hero transmits under a radar sweep.
  - **Catalog:** a sliding category pill, filtering that animates cards into place, a
    floating filter bar, and an add button that twists into a check as the license tray
    springs up.
  - **Frame:** the header highlight glides between links. Wide screens get a section
    gauge in the margin. The mobile menu draws down like a blind, pages cross-fade where
    the browser supports view transitions, and the footer ends on a giant wordmark
    standing on a horizon.

  Cards lean toward the pointer, and primary buttons pull toward it. Everything that
  moves stops for visitors who prefer reduced motion, and the pages read fully without
  the script.

  When the window changes width (a phone turns, a window snaps to half the screen), the
  page keeps the reader on what they were reading, and a glide that was under way to a
  link's destination still arrives there. A reload, or a step back to a page, returns
  straight to where the reader was instead of gliding down from the top. In a short window,
  such as a phone on its side, the catalog's filter bar stays in the page instead of
  sticking, and the license tray keeps to one row where it fits.

## Structure

```
index.html                  home: product hero, how licensing works, module categories,
                            console, principles, resellers teaser, about
desktop.html                Nadirion Desktop: what every license includes, console, install
modules.html                module catalog: search, category filter, "add to license"
pricing.html                licensing model, ways to buy, buying steps, FAQ
resellers.html              certified reseller program, tracks, application form, verify
in-development.html         new products and services in research and development
contact.html                quotes (with the license being built), demos, everything else
assets/css/styles.css       design tokens and all styling
assets/js/catalog.js        module ids, names, categories, and prices (the commercial record)
assets/js/main.js           nav, menus, scroll effects, reveal, starfields, pointer
                            effects, catalog, license tray, forms
assets/img/                 logo mark, favicon, and the film-grain tile (SVG)
tools/sync-furniture.py     rewrites the shared header, footer, and breadcrumbs on every page
tools/sync-heads.py         rebuilds every page's <head> from one template
```

Every page lives at the repo root, so all internal links are flat filenames.

### Page furniture

The header and footer are duplicated in each file, since the site has no build step. Edit
`HEADER` or `FOOTER` in `tools/sync-furniture.py` and run it to update all seven pages,
then run `tools/sync-heads.py` if a page's title or description changed. The header links
the four product pages, In Development, and a Request a Quote button; the current page is
marked with `aria-current="page"`. The footer is deliberately short: one row with the logo
and the same six destinations, and one row with the copyright and contact email.

## Selling: modules, prices, and quotes

### Module catalog

`modules.html` lists every module as an `<article class="mod-card">` grouped by category.
The module set mirrors `launcher/modules.py` in the Threat-Operations-Toolset repo: the 33
modules in shipping sections are sold as add-ons, and the two in its Development Preview
section (Intelligence Map, Investigation Queue) are shown as "in development" without an
add button. Each card's `data-aliases` holds the launcher's search aliases, so the site's
search finds the same modules the app's does ("autoruns", "evtx", "netstat").

When a module is added, removed, or renamed, update three places together: its card in
`modules.html`, its entry in `assets/js/catalog.js` (same id), and the counts quoted on the
home, desktop, and pricing pages. The ticker of module names on the home page is built from
`catalog.js`, so it follows on its own.

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
contact page lists them in the quote box and sends them with the request.

### Forms

The contact and reseller forms (`form.js-send`) send in one of two ways:

- **With `data-endpoint` set** on the `<form>` to any form-handling URL that accepts a POST
  and answers 2xx, the form posts there and confirms only after a successful response.
- **Without it** (the default), submitting opens the visitor's email app with a message to
  `contact@nadirion.us` (override with `data-to`) already written, and says so. Nothing is
  reported as sent when it was not.

Rows marked `data-show-when="field:value|value"` appear only while that field has one of
those values; while hidden they are disabled, so their required fields don't block sending.
A message box reached with the keyboard scrolls fully into view, focus mark included.
