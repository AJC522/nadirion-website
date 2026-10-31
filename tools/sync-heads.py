#!/usr/bin/env python3
"""Rebuild every page's <head> from one shared template.

Usage: python3 tools/sync-heads.py [repo-root]

Per-page fields (title, description) are read from the page itself unless
overridden in OVERRIDES; breadcrumb JSON-LD is derived from the visible
.crumb trail so the two never disagree. 404.html gets a reduced, root-absolute
head with noindex. Run tools/check-site.mjs afterwards.
"""
import html
import json
import re
import sys
from pathlib import Path

REPO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
ORIGIN = "https://nadirion.us/"

CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; "
    "font-src 'self'; connect-src 'self'; manifest-src 'self'; form-action 'self'; "
    "base-uri 'self'; object-src 'none'; require-trusted-types-for 'script'; "
    "trusted-types 'none'; upgrade-insecure-requests"
)

# Optional per-page overrides: filename -> {"title": ..., "description": ..., "og_title": ...}.
# Normally empty: each page's own <title> and meta description are the source of truth.
OVERRIDES = {}

ORG = {
    "@type": "Organization",
    "@id": ORIGIN + "#organization",
    "name": "Nadirion",
    "url": ORIGIN,
    "logo": ORIGIN + "assets/img/icon-512.png",
    "email": "contact@nadirion.us",
}


def page_url(name):
    return ORIGIN if name == "index.html" else ORIGIN + name


def crumbs(body, name):
    m = re.search(r'<nav class="crumb"[^>]*>(.*?)</nav>', body, re.S)
    if not m:
        return None
    items = []
    # Linked items are the ancestors and aria-current marks this page. Unlinked
    # grouping labels (Services, Autonomous Platforms) have no URL, so they are skipped.
    for li in re.findall(r"<li>(.*?)</li>", m.group(1), re.S):
        link = re.search(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', li)
        current = re.search(r'<span aria-current="page">([^<]+)</span>', li)
        if link:
            href = link.group(1).split("#")[0]
            url = ORIGIN if href in ("./", "index.html", "/", "") else ORIGIN + href.lstrip("/")
            items.append({"name": html.unescape(link.group(2)).strip(), "url": url})
        elif current:
            items.append({"name": html.unescape(current.group(1)).strip(), "url": page_url(name)})
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": it["name"], "item": it["url"]}
            for i, it in enumerate(items)
        ],
    }


def structured_data(name, body, title, description):
    graph = [ORG]
    if name == "index.html":
        graph.append({
            "@type": "WebSite",
            "@id": ORIGIN + "#website",
            "name": "Nadirion",
            "url": ORIGIN,
            "publisher": {"@id": ORIGIN + "#organization"},
        })
    if name == "desktop.html":
        graph.append({
            "@type": "SoftwareApplication",
            "name": "Nadirion Desktop",
            "applicationCategory": "SecurityApplication",
            "alternateName": "Threat Operations Toolset",
            "operatingSystem": "Windows, macOS, Linux",
            "description": description,
            "url": page_url(name),
            "publisher": {"@id": ORIGIN + "#organization"},
        })
    bc = crumbs(body, name)
    if bc:
        graph.append(bc)
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, indent=2, ensure_ascii=False)


def attr(text):
    return html.escape(html.unescape(text), quote=True)


def build_head(name, title, description, ld):
    if name == "404.html":
        return build_404_head(title, description)
    url = page_url(name)
    og_title = OVERRIDES.get(name, {}).get("og_title", title)
    ld_indented = "\n".join("    " + line for line in ld.splitlines())
    return f"""<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="{CSP}" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>{attr(title)}</title>
  <meta name="description" content="{attr(description)}" />
  <link rel="canonical" href="{url}" />
  <meta name="theme-color" content="#050506" />
  <meta name="color-scheme" content="dark" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Nadirion" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content="{attr(og_title)}" />
  <meta property="og:description" content="{attr(description)}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{ORIGIN}assets/img/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Nadirion: one desktop for the whole operation." />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="icon" href="favicon.ico" sizes="32x32" />
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png" />
  <link rel="manifest" href="site.webmanifest" />

  <link rel="preload" href="assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin />
  <script src="assets/js/boot.js"></script>
  <link rel="stylesheet" href="assets/css/styles.css" />

  <script type="application/ld+json">
{ld_indented}
  </script>
</head>"""


def build_404_head(title, description):
    """Served at whatever path was requested, so every URL is root-absolute.
    No canonical, social tags or structured data: this page should not be indexed."""
    return f"""<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="{CSP}" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>{attr(title)}</title>
  <meta name="description" content="{attr(description)}" />
  <meta name="robots" content="noindex" />
  <meta name="theme-color" content="#050506" />
  <meta name="color-scheme" content="dark" />

  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png" />

  <link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin />
  <script src="/assets/js/boot.js"></script>
  <link rel="stylesheet" href="/assets/css/styles.css" />
</head>"""


def main():
    for path in sorted(REPO.glob("*.html")):
        name = path.name
        src = path.read_text()
        head_m = re.search(r"<head>.*?</head>", src, re.S)
        if not head_m:
            print("skip (no head):", name)
            continue
        head = head_m.group(0)
        title = html.unescape(re.search(r"<title>(.*?)</title>", head, re.S).group(1).strip())
        desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', head).group(1))
        ov = OVERRIDES.get(name, {})
        title = ov.get("title", title)
        desc = ov.get("description", desc)
        body = src[head_m.end():]
        ld = structured_data(name, body, title, desc)
        new = build_head(name, title, desc, ld)
        out = src[: head_m.start()] + new + body
        out = re.sub(r"^<!doctype html>", "<!DOCTYPE html>", out, flags=re.I)
        path.write_text(out)
        print("rewrote", name, "|", title, "|", len(desc))


if __name__ == "__main__":
    main()
