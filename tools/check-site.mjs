#!/usr/bin/env node
// Invariant checks for the Nadirion static site. No dependencies: node: built-ins
// only, Node 18 or later.
//
//   node tools/check-site.mjs [site-root] [--quiet]
//
// Prints "ERROR file:line  message" for every broken rule and "warn  file:line  message"
// for advisories (--quiet hides warnings), then a summary. Exits 1 on any error;
// warnings never fail the run. CI runs it on every push and pull request
// (.github/workflows/check-site.yml). The site has no build step, so this script is
// what keeps the head, header and footer that every page carries a copy of, and every
// catalog count the copy quotes, honest.
//
// What it checks, in order:
//   1. markup basics: doctype, lang, one <h1> and <main>, heading levels, unique ids,
//      id references, <button type>, labelled <nav>s, alt text, aria-hidden controls
//   2. links: every local href/src and #fragment resolves, ?interest= and ?track=
//      values exist, CSS url() targets exist; 404.html uses root-absolute URLs only
//   3. CSP compatibility: no inline script (JSON-LD aside), <style>, style=, on*=,
//      javascript: or data: URLs, external resources, or HTML-string sinks in JS
//   4. head: every element in the order tools/sync-heads.py writes (404.html has its
//      own shorter head); one CSP on every page equal to _headers minus
//      frame-ancestors; canonical = og:url = sitemap <loc>; 404 is noindex; titles and
//      descriptions unique; JSON-LD parses; fonts: every file in assets/fonts is used
//      by an @font-face, and the font preloads are the same on every page and each
//      names an @font-face file
//   5. shared furniture: header and footer identical on every page apart from
//      aria-current; breadcrumbs match the nav grouping and the BreadcrumbList
//   6. catalog: assets/js/catalog.js and modules.html agree, and every quoted count
//      (modules, add-ons, products, categories, per-category) matches the catalog
//   7. forms and privacy: method="post", data-show-when targets, data-endpoint origin
//      in connect-src; privacy.html names every browser-storage key the scripts use
//   8. crawl and security files: sitemap.xml, robots.txt, .well-known/security.txt,
//      _headers, .nojekyll, site.webmanifest
//   9. copy: no em dashes anywhere, no retired wording in any capitalization
//  10. (warn) CSS selectors whose classes no page or script uses
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const ROOT = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const QUIET = args.includes("--quiet");

const ORIGIN = "https://nadirion.us";
const NOT_FOUND = "404.html";
const CSS_FILE = "assets/css/styles.css";
const BOOT_JS = "assets/js/boot.js";
// Services-menu column (by its heading id) -> the plain-text middle crumb of its pages.
const CRUMB_SECTION = { navHeadServices: "Services", navHeadPlatforms: "Autonomous Platforms" };
// Wording the site has retired (matched in any capitalization), and what replaced it.
const RETIRED = [
  [/Get a Quote/gi, 'the quote button is "Request a Quote"'],
  [/Focus Areas?\b/gi, '"Focus Area" is retired: heroes say "Digital & Security Services" or "Autonomous Platforms"'],
  [/Business, IT (?:&amp;|&) Sales Training/gi, 'the page is "Training" (its tracks include cyber)'],
];
// Third-party license texts are kept verbatim, so the copy rules skip them.
const VERBATIM = /^assets\/fonts\/OFL-[\w-]+\.txt$/;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const errors = [];
const warnings = [];
const err = (file, line, msg) => errors.push({ file, line, msg });
const warn = (file, line, msg) => warnings.push({ file, line, msg });

const abs = (rel) => path.join(ROOT, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const isFile = (rel) => exists(rel) && fs.statSync(abs(rel)).isFile();
const read = (rel) => fs.readFileSync(abs(rel), "utf8");
const blank = (s) => s.replace(/[^\n]/g, " ");
const splitOnce = (s, ch) => {
  const i = s.indexOf(ch);
  return i === -1 ? [s, undefined] : [s.slice(0, i), s.slice(i + 1)];
};
const canonicalFor = (file) => (file === "index.html" ? `${ORIGIN}/` : `${ORIGIN}/${file}`);

function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
  return (idx) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", middot: "\u00b7", rarr: "\u2192",
  larr: "\u2190", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201c", rdquo: "\u201d", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", times: "\u00d7", bull: "\u2022",
};
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] !== "#" ? NAMED[e] ?? m : String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)));
// Visible text of an HTML fragment, with whitespace collapsed and U+2011 read as "-".
const text = (html) => decode(html.replace(/<[^>]*>/g, " ")).replace(/[\s\u00a0]+/g, " ").replace(/\u2011/g, "-").trim();
const squash = (html) => html.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
// JavaScript with its comments blanked (offsets kept); strings are left alone.
const jsCode = (src) => src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:"'\\])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));

// Resolve a URL written in `fromFile` to a site file. Returns null for other schemes
// and other origins; { file, frag, query, missing } otherwise.
function resolveLocal(fromFile, url) {
  if (url.startsWith(ORIGIN + "/")) url = url.slice(ORIGIN.length);
  else if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return null;
  const [beforeHash, frag] = splitOnce(url, "#");
  const [p, query] = splitOnce(beforeHash, "?");
  let file = fromFile;
  if (p !== "") {
    let rel;
    try { rel = decodeURIComponent(p); } catch { rel = p; }
    rel = rel.startsWith("/") ? rel.slice(1) : path.posix.join(path.posix.dirname(fromFile), rel);
    file = path.posix.normalize(rel || ".");
    if (file === "." || file.endsWith("/") || (exists(file) && fs.statSync(abs(file)).isDirectory())) file = path.posix.join(file, "index.html");
  }
  return { file, frag, query: query || "", missing: file.startsWith("..") || !isFile(file) };
}

// ---------------------------------------------------------------------------
// documents: a small tokenizer, enough for hand-written, valid markup
// ---------------------------------------------------------------------------
const TAG_RE = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'=<>`/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parse(file) {
  const src = read(file);
  const masked = src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, name, body, close) => open + blank(body) + close);
  const lineAt = lineIndex(src);
  const tags = [];
  for (const m of masked.matchAll(TAG_RE)) {
    const attrs = {};
    for (const a of (m[2] || "").matchAll(ATTR_RE)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    tags.push({ name: m[1].toLowerCase(), attrs, index: m.index, end: m.index + m[0].length, line: lineAt(m.index), raw: m[0] });
  }
  return { file, src, masked, tags, lineAt };
}

const hasClass = (t, cls) => (t.attrs.class || "").split(/\s+/).includes(cls);
const find = (doc, name, cls) => doc.tags.filter((t) => (!name || t.name === name) && (!cls || hasClass(t, cls)));

// The full element that starts at tag `t` (matching nested elements of the same name).
function outer(doc, t) {
  const re = new RegExp(`<(/?)${t.name}\\b[^>]*>`, "gi");
  re.lastIndex = t.index;
  let depth = 0, m;
  while ((m = re.exec(doc.masked))) {
    if (m[1]) depth--;
    else if (!m[0].endsWith("/>")) depth++;
    if (depth === 0) {
      const end = m.index + m[0].length;
      return { start: t.index, end, html: doc.src.slice(t.index, end), tags: doc.tags.filter((x) => x.index >= t.index && x.index < end) };
    }
  }
  return { start: t.index, end: doc.src.length, html: doc.src.slice(t.index), tags: doc.tags.filter((x) => x.index >= t.index) };
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const docs = Object.fromEntries(pages.map((f) => [f, parse(f)]));
const idSets = Object.fromEntries(pages.map((f) => [f, new Set(docs[f].tags.filter((t) => t.attrs.id).map((t) => t.attrs.id))]));
const css = exists(CSS_FILE) ? read(CSS_FILE) : "";
const jsFiles = exists("assets/js") ? fs.readdirSync(abs("assets/js")).filter((f) => f.endsWith(".js")).map((f) => `assets/js/${f}`) : [];

// ---------------------------------------------------------------------------
// 1. markup basics
// ---------------------------------------------------------------------------
for (const doc of Object.values(docs)) {
  const f = doc.file;
  if (!/^<!DOCTYPE html>\s*<html lang="en">/.test(doc.src)) err(f, 1, 'page must start with <!DOCTYPE html> and <html lang="en">');
  const seen = new Map();
  for (const t of doc.tags) if (t.attrs.id !== undefined) {
    if (seen.has(t.attrs.id)) err(f, t.line, `duplicate id "${t.attrs.id}" (first at line ${seen.get(t.attrs.id)})`);
    else seen.set(t.attrs.id, t.line);
  }
  for (const t of doc.tags) {
    for (const a of ["aria-controls", "aria-labelledby", "aria-describedby", "for", "list", "form"]) {
      if (t.attrs[a] === undefined || (a === "for" && t.name !== "label" && t.name !== "output") || (a === "form" && t.name === "form")) continue;
      for (const id of t.attrs[a].split(/\s+/).filter(Boolean)) if (!seen.has(id)) err(f, t.line, `${a}="${id}" points at no element`);
    }
    if (t.name === "button" && !t.attrs.type) err(f, t.line, "<button> needs a type");
    if (t.name === "img") {
      if (t.attrs.alt === undefined) err(f, t.line, "<img> needs an alt attribute (alt=\"\" when decorative)");
      if (!t.attrs.width || !t.attrs.height) warn(f, t.line, "<img> without width and height can shift the layout while it loads");
    }
    if (t.attrs["aria-hidden"] === "true" && (t.name === "button" || (t.name === "a" && t.attrs.href !== undefined) || ["input", "select", "textarea"].includes(t.name)))
      err(f, t.line, `aria-hidden="true" on a focusable <${t.name}> hides a control from assistive technology`);
    if (t.name === "a" && t.attrs.target === "_blank" && !/\bnoopener\b/.test(t.attrs.rel || "")) err(f, t.line, 'target="_blank" needs rel="noopener"');
  }
  const navs = find(doc, "nav");
  if (navs.length > 1) for (const n of navs) if (!n.attrs["aria-label"] && !n.attrs["aria-labelledby"]) err(f, n.line, "<nav> needs an aria-label when the page has more than one");
  if (find(doc, "h1").length !== 1) err(f, 1, `page must have exactly one <h1> (found ${find(doc, "h1").length})`);
  const mains = find(doc, "main");
  if (mains.length !== 1 || mains[0].attrs.id !== "main") err(f, mains[0]?.line || 1, 'page needs exactly one <main id="main"> (the skip link targets it)');
  // Heading levels may go up any amount but down only one step at a time.
  let prev = 0;
  for (const t of doc.tags) {
    const m = /^h([1-6])$/.exec(t.name);
    if (!m) continue;
    const level = +m[1];
    if (prev && level > prev + 1) err(f, t.line, `<h${level}> follows <h${prev}>: heading levels must not skip`);
    prev = level;
  }
}

// ---------------------------------------------------------------------------
// 2. links, fragments, query values, CSS url()
// ---------------------------------------------------------------------------
const optionValues = (doc, sel) => new Set(doc ? doc.tags.filter(sel).map((t) => t.attrs.value) : []);
const QUERY_VALUES = {
  "contact.html": { interest: optionValues(docs["contact.html"], (t) => t.name === "option") },
  "resellers.html": { track: optionValues(docs["resellers.html"], (t) => t.name === "input" && t.attrs.name === "track") },
};
const URL_ATTRS = ["href", "src", "action", "poster"];
const relative404 = [];
for (const doc of Object.values(docs)) {
  const f = doc.file;
  for (const t of doc.tags) for (const attr of URL_ATTRS) {
    const v = t.attrs[attr];
    if (v === undefined || (attr === "action" && t.name !== "form")) continue;
    if (/^\s*javascript:/i.test(v)) { err(f, t.line, `${attr}="${v}": javascript: URLs are blocked by the CSP`); continue; }
    if (/^data:/i.test(v)) { err(f, t.line, `${attr}="data:...": img-src and the other CSP directives allow only 'self'`); continue; }
    if (/^(mailto:|tel:)/i.test(v)) continue;
    if (/^(https?:)?\/\//i.test(v) && !v.startsWith(ORIGIN + "/")) {
      if (t.name !== "a") err(f, t.line, `external resource ${v}: the CSP allows only 'self'`);
      continue;
    }
    const r = resolveLocal(f, v);
    if (!r) { err(f, t.line, `${attr}="${v}" uses a scheme the site does not use`); continue; }
    if (f === NOT_FOUND && !/^(\/|#|https?:)/.test(v)) relative404.push(t);
    if (f !== NOT_FOUND && v.startsWith("/")) err(f, t.line, `${attr}="${v}": use a relative URL (only 404.html is root-absolute)`);
    if (/(^|\/)index\.html(?=$|[?#])/.test(v)) err(f, t.line, `${attr}="${v}": link to the home page as "./" (its canonical URL), not index.html`);
    if (r.missing) { err(f, t.line, `${attr}="${v}" points at a missing file`); continue; }
    if (r.frag && docs[r.file] && !idSets[r.file].has(r.frag)) err(f, t.line, `${attr}="${v}" points at a missing #${r.frag}`);
    const allowed = QUERY_VALUES[r.file];
    if (allowed) for (const [key, value] of new URLSearchParams(r.query)) {
      if (allowed[key] && !allowed[key].has(value)) err(f, t.line, `${key}=${value} is not a value on ${r.file}`);
    }
  }
}
if (relative404.length) {
  const lines = relative404.map((t) => t.line);
  err(NOT_FOUND, lines[0], `${relative404.length} local URL(s) are relative (lines ${lines.slice(0, 6).join(", ")}${lines.length > 6 ? ", ..." : ""}): 404.html is served at any path, so they must be root-absolute (run tools/sync-furniture.py and tools/sync-heads.py)`);
}
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, blank); // comments blanked, offsets kept
if (css) {
  const lineAt = lineIndex(css);
  for (const m of cssCode.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1].trim();
    if (u.startsWith("#")) continue;
    if (/^data:/i.test(u)) err(CSS_FILE, lineAt(m.index), "data: URL in CSS: img-src and font-src allow only 'self'; ship a file");
    else if (/^(https?:)?\/\//i.test(u)) err(CSS_FILE, lineAt(m.index), `external url(${u}): the CSP allows only 'self'`);
    else if (!isFile(path.posix.normalize(path.posix.join(path.posix.dirname(CSS_FILE), splitOnce(splitOnce(u, "#")[0], "?")[0]))))
      err(CSS_FILE, lineAt(m.index), `url(${u}) points at a missing file`);
  }
  for (const m of cssCode.matchAll(/@import\b/g)) err(CSS_FILE, lineAt(m.index), "@import chains a second blocking request; keep all CSS in this file");
}

// ---------------------------------------------------------------------------
// 3. CSP compatibility of markup and scripts
// ---------------------------------------------------------------------------
for (const doc of Object.values(docs)) {
  const f = doc.file;
  for (const t of doc.tags) {
    if (t.name === "script" && t.attrs.src === undefined && t.attrs.type !== "application/ld+json") err(f, t.line, "inline <script> is blocked by script-src 'self'; put it in assets/js/");
    if (t.name === "style") err(f, t.line, "<style> is blocked by style-src 'self'; put it in styles.css");
    if ("style" in t.attrs) err(f, t.line, "style attribute is blocked by style-src 'self'; use a class");
    for (const a of Object.keys(t.attrs)) if (/^on[a-z]+$/.test(a)) err(f, t.line, `${a}= handler is blocked by the CSP; bind it in main.js`);
    if (t.name === "iframe" && "srcdoc" in t.attrs) err(f, t.line, "srcdoc is blocked by Trusted Types");
  }
}
// Trusted Types (require-trusted-types-for 'script'; trusted-types 'none') makes every
// HTML-string sink throw, and script-src without 'unsafe-eval' blocks string evaluation.
const JS_SINKS = [
  [/\.(innerHTML|outerHTML)\b/, "assigning HTML strings is blocked by Trusted Types; build nodes with createElement and textContent"],
  [/\binsertAdjacentHTML\b/, "insertAdjacentHTML is blocked by Trusted Types"],
  [/\bdocument\.write(ln)?\b/, "document.write is blocked by Trusted Types"],
  [/\.srcdoc\b/, "srcdoc is blocked by Trusted Types"],
  [/\b(createContextualFragment|parseFromString|setHTMLUnsafe)\b/, "HTML parsing from a string is blocked by Trusted Types"],
  [/\beval\s*\(|\bnew\s+Function\b/, "string evaluation is blocked by script-src 'self'"],
  [/\bset(Timeout|Interval)\s*\(\s*["'`]/, "a string passed to setTimeout/setInterval is blocked by script-src 'self'"],
  [/javascript:/i, "javascript: URLs are blocked by the CSP"],
];
for (const f of jsFiles) {
  const src = read(f);
  const code = jsCode(src);
  const lineAt = lineIndex(src);
  for (const [re, msg] of JS_SINKS) for (const m of code.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) err(f, lineAt(m.index), msg);
}

// ---------------------------------------------------------------------------
// 4. head
// ---------------------------------------------------------------------------
function parseCsp(value) {
  const map = new Map();
  for (const part of value.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) map.set(name.toLowerCase(), sources);
  }
  return map;
}
const cspString = (map) => [...map].map(([k, v]) => [k, ...v].join(" ")).join("; ");

// _headers: "path" lines followed by indented "Name: value" lines.
const headerRules = [];
if (exists("_headers")) {
  const lines = read("_headers").split("\n");
  let rule = null;
  lines.forEach((ln, i) => {
    if (!ln.trim() || ln.trim().startsWith("#")) return;
    if (!/^\s/.test(ln)) { rule = { pattern: ln.trim(), line: i + 1, headers: [] }; headerRules.push(rule); return; }
    const m = /^\s+([A-Za-z0-9-]+):\s*(.*)$/.exec(ln);
    if (!rule || !m) { err("_headers", i + 1, "expected an indented \"Name: value\" line under a path"); return; }
    rule.headers.push({ name: m[1].toLowerCase(), value: m[2].trim(), line: i + 1 });
  });
} else err("_headers", 1, "missing: Netlify and Cloudflare Pages read security and cache headers from it");
const rootRule = headerRules.find((r) => r.pattern === "/*");
const headerValue = (rule, name) => rule?.headers.find((h) => h.name === name);
const headerCspEntry = headerValue(rootRule, "content-security-policy");
const headerCsp = headerCspEntry ? parseCsp(headerCspEntry.value) : null;
if (exists("_headers") && !headerCsp) err("_headers", rootRule?.line || 1, "the /* rule must set Content-Security-Policy");
if (headerCsp && !headerCsp.has("frame-ancestors")) err("_headers", headerCspEntry.line, "the header CSP must add frame-ancestors (it only works as a header)");
const expectedMetaCsp = headerCsp ? new Map([...headerCsp].filter(([k]) => k !== "frame-ancestors")) : null;

const META_IGNORED = ["frame-ancestors", "report-uri", "report-to", "sandbox"];
const UNSAFE_SOURCES = /^('unsafe-inline'|'unsafe-eval'|'unsafe-hashes'|'wasm-unsafe-eval'|\*|https?:|data:|blob:|filesystem:)$/i;
function checkCspPolicy(file, line, map, where) {
  for (const [name, sources] of map) for (const s of sources)
    if (UNSAFE_SOURCES.test(s)) err(file, line, `${where} CSP allows ${s} in ${name}: keep every source list to 'self' or exact origins`);
  for (const d of ["default-src", "script-src", "style-src", "object-src", "base-uri", "form-action", "require-trusted-types-for", "trusted-types"])
    if (!map.has(d)) err(file, line, `${where} CSP is missing ${d}`);
  if (map.has("object-src") && map.get("object-src").join(" ") !== "'none'") err(file, line, `${where} CSP: object-src must be 'none'`);
  if (map.has("require-trusted-types-for") && map.get("require-trusted-types-for").join(" ") !== "'script'") err(file, line, `${where} CSP: require-trusted-types-for must be 'script'`);
}
if (headerCsp) checkCspPolicy("_headers", headerCspEntry.line, headerCsp, "header");

// Every <head>, element by element, in the order tools/sync-heads.py writes it
// (build_head, and build_404_head for 404.html). README "The head" documents the same
// seven steps, so change the template, this list and the README together.
const headOrder = (notFound) => [
  // 1. charset and viewport, then the CSP before everything it has to cover
  "<meta charset>", '<meta name="viewport">', '<meta http-equiv="content-security-policy">',
  // 2. referrer, title, description, canonical (on 404.html: robots noindex), theme
  '<meta name="referrer">', "<title>", '<meta name="description">', notFound ? '<meta name="robots">' : '<link rel="canonical">',
  '<meta name="theme-color">', '<meta name="color-scheme">',
  // 3. Open Graph and the Twitter card (not on 404.html)
  ...(notFound ? [] : [...["og:type", "og:site_name", "og:locale", "og:title", "og:description", "og:url", "og:image",
    "og:image:width", "og:image:height", "og:image:alt"].map((p) => `<meta property="${p}">`), '<meta name="twitter:card">']),
  // 4. icons and the manifest (404.html has no manifest)
  '<link rel="icon">', '<link rel="icon">', '<link rel="apple-touch-icon">', ...(notFound ? [] : ['<link rel="manifest">']),
  // 5. font preloads
  '<link rel="preload" as="font">', '<link rel="preload" as="font">',
  // 6. boot.js, then the stylesheet
  `<script src="${BOOT_JS}">`, '<link rel="stylesheet">',
  // 7. structured data (not on 404.html)
  ...(notFound ? [] : ['<script type="application/ld+json">']),
];
// Why some positions matter, added to the error for them.
const HEAD_WHY = {
  "<meta charset>": "the encoding must be declared before any text",
  '<meta http-equiv="content-security-policy">': "a <meta> CSP covers only what comes after it",
  [`<script src="${BOOT_JS}">`]: "boot.js must set html.js before the stylesheet applies, or html.js rules flash",
};
// One <head> element, named the way headOrder names it.
function headItem(f, t) {
  const a = t.attrs;
  if (t.name === "meta") {
    if (a.charset !== undefined) return "<meta charset>";
    if (a["http-equiv"] !== undefined) return `<meta http-equiv="${a["http-equiv"].toLowerCase()}">`;
    if (a.property !== undefined) return `<meta property="${a.property}">`;
    if (a.name !== undefined) return `<meta name="${a.name}">`;
  }
  if (t.name === "link") return `<link rel="${a.rel || ""}"${a.as !== undefined ? ` as="${a.as}"` : ""}>`;
  if (t.name === "script") return a.src !== undefined ? `<script src="${resolveLocal(f, a.src)?.file ?? a.src}">` : `<script type="${a.type || ""}">`;
  return `<${t.name}>`;
}

let firstMetaCsp = null;
let firstReferrer = null;
let firstPreloads = null;
const titles = new Map();
const descs = new Map();
const canonicals = new Map(); // file -> canonical URL
const jsonLd = new Map(); // file -> { line, nodes }
const fontFaceSources = new Set([...cssCode.matchAll(/@font-face\s*{[^}]*}/g)].flatMap((m) => [...m[0].matchAll(/url\(\s*["']?([^"')]+)/g)].map((u) => path.posix.normalize(path.posix.join("assets/css", u[1])))));

// index.html goes first so it is the reference the other pages are compared with.
for (const doc of [docs["index.html"], ...Object.values(docs).filter((d) => d.file !== "index.html")].filter(Boolean)) {
  const f = doc.file;
  const headTag = find(doc, "head")[0];
  if (!headTag) { err(f, 1, "missing <head>"); continue; }
  const head = outer(doc, headTag);
  const kids = head.tags.slice(1);
  const meta = (pred) => kids.filter((t) => t.name === "meta" && pred(t.attrs));
  const link = (rel) => kids.filter((t) => t.name === "link" && (t.attrs.rel || "").split(/\s+/).includes(rel));
  const line = headTag.line;

  // The order also covers presence: a missing or extra element breaks it. Only the
  // first difference is reported, since everything after it is usually shifted by one.
  const order = headOrder(f === NOT_FOUND);
  const items = kids.map((t) => headItem(f, t));
  const first = order.findIndex((w, i) => items[i] !== w);
  const at = first !== -1 ? first : items.length > order.length ? order.length : -1;
  if (at !== -1) {
    const why = HEAD_WHY[order[at]] ? ` (${HEAD_WHY[order[at]]})` : "";
    const fix = 'run python3 tools/sync-heads.py; README "The head" gives the order';
    if (items[at] === undefined) err(f, kids[kids.length - 1]?.line || line, `<head> ends after ${at} element(s), where tools/sync-heads.py writes ${order[at]} next${why}: ${fix}`);
    else if (order[at] === undefined) err(f, kids[at].line, `<head> has ${items[at]} after its last templated element: ${fix}`);
    else err(f, kids[at].line, `<head> element ${at + 1} is ${items[at]}, where tools/sync-heads.py writes ${order[at]}${why}: ${fix}`);
  }
  const charset = meta((a) => a.charset !== undefined)[0];
  if (charset && !/^utf-8$/i.test(charset.attrs.charset)) err(f, charset.line, 'the charset must be <meta charset="utf-8">');
  const cspTags = meta((a) => (a["http-equiv"] || "").toLowerCase() === "content-security-policy");
  if (cspTags.length !== 1) err(f, line, `<head> needs exactly one CSP <meta> (found ${cspTags.length})`);
  else {
    const t = cspTags[0];
    const map = parseCsp(t.attrs.content || "");
    for (const d of META_IGNORED) if (map.has(d)) err(f, t.line, `${d} is ignored in a <meta> CSP (and logs a console error); it belongs in _headers only`);
    if (!firstMetaCsp) {
      firstMetaCsp = { file: f, value: cspString(map) };
      checkCspPolicy(f, t.line, map, "meta");
      if (expectedMetaCsp) {
        for (const [k, v] of expectedMetaCsp) if (!map.has(k)) err(f, t.line, `meta CSP lacks "${k}" that _headers sets`);
          else if (map.get(k).join(" ") !== v.join(" ")) err(f, t.line, `meta CSP ${k} "${map.get(k).join(" ")}" differs from _headers "${v.join(" ")}"`);
        for (const k of map.keys()) if (!expectedMetaCsp.has(k) && !META_IGNORED.includes(k)) err(f, t.line, `meta CSP sets "${k}" but _headers does not`);
      }
    } else if (cspString(map) !== firstMetaCsp.value) err(f, t.line, `CSP <meta> differs from ${firstMetaCsp.file}; every page must carry the same policy`);
  }

  const referrer = meta((a) => a.name === "referrer")[0]; // a missing one is an order error
  if (referrer && !firstReferrer) firstReferrer = { file: f, value: referrer.attrs.content };
  else if (referrer && referrer.attrs.content !== firstReferrer.value) err(f, referrer.line, `referrer policy differs from ${firstReferrer.file}`);

  const titleTag = kids.find((t) => t.name === "title");
  const title = titleTag ? text(outer(doc, titleTag).html) : "";
  if (!title) err(f, line, "missing <title>");
  else if (titles.has(title)) err(f, titleTag.line, `title duplicates ${titles.get(title)}`);
  else titles.set(title, f);
  const descTag = meta((a) => a.name === "description")[0];
  const desc = descTag?.attrs.content || "";
  if (!desc) err(f, line, "missing meta description");
  else {
    if (descs.has(desc)) err(f, descTag.line, `description duplicates ${descs.get(desc)}`);
    else descs.set(desc, f);
    if (desc.length > 160) warn(f, descTag.line, `description is ${desc.length} characters (results are cut near 155 to 160)`);
  }

  const canonTags = link("canonical");
  const ogUrl = meta((a) => a.property === "og:url")[0];
  const robots = meta((a) => a.name === "robots")[0];
  if (f === NOT_FOUND) {
    if (canonTags.length) err(f, canonTags[0].line, "404.html must not have a canonical link");
    if (ogUrl) err(f, ogUrl.line, "404.html must not have og:url");
    if (!robots || !/\bnoindex\b/.test(robots.attrs.content || "")) err(f, line, '404.html needs <meta name="robots" content="noindex">');
  } else {
    const want = canonicalFor(f);
    const canon = canonTags[0]?.attrs.href;
    if (canonTags.length !== 1 || canon !== want) err(f, canonTags[0]?.line || line, `canonical must be ${want} (found ${canon || "none"})`);
    if (!ogUrl || ogUrl.attrs.content !== canon) err(f, ogUrl?.line || line, `og:url must equal the canonical (found ${ogUrl?.attrs.content || "none"})`);
    if (canon) canonicals.set(f, canon);
    if (robots && /\bnoindex\b/.test(robots.attrs.content || "")) err(f, robots.line, "noindex on a page that is in the sitemap");
    const ogImage = meta((a) => a.property === "og:image")[0]?.attrs.content;
    if (ogImage) {
      const r = ogImage.startsWith(ORIGIN + "/") ? resolveLocal(f, ogImage) : null;
      if (!r || r.missing) err(f, line, `og:image must be an absolute ${ORIGIN}/ URL of a file in the site (found ${ogImage})`);
    }
  }

  // Font preloads: each names a file an @font-face uses (a missing file is reported
  // with the links), and every page preloads the same files as index.html.
  const preloads = link("preload").filter((t) => t.attrs.as === "font");
  for (const t of preloads) {
    if (!("crossorigin" in t.attrs)) err(f, t.line, "a font preload without crossorigin downloads the font twice");
    if (t.attrs.type !== "font/woff2") err(f, t.line, 'font preload needs type="font/woff2"');
    const r = t.attrs.href ? resolveLocal(f, t.attrs.href) : null;
    if (!t.attrs.href) err(f, t.line, "font preload needs an href");
    else if (r && !r.missing && !fontFaceSources.has(r.file)) err(f, t.line, `preloaded ${r.file} is not used by any @font-face in styles.css`);
  }
  const preloadFiles = preloads.map((t) => (t.attrs.href && resolveLocal(f, t.attrs.href)?.file) || "?").join(", ");
  if (!firstPreloads) firstPreloads = { file: f, value: preloadFiles };
  else if (preloadFiles !== firstPreloads.value) err(f, preloads[0]?.line || line, `font preloads (${preloadFiles || "none"}) differ from ${firstPreloads.file} (${firstPreloads.value || "none"})`);

  const ldTags = doc.tags.filter((t) => t.name === "script" && t.attrs.type === "application/ld+json");
  if (f === NOT_FOUND && ldTags.length) err(f, ldTags[0].line, "404.html must not carry structured data");
  if (f !== NOT_FOUND && ldTags.length !== 1) err(f, line, `expected one JSON-LD block (found ${ldTags.length})`);
  for (const t of ldTags) {
    const body = outer(doc, t).html.replace(/^<script[^>]*>/i, "").replace(/<\/script\s*>$/i, "");
    let data;
    try { data = JSON.parse(body); } catch (e) { err(f, t.line, `JSON-LD does not parse: ${e.message}`); continue; }
    const nodes = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    if (data["@context"] !== "https://schema.org") err(f, t.line, 'JSON-LD needs "@context": "https://schema.org"');
    if (f !== NOT_FOUND && !nodes.some((n) => n["@type"] === "Organization")) err(f, t.line, "JSON-LD has no Organization node");
    jsonLd.set(f, { line: t.line, nodes });
    // Never publish placeholder prices, ratings or reviews.
    const walk = (v, key) => {
      if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
      if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => {
        if (/^(offers|price|priceSpecification|aggregateRating|review)$/.test(k)) err(f, t.line, `JSON-LD "${k}": the site states no prices or ratings`);
        walk(x, k);
      });
      if (typeof v === "string" && v.startsWith(ORIGIN + "/") && key !== "@id") {
        const r = resolveLocal(f, v);
        if (!r || r.missing) err(f, t.line, `JSON-LD ${key} ${v} is not a file in the site`);
      }
    };
    walk(data, "");
  }
}

// Every font file is declared. (An @font-face pointing at a missing file is a CSS
// url() error in section 2.)
if (exists("assets/fonts")) for (const name of fs.readdirSync(abs("assets/fonts")).filter((n) => /\.woff2?$/.test(n)))
  if (!fontFaceSources.has(`assets/fonts/${name}`)) err(`assets/fonts/${name}`, 1, "no @font-face in styles.css uses this font file: declare it or delete it");

// ---------------------------------------------------------------------------
// 5. shared furniture: header, footer, breadcrumbs
// ---------------------------------------------------------------------------
// 404.html is root-absolute; map its URLs back to the relative form before comparing.
const unroot = (html) => html.replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (m, a, rest) => `${a}="${rest === "" || rest.startsWith("#") ? "./" + rest : rest}"`);
function furniture(doc, name, cls) {
  const t = find(doc, name, cls)[0];
  if (!t) return null;
  const o = outer(doc, t);
  return { ...o, line: t.line, norm: squash(doc.file === NOT_FOUND ? unroot(o.html) : o.html) };
}
function firstDifference(want, got) {
  const a = want.split("><"), b = got.split("><");
  const i = a.findIndex((x, k) => x !== b[k]);
  const k = i === -1 ? Math.min(a.length, b.length) : i;
  return `near <${(b[k] || "end").slice(0, 90)}> (expected <${(a[k] || "end").slice(0, 90)}>)`;
}
const refDoc = docs["index.html"];
const refHeader = refDoc && furniture(refDoc, "header", "site-header");
const refFooter = refDoc && furniture(refDoc, "footer", "site-footer");
const stripCurrent = (s) => s.replace(/ aria-current="page"/g, "");
const menuSection = new Map(); // file -> crumb section label, from the Services menu columns
const navLinkText = new Map(); // file -> its link text in the primary nav
if (!refHeader || !refFooter) err("index.html", 1, "index.html is the reference header and footer and must have both");
else {
  const navTag = find(refDoc, "nav", "primary-nav")[0];
  const nav = navTag && outer(refDoc, navTag);
  for (const col of find(refDoc, "div", "nav-menu-col")) {
    const section = CRUMB_SECTION[col.attrs["aria-labelledby"]];
    if (!section) { err("index.html", col.line, `menu column aria-labelledby="${col.attrs["aria-labelledby"]}" has no breadcrumb label in CRUMB_SECTION`); continue; }
    for (const m of outer(refDoc, col).html.matchAll(/<a href="([^"#?]+)"/g)) menuSection.set(m[1], section);
  }
  for (const m of (nav?.html || "").matchAll(/<a href="([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) navLinkText.set(m[1], text(m[2]));
}
for (const doc of Object.values(docs)) {
  const f = doc.file;
  if (!refHeader) break;
  const header = furniture(doc, "header", "site-header");
  const footer = furniture(doc, "footer", "site-footer");
  if (!header) err(f, 1, "missing <header class=\"site-header\">");
  else if (stripCurrent(header.norm) !== stripCurrent(refHeader.norm)) err(f, header.line, `header differs from index.html ${firstDifference(stripCurrent(refHeader.norm), stripCurrent(header.norm))}`);
  if (!footer) err(f, 1, "missing <footer class=\"site-footer\">");
  else if (footer.norm !== refFooter.norm) err(f, footer.line, `footer differs from index.html ${firstDifference(refFooter.norm, footer.norm)}`);
  if (!/^<a class="skip-link" href="\/?#main">/.test(doc.src.slice(find(doc, "body")[0]?.end || 0).trimStart())) err(f, 1, "the skip link must be the first element in <body>");

  // aria-current: one in the primary nav when the page is linked there, one in the crumb, none elsewhere.
  const navTag = find(doc, "nav", "primary-nav")[0];
  const nav = navTag ? outer(doc, navTag) : null;
  const self = f === NOT_FOUND ? null : f;
  const linked = nav && self && navLinkText.has(self);
  const current = (nav?.tags || []).filter((t) => t.attrs["aria-current"] === "page");
  if (linked && (current.length !== 1 || current[0].attrs.href !== self)) err(f, navTag.line, `the primary nav must mark ${self} with aria-current="page" (found ${current.map((t) => t.attrs.href).join(", ") || "none"})`);
  if (!linked && current.length) err(f, current[0].line, `aria-current on ${current[0].attrs.href}, but this page is not in the primary nav`);
  const crumbTag = find(doc, "nav", "crumb")[0];
  const crumbRange = crumbTag ? outer(doc, crumbTag) : null;
  for (const t of doc.tags) if (t.attrs["aria-current"] !== undefined && !(nav && t.index >= nav.start && t.index < nav.end) && !(crumbRange && t.index >= crumbRange.start && t.index < crumbRange.end))
    err(f, t.line, "aria-current belongs only on the primary nav link and the last breadcrumb");

  // Breadcrumbs: Home / [section] / current page, mirrored by the JSON-LD BreadcrumbList.
  const crumbs = find(doc, "nav", "crumb");
  const ld = jsonLd.get(f);
  const ldCrumbs = ld?.nodes.find((n) => n["@type"] === "BreadcrumbList");
  if (f === "index.html" || f === NOT_FOUND) {
    if (crumbs.length) err(f, crumbs[0].line, `${f} must not have a breadcrumb`);
    if (ldCrumbs) err(f, ld.line, `${f} must not have a BreadcrumbList`);
    continue;
  }
  if (crumbs.length !== 1) { err(f, 1, `expected one <nav class="crumb"> (found ${crumbs.length})`); continue; }
  const crumb = crumbRange;
  const cline = crumbs[0].line;
  if (crumbs[0].attrs["aria-label"] !== "Breadcrumb") err(f, cline, 'the crumb nav needs aria-label="Breadcrumb"');
  if (!/^<nav[^>]*>\s*<ol>[\s\S]*<\/ol>\s*<\/nav>$/.test(crumb.html)) err(f, cline, "the crumb must be <nav><ol> of <li> items");
  const items = [...crumb.html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
  const expected = []; // visible items that have a URL, in order
  items.forEach((li, i) => {
    const last = i === items.length - 1;
    const a = /^<a href="([^"]*)">([\s\S]*?)<\/a>$/.exec(li);
    const cur = /^<span aria-current="page">([\s\S]*?)<\/span>$/.exec(li);
    if (i === 0 && li !== '<a href="./">Home</a>') err(f, cline, 'the first crumb must be <a href="./">Home</a>');
    if (last && !cur) err(f, cline, 'the last crumb must be <span aria-current="page">');
    if (!last && cur) err(f, cline, "only the last crumb may carry aria-current");
    if (a) {
      const r = resolveLocal(f, a[1]);
      if (r && !r.missing) expected.push({ name: text(a[2]), item: canonicalFor(r.file) });
    } else if (cur) expected.push({ name: text(cur[1]), item: canonicalFor(f) });
    else if (/</.test(li)) err(f, cline, `crumb item "${text(li)}" must be a link, plain text, or the current page`);
  });
  const section = menuSection.get(f);
  const middle = items.slice(1, -1);
  if (section && (middle.length !== 1 || middle[0] !== section)) err(f, cline, `${f} sits under "${section}" in the Services menu, so its crumb must read Home / ${section} / page`);
  if (!section) for (const li of middle) if (!/^<a /.test(li)) err(f, cline, `plain-text crumb "${text(li)}" is only for pages in the Services menu`);
  const curName = expected.length ? expected[expected.length - 1].name : "";
  if (navLinkText.has(f) && curName !== navLinkText.get(f)) err(f, cline, `the current crumb "${curName}" should match the nav label "${navLinkText.get(f)}"`);
  if (!ldCrumbs) { err(f, ld?.line || 1, "JSON-LD has no BreadcrumbList for the visible crumb"); continue; }
  const got = (ldCrumbs.itemListElement || []).map((e) => ({ pos: e.position, name: e.name, item: typeof e.item === "object" ? e.item?.["@id"] : e.item }));
  const show = (list) => list.map((e) => `${e.name} <${e.item}>`).join(" / ");
  if (got.length !== expected.length || got.some((g, i) => g.pos !== i + 1 || g.name !== expected[i].name || g.item !== expected[i].item))
    err(f, ld.line, `BreadcrumbList is ${show(got)}; the visible crumb gives ${show(expected)}`);
}

// ---------------------------------------------------------------------------
// 6. catalog parity and every count quoted from it
// ---------------------------------------------------------------------------
let catalog = null;
try {
  const sandbox = { window: {} };
  vm.runInNewContext(read("assets/js/catalog.js"), sandbox, { filename: "catalog.js", timeout: 1000 });
  catalog = sandbox.window.NADIRION_CATALOG;
  if (!catalog?.modules || !catalog.desktop) throw new Error("window.NADIRION_CATALOG needs desktop and modules");
} catch (e) { err("assets/js/catalog.js", 1, `catalog does not load: ${e.message}`); }

const slug = (s) => s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const toNumber = (s) => {
  s = s.toLowerCase();
  if (/^\d+$/.test(s)) return +s;
  const [t, u] = s.split(/[-\s]/);
  return TENS[t] !== undefined ? TENS[t] + (u ? UNITS.indexOf(u) : 0) : UNITS.indexOf(t);
};
const NUM = `(\\d+|(?:${Object.keys(TENS).join("|")})(?:[-\\s](?:${UNITS.slice(1, 10).join("|")}))?|${UNITS.slice(1).join("|")})`;
const SP = "(?:\\s|&nbsp;|&#160;|\u00a0)+";
const HY = "(?:-|&#8209;|\u2011)";

if (catalog && docs["modules.html"]) {
  const mod = docs["modules.html"];
  const ids = Object.keys(catalog.modules);
  const total = ids.length;
  const perCat = {};
  const catNames = {};
  for (const [id, e] of Object.entries(catalog.modules)) {
    if (!e.name || !e.category) err("assets/js/catalog.js", 1, `module "${id}" needs a name and a category`);
    if (e.price !== null && !(typeof e.price === "number" && e.price >= 0)) err("assets/js/catalog.js", 1, `module "${id}" price must be null (on quote) or a number`);
    const s = slug(e.category || "");
    perCat[s] = (perCat[s] || 0) + 1;
    catNames[s] = e.category;
  }
  const categoryCount = Object.keys(perCat).length;

  // Cards on modules.html, by category group.
  const sold = new Map();
  const codes = new Map();
  for (const g of find(mod, "div", "cat-group")) {
    const group = outer(mod, g);
    const gslug = g.attrs["data-category"];
    const cards = group.tags.filter((t) => t.name === "article" && hasClass(t, "mod-card"));
    const countTag = group.tags.find((t) => hasClass(t, "cat-count"));
    const count = countTag ? /^(\d+) modules?$/.exec(text(outer(mod, countTag).html)) : null;
    if (!count || +count[1] !== cards.length) err("modules.html", countTag?.line || g.line, `cat-count for ${gslug} says "${countTag ? text(outer(mod, countTag).html) : "nothing"}" but the group has ${cards.length} card(s)`);
    if (g.attrs.id !== (gslug === "preview" ? "in-development" : `cat-${gslug}`)) err("modules.html", g.line, `cat-group id "${g.attrs.id}" should be cat-${gslug}`);
    if (gslug !== "preview" && perCat[gslug] === undefined) err("modules.html", g.line, `category group ${gslug} is not a category in catalog.js`);
    if (gslug !== "preview" && perCat[gslug] !== cards.length) err("modules.html", g.line, `${gslug} has ${cards.length} card(s), catalog.js has ${perCat[gslug] || 0}`);
    const heading = group.tags.find((t) => t.name === "h2");
    if (gslug !== "preview" && heading && text(outer(mod, heading).html) !== catNames[gslug]) err("modules.html", heading.line, `group heading "${text(outer(mod, heading).html)}" != catalog category "${catNames[gslug]}"`);
    for (const c of cards) {
      const card = outer(mod, c);
      const h3 = card.tags.find((t) => t.name === "h3");
      const name = h3 ? text(outer(mod, h3).html) : "";
      const btn = card.tags.find((t) => t.name === "button" && t.attrs["data-module"] !== undefined);
      const priceFor = card.tags.find((t) => t.attrs["data-price-for"] !== undefined)?.attrs["data-price-for"];
      const codeTag = card.tags.find((t) => hasClass(t, "mod-code"));
      const code = codeTag ? text(outer(mod, codeTag).html) : "";
      if (code && codes.has(code)) err("modules.html", c.line, `module code ${code} is also used at line ${codes.get(code)}`);
      else if (code) codes.set(code, c.line);
      if (c.attrs["data-category"] !== gslug) err("modules.html", c.line, `card data-category="${c.attrs["data-category"]}" sits in the ${gslug} group`);
      if (gslug === "preview") {
        if (btn) err("modules.html", c.line, `in-development card "${name}" must not have an add button`);
        continue;
      }
      if (!btn) { err("modules.html", c.line, `card "${name}" has no add button with data-module`); continue; }
      const id = btn.attrs["data-module"];
      const entry = catalog.modules[id];
      if (sold.has(id)) err("modules.html", c.line, `data-module="${id}" appears twice`);
      sold.set(id, c.line);
      if (!entry) { err("modules.html", c.line, `data-module="${id}" is not in catalog.js`); continue; }
      if (entry.name !== name) err("modules.html", c.line, `card title "${name}" != catalog name "${entry.name}"`);
      if (slug(entry.category) !== gslug) err("modules.html", c.line, `card is in ${gslug}, catalog says ${entry.category}`);
      if (priceFor !== id) err("modules.html", c.line, `data-price-for="${priceFor}" != data-module="${id}"`);
      if (c.attrs.id !== id.replace(/_/g, "-")) err("modules.html", c.line, `card id "${c.attrs.id}" should be "${id.replace(/_/g, "-")}"`);
      // Accessible name: visible label plus the visually-hidden ": Name" (inline, so no added space).
      const label = decode(outer(mod, btn).html.replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
      if (label !== `Add to license: ${name}`) err("modules.html", btn.line, `add button reads "${label}"; expected "Add to license: ${name}"`);
    }
  }
  for (const id of ids) if (!sold.has(id)) err("assets/js/catalog.js", 1, `catalog id "${id}" has no card on modules.html`);
  for (const doc of Object.values(docs)) for (const t of doc.tags) {
    const pf = t.attrs["data-price-for"];
    if (pf !== undefined && pf !== "desktop" && !catalog.modules[pf]) err(doc.file, t.line, `data-price-for="${pf}" is not in catalog.js`);
    const dm = t.attrs["data-module"];
    if (dm !== undefined && !catalog.modules[dm]) err(doc.file, t.line, `data-module="${dm}" is not in catalog.js`);
  }

  // Home page category cards: count, listed names, "And N more", link and label.
  const home = docs["index.html"];
  const homeCats = new Set();
  for (const c of home ? find(home, "article", "focus-card") : []) {
    const card = outer(home, c);
    const m = /<a class="card-link" href="modules\.html#cat-([\w-]+)">([\s\S]*?)<\/a>/.exec(card.html);
    if (!m) continue;
    const s = m[1];
    homeCats.add(s);
    if (perCat[s] === undefined) { err("index.html", c.line, `category card links to cat-${s}, which is not a catalog category`); continue; }
    if (text(m[2]) !== catNames[s]) err("index.html", c.line, `category card "${text(m[2])}" != catalog category "${catNames[s]}"`);
    const idx = /<span class="focus-index">([\s\S]*?)<\/span>/.exec(card.html);
    const n = idx ? /^0?(\d+) modules?$/.exec(text(idx[1])) : null;
    if (!n || +n[1] !== perCat[s]) err("index.html", c.line, `focus-index for ${s} says "${idx ? text(idx[1]) : "nothing"}", catalog has ${perCat[s]}`);
    const points = /<ul class="focus-points">([\s\S]*?)<\/ul>/.exec(card.html);
    if (points) {
      let listed = 0, more = 0;
      for (const li of points[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
        const name = text(li[1]);
        const andMore = /^And (\d+) more$/.exec(name);
        if (andMore) { more = +andMore[1]; continue; }
        listed++;
        if (!Object.values(catalog.modules).some((e) => e.name === name && slug(e.category) === s)) err("index.html", c.line, `"${name}" is not a ${catNames[s]} module in catalog.js`);
      }
      if (listed + more !== perCat[s]) err("index.html", c.line, `${s} card lists ${listed}${more ? ` + ${more} more` : ""}, catalog has ${perCat[s]}`);
    }
  }
  if (home && homeCats.size) for (const s of Object.keys(perCat)) if (!homeCats.has(s)) err("index.html", 1, `no category card for ${catNames[s]}`);

  // Quoted counts in copy and in attributes people read (meta content, alt, title, aria-label).
  const RULES = [
    [new RegExp(`\\b${NUM}${SP}(?:Nadirion${SP}Desktop${SP})?(?:add${HY}on${SP}modules|add${HY}ons|modules)\\b`, "gi"), (n) => n < 12 || n === total, () => `catalog.js has ${total} modules`],
    [new RegExp(`\\b(?:all|any${SP}of)${SP}${NUM}\\b`, "gi"), (n) => n < 12 || n === total, () => `catalog.js has ${total} modules`],
    [new RegExp(`\\b${NUM}${SP}products\\b`, "gi"), (n) => n === total + 1, () => `that is Nadirion Desktop plus ${total} modules = ${total + 1}`],
    [new RegExp(`\\b${NUM}${SP}categories\\b`, "gi"), (n) => n === categoryCount, () => `catalog.js has ${categoryCount} categories`],
  ];
  // Per-category figures are checked against their own category above or below.
  const categoryContext = (raw, idx) => /(class="(cat-count|focus-index)">|&middot;|\u00b7)\s*$/.test(raw.slice(Math.max(0, idx - 40), idx));
  for (const doc of Object.values(docs)) {
    const copy = doc.masked.replace(/<[^>]*>/g, blank);
    const seen = new Set();
    for (const [re, ok, why] of RULES) for (const m of copy.matchAll(re)) {
      if (seen.has(m.index) || categoryContext(doc.masked, m.index)) continue;
      seen.add(m.index);
      if (!ok(toNumber(m[1]))) err(doc.file, doc.lineAt(m.index), `"${m[0].replace(/\s+/g, " ")}": ${why()}`);
    }
    for (const t of doc.tags) for (const a of ["content", "alt", "title", "aria-label"]) {
      if (!t.attrs[a] || (t.name === "meta" && t.attrs["http-equiv"])) continue;
      for (const [re, ok, why] of RULES) for (const m of t.attrs[a].matchAll(re)) if (!ok(toNumber(m[1]))) err(doc.file, t.line, `${a} "${m[0]}": ${why()}`);
    }
  }
  // pricing.html lists every category as "Name · N modules".
  const pricing = docs["pricing.html"];
  if (pricing) {
    const listedCats = new Set();
    for (const m of pricing.masked.matchAll(new RegExp(`<li>([^<]+?)${SP}(?:&middot;|\u00b7)${SP}(\\d+)${SP}modules?</li>`, "g"))) {
      const s = slug(decode(m[1]).trim());
      listedCats.add(s);
      if (perCat[s] === undefined) err("pricing.html", pricing.lineAt(m.index), `"${decode(m[1]).trim()}" is not a catalog category`);
      else if (+m[2] !== perCat[s]) err("pricing.html", pricing.lineAt(m.index), `${catNames[s]} says ${m[2]} modules, catalog has ${perCat[s]}`);
    }
    if (listedCats.size) for (const s of Object.keys(perCat)) if (!listedCats.has(s)) err("pricing.html", 1, `the add-on plan does not list ${catNames[s]}`);
  }
}

// ---------------------------------------------------------------------------
// 7. forms and privacy
// ---------------------------------------------------------------------------
const connectSrc = (map) => map?.get("connect-src") || map?.get("default-src") || [];
for (const doc of Object.values(docs)) {
  const f = doc.file;
  const metaCsp = parseCsp(find(doc, "meta").find((t) => (t.attrs["http-equiv"] || "").toLowerCase() === "content-security-policy")?.attrs.content || "");
  for (const formTag of find(doc, "form")) {
    const form = outer(doc, formTag);
    if ((formTag.attrs.method || "").toLowerCase() !== "post") err(f, formTag.line, '<form> needs method="post": without JavaScript a GET puts every field in the URL');
    const fields = new Map(); // name -> Set of values (radio/option), or null for free text
    for (const t of form.tags) if (["input", "select", "textarea"].includes(t.name) && t.attrs.name) {
      if (t.name === "select") {
        const sel = outer(doc, t);
        fields.set(t.attrs.name, new Set(sel.tags.filter((o) => o.name === "option").map((o) => o.attrs.value ?? text(outer(doc, o).html))));
      } else if (t.attrs.type === "radio" || t.attrs.type === "checkbox") {
        if (!fields.get(t.attrs.name)) fields.set(t.attrs.name, new Set());
        fields.get(t.attrs.name).add(t.attrs.value ?? "on");
      } else fields.set(t.attrs.name, null);
    }
    for (const t of form.tags) if (t.attrs["data-show-when"] !== undefined) {
      const [field, values] = splitOnce(t.attrs["data-show-when"], ":");
      if (!fields.has(field)) { err(f, t.line, `data-show-when field "${field}" is not a control in this form`); continue; }
      const allowed = fields.get(field);
      if (allowed) for (const v of (values || "").split("|")) if (!allowed.has(v)) err(f, t.line, `data-show-when value "${v}" is not an option of ${field}`);
    }
    const endpoint = formTag.attrs["data-endpoint"];
    if (endpoint === undefined) continue;
    let url;
    try { url = new URL(endpoint, canonicalFor(f)); } catch { err(f, formTag.line, `data-endpoint "${endpoint}" is not a URL`); continue; }
    if (url.protocol !== "https:") err(f, formTag.line, "data-endpoint must use https");
    if (url.origin === ORIGIN) continue; // same origin: connect-src 'self' already allows it
    if (!connectSrc(metaCsp).includes(url.origin)) err(f, formTag.line, `data-endpoint origin ${url.origin} is missing from connect-src in this page's CSP <meta> (the fetch would be refused)`);
    if (headerCsp && !connectSrc(headerCsp).includes(url.origin)) err("_headers", headerCspEntry.line, `connect-src must include ${url.origin} (data-endpoint on ${f})`);
    if (docs["privacy.html"] && !docs["privacy.html"].src.includes(url.hostname)) err("privacy.html", 1, `forms now send to ${url.hostname}; the privacy page must say so`);
  }
}

// Browser storage: privacy.html names every key the scripts keep, and every
// nadirion.* key it names is one they still use. So that the keys can be read here,
// each getItem/setItem/removeItem call takes a string literal or a var holding one,
// and storage is never reached any other way.
const PRIVACY = "privacy.html";
const storageKeys = new Map(); // key -> "file:line" of its first use
for (const f of jsFiles) {
  const src = read(f);
  const code = jsCode(src);
  const lineAt = lineIndex(src);
  const strings = new Map([...code.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])([^"'\\\n]*)\2\s*[;,]/g)].map((m) => [m[1], m[3]]));
  for (const m of code.matchAll(/\b(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*([^,)]*)/g)) {
    const arg = m[3].trim();
    const literal = /^(["'])([^"'\\]*)\1$/.exec(arg);
    const key = literal ? literal[2] : strings.get(arg);
    if (key === undefined) err(f, lineAt(m.index), `${m[1]}.${m[2]}(${arg}): pass the key as a string literal or a var holding one, so the privacy check can read it`);
    else if (!storageKeys.has(key)) storageKeys.set(key, `${f}:${lineAt(m.index)}`);
  }
  for (const m of code.matchAll(/\b(localStorage|sessionStorage)\s*(?:\[|\.\s*(?!(?:getItem|setItem|removeItem|clear|key|length)\b)[\w$])|(?<![=!<>])=\s*(?:window\s*\.\s*)?(localStorage|sessionStorage)\s*[;,)]/g))
    err(f, lineAt(m.index), `reach ${m[1] || m[2]} only through getItem/setItem/removeItem(KEY), so the privacy check sees every key`);
}
const privacy = docs[PRIVACY];
if (!privacy && storageKeys.size) err(PRIVACY, 1, `missing: the scripts keep ${[...storageKeys.keys()].join(", ")} in browser storage, and the site must say so`);
if (privacy) {
  const mainTag = find(privacy, "main")[0];
  const range = mainTag ? outer(privacy, mainTag) : { start: 0, end: privacy.src.length };
  const said = text(privacy.masked.slice(range.start, range.end)); // visible text, comments left out
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [key, where] of storageKeys)
    if (!new RegExp(`(?<![\\w.@-])${escape(key)}(?![\\w-]|\\.[\\w-])`).test(said)) err(PRIVACY, mainTag?.line || 1, `${where} keeps "${key}" in browser storage, but privacy.html does not name it`);
  const host = new URL(ORIGIN).hostname;
  for (const m of said.matchAll(/(?<![\w.@-])nadirion\.[a-z][\w-]*(?:\.[\w-]+)*/g)) if (m[0] !== host && !storageKeys.has(m[0]))
    err(PRIVACY, privacy.lineAt(Math.max(0, privacy.masked.indexOf(m[0], range.start))), `names the storage key "${m[0]}", which no script in assets/js uses`);
}

// ---------------------------------------------------------------------------
// 8. crawl and security files
// ---------------------------------------------------------------------------
if (exists("sitemap.xml")) {
  const sm = read("sitemap.xml");
  const lineAt = lineIndex(sm);
  if (!/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm)) err("sitemap.xml", 1, "must start with the XML declaration and a sitemaps.org <urlset>");
  const locs = new Map();
  for (const m of sm.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const line = lineAt(m.index);
    const loc = (/<loc>([^<]+)<\/loc>/.exec(m[1]) || [])[1]?.trim();
    if (!loc) { err("sitemap.xml", line, "<url> without <loc>"); continue; }
    if (locs.has(loc)) err("sitemap.xml", line, `${loc} is listed twice`);
    locs.set(loc, line);
    const r = resolveLocal("index.html", loc);
    if (!loc.startsWith(ORIGIN + "/") || !r || r.missing) err("sitemap.xml", line, `${loc} is not a file in the site`);
    else if (r.file === NOT_FOUND) err("sitemap.xml", line, "404.html must not be in the sitemap");
    else if (canonicals.get(r.file) !== loc) err("sitemap.xml", line, `${loc} is not the canonical URL of ${r.file} (${canonicals.get(r.file) || "none"})`);
    const lastmod = (/<lastmod>([^<]+)<\/lastmod>/.exec(m[1]) || [])[1];
    if (lastmod !== undefined && (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(lastmod) || isNaN(Date.parse(lastmod)) || Date.parse(lastmod) > Date.now() + 864e5))
      err("sitemap.xml", line, `lastmod "${lastmod}" must be a real W3C date that is not in the future`);
  }
  for (const [f, url] of canonicals) if (!locs.has(url)) err("sitemap.xml", 1, `missing ${url} (${f})`);
} else err("sitemap.xml", 1, "missing");

if (exists("robots.txt")) {
  const rb = read("robots.txt");
  if (!/^User-agent:\s*\S/im.test(rb)) err("robots.txt", 1, "needs a User-agent line");
  if (!new RegExp(`^Sitemap:\\s*${ORIGIN.replace(/\./g, "\\.")}/sitemap\\.xml\\s*$`, "m").test(rb)) err("robots.txt", 1, `needs "Sitemap: ${ORIGIN}/sitemap.xml"`);
  rb.split("\n").forEach((ln, i) => {
    const m = /^Disallow:\s*(\S*)/i.exec(ln.trim());
    if (m && m[1] === "/") err("robots.txt", i + 1, "Disallow: / hides the whole site from search");
    if (m && /^\/assets/.test(m[1])) err("robots.txt", i + 1, "do not disallow /assets: search engines need the CSS and JS to render pages");
  });
} else err("robots.txt", 1, "missing");

const SEC = ".well-known/security.txt";
if (exists(SEC)) {
  const s = read(SEC);
  if (/\r/.test(s)) err(SEC, 1, "use LF line endings");
  if (!s.endsWith("\n")) err(SEC, 1, "end the file with a newline");
  const fields = [];
  s.split("\n").forEach((ln, i) => {
    if (!ln.trim() || ln.startsWith("#")) return;
    const m = /^([A-Za-z-]+):\s*(.+)$/.exec(ln);
    if (!m) err(SEC, i + 1, `"${ln}" is not a "Field: value" line`);
    else fields.push({ name: m[1].toLowerCase(), value: m[2].trim(), line: i + 1 });
  });
  const contact = fields.filter((x) => x.name === "contact");
  if (!contact.length) err(SEC, 1, "Contact: is required (RFC 9116)");
  for (const c of contact) if (!/^(mailto:|https:\/\/|tel:)/.test(c.value)) err(SEC, c.line, "Contact must be a mailto:, https: or tel: URI");
  const expires = fields.filter((x) => x.name === "expires");
  if (expires.length !== 1) err(SEC, 1, "exactly one Expires: is required (RFC 9116)");
  else {
    const t = Date.parse(expires[0].value);
    const days = (t - Date.now()) / 864e5;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(expires[0].value) || isNaN(t)) err(SEC, expires[0].line, "Expires must be an ISO 8601 date-time such as 2027-10-30T23:59:59Z");
    else if (days <= 0) err(SEC, expires[0].line, `Expires ${expires[0].value} has passed: renew it (an expired security.txt must not stay published)`);
    else if (days < 30) warn(SEC, expires[0].line, `Expires ${expires[0].value} is ${Math.ceil(days)} day(s) away: renew it`);
    else if (days > 366) warn(SEC, expires[0].line, "Expires should be less than a year ahead (RFC 9116)");
  }
  for (const c of fields.filter((x) => x.name === "canonical")) if (c.value !== `${ORIGIN}/${SEC}`) err(SEC, c.line, `Canonical should be ${ORIGIN}/${SEC}`);
  for (const x of fields) if (x.value.startsWith(ORIGIN + "/")) {
    const r = resolveLocal("index.html", x.value);
    if (!r || r.missing) err(SEC, x.line, `${x.value} is not a file in the site`);
    else if (r.frag && docs[r.file] && !idSets[r.file].has(r.frag)) err(SEC, x.line, `${x.value} points at a missing #${r.frag}`);
  }
} else err(SEC, 1, "missing (RFC 9116)");

if (!exists(".nojekyll")) err(".nojekyll", 1, "missing: without it GitHub Pages runs Jekyll and drops .well-known/");

if (headerRules.length) {
  // A path matching several rules receives every rule's headers (Cloudflare Pages joins
  // duplicates with commas), so each header name may be set by only one rule per path.
  const globRe = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/:\w+/g, "[^/]+") + "$");
  const sample = (p) => p.replace(/\*/g, "x").replace(/:\w+/g, "x");
  for (let i = 0; i < headerRules.length; i++) {
    const a = headerRules[i];
    if (!a.pattern.startsWith("/")) err("_headers", a.line, `rule "${a.pattern}" must start with /`);
    if (!/[*:]/.test(a.pattern) && !exists(a.pattern.slice(1))) err("_headers", a.line, `rule ${a.pattern} matches no file`);
    const names = new Set();
    for (const h of a.headers) { if (names.has(h.name)) err("_headers", h.line, `${h.name} is set twice in ${a.pattern}`); names.add(h.name); }
    for (let j = i + 1; j < headerRules.length; j++) {
      const b = headerRules[j];
      if (!globRe(a.pattern).test(sample(b.pattern)) && !globRe(b.pattern).test(sample(a.pattern))) continue;
      for (const h of b.headers) if (names.has(h.name)) err("_headers", h.line, `${h.name} is also set by ${a.pattern} (line ${a.line}), which matches the same paths`);
    }
  }
  const rp = headerValue(rootRule, "referrer-policy");
  if (firstReferrer && rp && rp.value !== firstReferrer.value) err("_headers", rp.line, `Referrer-Policy "${rp.value}" differs from the pages' referrer meta "${firstReferrer.value}"`);
  for (const [name, want] of [["x-content-type-options", "nosniff"], ["strict-transport-security", null], ["x-frame-options", null], ["referrer-policy", null], ["permissions-policy", null]])
    if (!headerValue(rootRule, name)) err("_headers", rootRule?.line || 1, `the /* rule should set ${name}${want ? `: ${want}` : ""}`);
}

if (exists("site.webmanifest")) {
  try {
    const mf = JSON.parse(read("site.webmanifest"));
    for (const icon of mf.icons || []) {
      const r = resolveLocal("index.html", icon.src || "");
      if (!r || r.missing) err("site.webmanifest", 1, `icon ${icon.src} is missing`);
    }
    for (const k of ["start_url", "scope"]) if (mf[k] !== undefined) {
      const r = resolveLocal("index.html", mf[k]);
      if (!r || r.missing) err("site.webmanifest", 1, `${k} ${mf[k]} does not resolve to a page`);
    }
  } catch (e) { err("site.webmanifest", 1, `does not parse: ${e.message}`); }
}

// ---------------------------------------------------------------------------
// 9. copy rules
// ---------------------------------------------------------------------------
// Built from pieces so this file does not match itself.
const EM_DASH = new RegExp(["\u2014", "&" + "mdash;", "&#" + "8212;", "&#x" + "2014;"].join("|"), "gi");
const TEXT_EXT = /\.(html|css|js|mjs|md|txt|xml|yml|yaml|py|json|svg|webmanifest)$|^_headers$/;
function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) { if (e.name !== ".git" && e.name !== "node_modules") walkFiles(rel, out); }
    else if (TEXT_EXT.test(e.name) && !VERBATIM.test(rel)) out.push(rel);
  }
  return out;
}
for (const f of walkFiles("")) {
  const s = read(f);
  const lineAt = lineIndex(s);
  for (const m of s.matchAll(EM_DASH)) err(f, lineAt(m.index), "em dash: use a colon, comma, parentheses or a new sentence");
}
for (const doc of Object.values(docs)) for (const [re, why] of RETIRED) for (const m of doc.masked.matchAll(re)) err(doc.file, doc.lineAt(m.index), `"${m[0]}": ${why}`);

// ---------------------------------------------------------------------------
// 10. CSS selectors whose classes nothing uses (warning only)
// ---------------------------------------------------------------------------
if (css) {
  const used = new Set();
  for (const doc of Object.values(docs)) for (const t of doc.tags) for (const c of (t.attrs.class || "").split(/\s+/)) if (c) used.add(c);
  for (const f of jsFiles) for (const m of read(f).matchAll(/["'`]([\w\s.-]+)["'`]/g)) for (const c of m[1].split(/[\s.]+/)) if (c) used.add(c);
  const lineAt = lineIndex(css);
  for (const m of cssCode.matchAll(/([^{}@;]+)\{/g)) {
    for (const sel of m[1].split(",")) {
      if (/^\s*(from|to|\d+%)\s*$/.test(sel)) continue;
      const missing = [...new Set([...sel.replace(/url\([^)]*\)|"[^"]*"|'[^']*'/g, "").matchAll(/\.([a-zA-Z][\w-]*)/g)].map((x) => x[1]))].filter((c) => !used.has(c));
      if (missing.length) warn(CSS_FILE, lineAt(m.index + m[0].indexOf(sel.trim())), `"${sel.trim()}" uses .${missing.join(", .")}, which no page or script uses`);
    }
  }
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
const fmt = (x) => `${x.file}:${x.line}  ${x.msg}`;
if (!QUIET) for (const w of warnings) console.log("warn  " + fmt(w));
for (const e of errors) console.log("ERROR " + fmt(e));
const modules = catalog ? Object.keys(catalog.modules).length : 0;
console.log(`\ncheck-site: ${pages.length} pages, ${modules} catalog modules: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
