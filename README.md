# Nadirion Company Website

Static marketing site for Nadirion. The home page introduces the company and links out
to eight business sectors; each sector has its own page so a visitor can go straight to
the work they came for instead of scrolling past everything else.

## Design

- **Palette:** black, white, and silver only, with metallic gradients for accent text.
- **Theme:** astronomy and space, including an animated starfield, an orbital diagram in
  the hero, a constellation illustration in the About section, and zenith/nadir markers
  that tie back to the company name.
- **Typography:** Space Grotesk for display, Inter for body copy, JetBrains Mono for
  labels and the ops console.

## Structure

```
index.html                  home: hero, sector links, flagship teaser, about, who we serve
cyber.html                  focus area: Cyber Operations
software-development.html   focus area: Software Development
digital-forensics.html      focus area: Digital Forensics
it-consulting.html          focus area: IT Consulting
training.html               focus area: Business, IT & Sales Training
satellites.html             focus area: Satellites
maritime-drones.html        focus area: Maritime Drones
aerial-drones.html          focus area: Aerial Drones
contact.html                contact details and the enquiry form
assets/css/styles.css       design tokens and all styling
assets/js/main.js           nav, capabilities menu, scroll reveal, starfield, contact form
assets/img/                 logo mark and favicon (SVG)
```

Every page lives at the repo root, so all internal links are flat filenames.

### Page furniture

The header and footer are duplicated in each file, since the site has no build step.
Changing either means changing it in all ten pages. The header carries a Capabilities
dropdown listing every focus area, grouped into "Digital & Security Services" and
"Autonomous Platforms"; the current page is marked with `aria-current="page"` on its
entry. The footer repeats the same two groups plus company links.

### Focus-area pages

Each one follows the same shape: page hero with breadcrumb, a four-item stat strip,
two to four content sections, a related-focus-areas block, and a closing CTA band.
Section eyebrow numbers restart at 01 on every page, so they only need renumbering
within the page they belong to.

The contact buttons on a focus-area page link to `contact.html?interest=<slug>`, and
`main.js` preselects the matching option in the form's interest dropdown. The slugs are
the `value` attributes in the `#interest` select on `contact.html`; adding a focus area
means adding an option there too.

## Development

The site is static with no build step. Open `index.html` in a browser, or serve the
directory:

```
python3 -m http.server 8000
```

Fonts load from Google Fonts; the page falls back to system fonts when offline.

## Notes

- The contact form is front-end only. It validates input and shows a confirmation
  message, but does not submit anywhere; wire it to a backend or form service
  before launch.
- Platform specifications on the satellite, maritime, and aerial pages are labelled as
  design targets for articles in development, not delivered performance. Keep that
  framing until the hardware justifies otherwise.
- Animations (starfield, orbits, scroll reveals) are disabled automatically for
  visitors who set `prefers-reduced-motion`.
- The header and its dropdown both use `backdrop-filter`. Nesting a second one inside
  the header renders as an empty backdrop in Chromium, so the dropdown and the mobile
  nav panel use opaque backgrounds instead.
