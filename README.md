# Nadirion Company Website

Static marketing site for Nadirion, built around selling **Nadirion Desktop** (formerly the
Threat Operations Toolset) and its add-on modules. Every license starts with Nadirion
Desktop; each of the 33 modules is a separate add-on. Buyers can purchase direct or through
a certified reseller, and companies and individuals can apply to become one. Nadirion's
consulting, training, and autonomous-platform work keeps its own pages under "Services".

## Design

- **Palette:** black, white, and silver only, with metallic gradients for accent text.
- **Theme:** astronomy and space, including an animated starfield, a constellation
  illustration in the About section, and zenith/nadir markers that tie back to the company
  name.
- **Typography:** Space Grotesk for display, Inter for body copy, JetBrains Mono for
  labels and the console mockups.

## Structure

```
index.html                  home: product hero, how licensing works, module categories,
                            console, principles, resellers teaser, about
desktop.html                Nadirion Desktop: what every license includes, console, install
modules.html                module catalog: search, category filter, "add to license"
pricing.html                licensing model, ways to buy, buying steps, FAQ
resellers.html              certified reseller program, tracks, application form, verify
contact.html                quotes (with the license being built), demos, everything else
cyber.html                  service: Cyber Operations
software-development.html   service: Software Development
digital-forensics.html      service: Digital Forensics
it-consulting.html          service: IT Consulting
training.html               service: Business, IT & Sales Training
satellites.html             platform: Satellites
maritime-drones.html        platform: Maritime Drones
aerial-drones.html          platform: Aerial Drones
assets/css/styles.css       design tokens and all styling
assets/js/catalog.js        module ids, names, categories, and prices (the commercial record)
assets/js/main.js           nav, menus, reveal, starfield, catalog, license tray, forms
assets/img/                 logo mark and favicon (SVG)
```

Every page lives at the repo root, so all internal links are flat filenames.

### Page furniture

The header and footer are duplicated in each file, since the site has no build step.
Changing either means changing it in all fourteen pages. The header links the four product
pages, a Services dropdown (grouped into "Digital & Security Services" and "Autonomous
Platforms"), and a Get a Quote button; the current page is marked with
`aria-current="page"`. The footer repeats the product, reseller, and service links.

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
home, desktop, and pricing pages.

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
