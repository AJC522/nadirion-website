# Nadirion — Company Website

Single-page marketing site for Nadirion, a cybersecurity firm offering the Cyber
Operations Toolkit alongside consulting, threat intelligence, and digital forensics
services.

## Design

- **Palette:** black, white, and silver only, with metallic gradients for accent text.
- **Theme:** astronomy and space — an animated starfield, an orbital diagram in the
  hero, a constellation illustration in the About section, and zenith/nadir markers
  that tie back to the company name.
- **Typography:** Space Grotesk for display, Inter for body copy, JetBrains Mono for
  labels and the ops console.

## Structure

```
index.html            markup for all sections
assets/css/styles.css design tokens and all styling
assets/js/main.js     nav, scroll reveal, starfield canvas, contact form
assets/img/           logo mark and favicon (SVG)
```

Sections run in order: hero, Cyber Operations Toolkit (flagship), services, about,
who we serve, and contact.

## Development

The site is static with no build step. Open `index.html` in a browser, or serve the
directory:

```
python3 -m http.server 8000
```

Fonts load from Google Fonts; the page falls back to system fonts when offline.

## Notes

- The contact form is front-end only. It validates input and shows a confirmation
  message, but does not submit anywhere — wire it to a backend or form service
  before launch.
- Animations (starfield, orbits, scroll reveals) are disabled automatically for
  visitors who set `prefers-reduced-motion`.
