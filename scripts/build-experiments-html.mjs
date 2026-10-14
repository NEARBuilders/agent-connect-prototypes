import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const EXP_DIR = path.join(ROOT, "docs");
const OUT = path.join(EXP_DIR, "index.html");

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const unescapeEntities = (text) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const stripTags = (html) => unescapeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const TS_TOKEN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|await|async|function|return|for|of|if|else|new|type|import|from|export|null|true|false)\b|\b(\d[\w.]*)\b/g;

function highlightTs(code) {
  let out = "";
  let last = 0;
  for (const match of code.matchAll(TS_TOKEN)) {
    out += escapeHtml(code.slice(last, match.index));
    const cls = match[1] ? "c" : match[2] ? "s" : match[3] ? "k" : "n";
    out += `<span class="t${cls}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  out = out.replace(/(^|[\s(—])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return out;
}

const PARA_CLASSES = [
  ["Notes / constraints", "note"],
  ["Whitelist on an agreement", "agreement"],
  ["Variants (absorbed)", "variants"],
  ["To handle these use cases", "usecases"],
  ["Build in such a way", "build"],
  ["Configuration", "config"],
];

function paraClass(text) {
  for (const [lead, cls] of PARA_CLASSES) {
    if (text.startsWith(`**${lead}`)) return cls;
  }
  if (text.startsWith("**For ")) return "forwhom";
  return null;
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", code: body.join("\n") });
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    if (line.startsWith("> ")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|\||- |> )/.test(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "para", text: para.join(" ") });
  }
  return blocks;
}

function renderTable(rows) {
  const rowsData = rows
    .filter((row) => !/^[\s|:-]+$/.test(row))
    .map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
  const [head, ...body] = rowsData;
  const headHtml = head.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function renderCode(code) {
  return `<div class="code-wrap"><button class="copy-btn" type="button">Copy</button><pre><code>${highlightTs(code)}</code></pre></div>`;
}

function renderBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.type === "code") out.push(renderCode(block.code));
    else if (block.type === "table") out.push(renderTable(block.rows));
    else if (block.type === "list") {
      out.push(`<ul>${block.items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    } else if (block.type === "quote") {
      out.push(`<aside class="proposal-note">${renderInline(block.text)}</aside>`);
    } else {
      const cls = paraClass(block.text);
      out.push(`<p${cls ? ` class="${cls}"` : ""}>${renderInline(block.text)}</p>`);
    }
  }
  return out.join("\n");
}

function parseExperiment(filename, source) {
  const num = filename.match(/^(\d+)/)[1];
  const titleLine = source.split("\n").find((line) => line.startsWith("# Experiment"));
  const title = titleLine.replace(/^# Experiment \d+ — /, "").trim();
  const proposer = source.match(/\*\*Proposer:\*\* (.+)/)?.[1]?.trim() ?? "";
  const theme = source.match(/\*\*Theme:\*\* (.+)/)?.[1]?.trim() ?? "";
  const sections = {};
  let current = null;
  for (const line of source.split("\n")) {
    if (line.startsWith("## ")) {
      current = line.slice(3).trim();
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return {
    id: `exp-${num}`,
    num,
    title,
    proposer,
    theme,
    proposedExtension: source.includes("Proposed extension"),
    details: renderBlocks(parseBlocks(sections.Details ?? [])),
    config: renderBlocks(parseBlocks(sections["Configurations (specific to Agent Connect)"] ?? [])),
    outcomes: renderBlocks(parseBlocks(sections.Outcomes ?? [])),
  };
}

function parseAdditional(source) {
  const entries = [];
  let current = null;
  for (const line of source.split("\n")) {
    if (line.startsWith("## ")) {
      if (current) entries.push(current);
      current = { title: line.slice(3).trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(current);
  return entries.map((entry, index) => {
    const text = entry.body.join("\n");
    return {
      id: `add-${slugify(entry.title)}`,
      num: `A${index + 1}`,
      title: entry.title,
      proposer: text.match(/\*\*Proposer:\*\* (.+)/)?.[1]?.trim() ?? "",
      theme: text.match(/\*\*Theme:\*\* (.+)/)?.[1]?.trim() ?? "",
      body: renderBlocks(parseBlocks(entry.body)),
    };
  });
}

const CSS = `
:root {
  --bg: #f6f7f9;
  --panel: #ffffff;
  --panel2: #edf0f4;
  --text: #18202e;
  --muted: #5d6a7d;
  --border: #dfe3ea;
  --accent: #0a8f5f;
  --accent-soft: rgba(10, 143, 95, 0.12);
  --code-bg: #f2f4f8;
  --shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  --amber: #9a6a0a;
  --amber-soft: #fdf3dd;
  --tc: #7c8797;
  --ts: #0a7d4f;
  --tk: #7c3aed;
  --tn: #b45309;
}
html[data-theme="dark"] {
  --bg: #0e131c;
  --panel: #151c28;
  --panel2: #1b2333;
  --text: #e5eaf3;
  --muted: #93a0b4;
  --border: #273145;
  --accent: #00d68f;
  --accent-soft: rgba(0, 214, 143, 0.14);
  --code-bg: #101724;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  --amber: #fbbf24;
  --amber-soft: rgba(251, 191, 36, 0.13);
  --tc: #5f6b7e;
  --ts: #4ade80;
  --tk: #c4b5fd;
  --tn: #fbbf24;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
  font-size: 15px;
}
#topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 18px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; font-size: 15px; white-space: nowrap; }
.brand span { color: var(--muted); font-weight: 500; }
#q {
  flex: 1 1 200px;
  max-width: 330px;
  padding: 7px 12px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
#q:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
select {
  padding: 7px 8px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  max-width: 170px;
}
#count { color: var(--muted); font-size: 13px; white-space: nowrap; }
#theme-toggle, #nav-toggle {
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  border-radius: 9px;
  padding: 6px 11px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.2;
}
#theme-toggle:hover, #nav-toggle:hover { border-color: var(--accent); }
#layout { display: flex; align-items: flex-start; }
#sidebar {
  width: 280px;
  flex: 0 0 280px;
  position: sticky;
  top: 55px;
  height: calc(100vh - 55px);
  overflow-y: auto;
  padding: 10px 10px 48px;
  border-right: 1px solid var(--border);
}
#sidebar h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--muted);
  margin: 18px 8px 6px;
  font-weight: 700;
}
#sidebar a {
  display: block;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
  font-size: 13.5px;
  line-height: 1.35;
}
#sidebar a:hover { background: var(--panel2); }
#sidebar a.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
#sidebar a .n { color: var(--muted); font-variant-numeric: tabular-nums; margin-right: 7px; }
main { flex: 1; min-width: 0; max-width: 940px; margin: 0 auto; padding: 26px 28px 90px; }
.intro {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 26px;
  margin-bottom: 30px;
  color: var(--muted);
  font-size: 14.5px;
}
.intro p { margin: 8px 0; }
.intro strong { color: var(--text); }
.divider {
  margin: 44px 0 20px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--muted);
  scroll-margin-top: 76px;
}
.exp-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 26px 30px 22px;
  margin-bottom: 28px;
  box-shadow: var(--shadow);
  scroll-margin-top: 76px;
}
.exp-card:target { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.card-head { display: flex; gap: 14px; align-items: center; margin-bottom: 12px; }
.num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 42px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
  font-size: 15px;
  flex: 0 0 auto;
}
.card-head h2 { margin: 0; font-size: 21px; line-height: 1.3; }
.badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.badge {
  font-size: 12px;
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--panel2);
  color: var(--muted);
  white-space: nowrap;
}
.badge.theme { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.badge.proposed { background: var(--amber-soft); color: var(--amber); font-weight: 600; }
.exp-card h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--muted);
  margin: 24px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.exp-card p { margin: 10px 0; }
p.build strong { color: var(--text); }
p.forwhom { font-size: 1.03em; }
p.forwhom strong { color: var(--accent); }
p.agreement strong, p.config strong { color: var(--accent); }
p.note {
  background: var(--panel2);
  border-left: 3px solid var(--muted);
  padding: 10px 14px;
  border-radius: 0 9px 9px 0;
  color: var(--muted);
  font-size: 0.93em;
}
p.variants { color: var(--muted); font-size: 0.92em; }
aside.proposal-note {
  border: 1px dashed var(--amber);
  background: var(--amber-soft);
  color: var(--amber);
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.94em;
}
ul { margin: 10px 0; padding-left: 22px; }
li { margin: 5px 0; }
a { color: var(--accent); }
code {
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86em;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 5px;
}
.code-wrap { position: relative; margin: 14px 0; }
pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
  margin: 0;
}
pre code { background: none; border: none; padding: 0; font-size: inherit; }
.t-c { color: var(--tc); font-style: italic; }
.t-s { color: var(--ts); }
.t-k { color: var(--tk); font-weight: 600; }
.t-n { color: var(--tn); }
.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  opacity: 0.75;
}
.copy-btn:hover { opacity: 1; border-color: var(--accent); color: var(--accent); }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.92em; margin: 12px 0; }
th, td { border: 1px solid var(--border); padding: 7px 11px; text-align: left; }
th { background: var(--panel2); }
.card-nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.card-nav a {
  color: var(--accent);
  text-decoration: none;
  font-size: 13.5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-nav a:hover { text-decoration: underline; }
.card-nav a.next { margin-left: auto; text-align: right; }
.hidden { display: none !important; }
@media (max-width: 920px) {
  #sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    height: auto;
    z-index: 30;
    background: var(--panel);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0);
  }
  body.nav-open #sidebar { transform: none; box-shadow: 0 0 40px rgba(0, 0, 0, 0.35), 0 0 0 100vmax rgba(0, 0, 0, 0.25); }
  #nav-toggle { display: inline-block; }
  main { padding: 18px 14px 60px; }
  .exp-card { padding: 20px 18px 18px; }
}
@media (min-width: 921px) {
  #nav-toggle { display: none; }
}
@media print {
  #sidebar, #topbar, .copy-btn, .card-nav { display: none; }
  .exp-card { border: none; box-shadow: none; padding: 0; }
}
`;

const PAGE_BOOT =
  '<script>document.documentElement.setAttribute("data-theme",(function(){try{return localStorage.getItem("exp-theme")}catch(e){}return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"})());</script>';

const PAGE_JS = `
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var theme = root.getAttribute("data-theme") || "light";
  function syncToggle() { toggle.textContent = theme === "dark" ? "\\u2600" : "\\u263e"; }
  syncToggle();
  toggle.addEventListener("click", function () {
    theme = theme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("exp-theme", theme); } catch (e) {}
    syncToggle();
  });

  var search = document.getElementById("q");
  var themeFilter = document.getElementById("f-theme");
  var proposerFilter = document.getElementById("f-proposer");
  var count = document.getElementById("count");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".exp-card"));
  var sidebarLinks = Array.prototype.slice.call(document.querySelectorAll("#sidebar nav a"));

  function applyFilters() {
    var query = search.value.trim().toLowerCase();
    var themeValue = themeFilter.value;
    var proposerValue = proposerFilter.value;
    var shown = 0;
    cards.forEach(function (card) {
      var ok = (!themeValue || card.getAttribute("data-theme") === themeValue) &&
        (!proposerValue || card.getAttribute("data-proposer") === proposerValue);
      if (ok && query) ok = card.getAttribute("data-search").indexOf(query) !== -1;
      card.classList.toggle("hidden", !ok);
      if (ok) shown += 1;
    });
    sidebarLinks.forEach(function (link) {
      var card = document.getElementById(link.getAttribute("href").slice(1));
      link.classList.toggle("hidden", !card || card.classList.contains("hidden"));
    });
    Array.prototype.forEach.call(document.querySelectorAll("#sidebar .group"), function (group) {
      var any = Array.prototype.some.call(group.querySelectorAll("a"), function (link) {
        return !link.classList.contains("hidden");
      });
      group.classList.toggle("hidden", !any);
    });
    count.textContent = shown + " / " + cards.length;
  }
  search.addEventListener("input", applyFilters);
  themeFilter.addEventListener("change", applyFilters);
  proposerFilter.addEventListener("change", applyFilters);

  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === "Escape" && document.activeElement === search) {
      search.value = "";
      applyFilters();
      search.blur();
    }
  });

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest(".copy-btn") : null;
    if (!button) return;
    var code = button.parentElement.querySelector("code");
    navigator.clipboard.writeText(code.textContent).then(function () {
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = "Copy"; }, 1400);
    });
  });

  document.getElementById("nav-toggle").addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  sidebarLinks.forEach(function (link) {
    link.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
  });

  if ("IntersectionObserver" in window) {
    var activeLink = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (activeLink) activeLink.classList.remove("active");
        activeLink = null;
        for (var i = 0; i < sidebarLinks.length; i++) {
          if (sidebarLinks[i].getAttribute("href") === "#" + entry.target.id) {
            activeLink = sidebarLinks[i];
            break;
          }
        }
        if (activeLink) activeLink.classList.add("active");
      });
    }, { rootMargin: "-70px 0px -65% 0px" });
    cards.forEach(function (card) { observer.observe(card); });
  }
})();
`;

function renderCardHtml(entry, prev, next) {
  const badges = [
    `<span class="badge theme">${escapeHtml(entry.theme)}</span>`,
    `<span class="badge">${escapeHtml(entry.proposer)}</span>`,
    entry.proposedExtension ? '<span class="badge proposed">Proposed extension</span>' : "",
  ]
    .filter(Boolean)
    .join("");
  const searchText = stripTags(
    `${entry.title} ${entry.proposer} ${entry.theme} ${entry.details ?? ""} ${entry.config ?? ""} ${entry.outcomes ?? ""} ${entry.body ?? ""}`,
  ).toLowerCase();
  const sections =
    entry.body === undefined
      ? `
  <section><h3>Details</h3>
${entry.details}
  </section>
  <section><h3>Configurations (specific to Agent Connect)</h3>
${entry.config}
  </section>
  <section><h3>Outcomes</h3>
${entry.outcomes}
  </section>`
      : `\n${entry.body}`;
  const prevHtml = prev ? `<a href="#${prev.id}">&larr; ${escapeHtml(prev.label)}</a>` : "<span></span>";
  const nextHtml = next ? `<a class="next" href="#${next.id}">${escapeHtml(next.label)} &rarr;</a>` : "<span></span>";
  return `<article class="exp-card" id="${entry.id}" data-theme="${escapeHtml(entry.theme)}" data-proposer="${escapeHtml(entry.proposer)}" data-group="${escapeHtml(entry.group)}" data-search="${escapeHtml(searchText)}">
  <header class="card-head">
    <span class="num">${escapeHtml(entry.num)}</span>
    <h2>${escapeHtml(entry.title)}</h2>
  </header>
  <div class="badges">${badges}</div>
${sections}
  <nav class="card-nav">${prevHtml}${nextHtml}</nav>
</article>`;
}

async function main() {
  const files = (await readdir(EXP_DIR)).filter((name) => /^\d{2}-.*\.md$/.test(name)).sort();
  const experiments = [];
  for (const file of files) {
    experiments.push(parseExperiment(file, await readFile(path.join(EXP_DIR, file), "utf8")));
  }
  const additional = parseAdditional(await readFile(path.join(EXP_DIR, "additional.md"), "utf8"));

  const readme = await readFile(path.join(EXP_DIR, "README.md"), "utf8");
  const introSource = readme.split("## The experiments")[0].split("\n").filter((line) => !line.startsWith("# "));
  const intro = renderBlocks(parseBlocks(introSource));

  const groups = [];
  for (const experiment of experiments) {
    experiment.group = experiment.theme;
    let group = groups.find((candidate) => candidate.name === experiment.theme);
    if (!group) {
      group = { name: experiment.theme, items: [] };
      groups.push(group);
    }
    group.items.push(experiment);
  }
  for (const entry of additional) {
    entry.group = "Additional";
  }
  groups.push({ name: "Additional", items: additional });

  const ordered = [...experiments, ...additional];
  const labels = new Map(
    ordered.map((entry) => [entry.id, entry.num.length <= 2 ? `${entry.num} · ${entry.title}` : entry.title]),
  );
  const orderIds = ordered.map((entry) => entry.id);

  const sidebarHtml = groups
    .map(
      (group) => `<div class="group"><h3>${escapeHtml(group.name)}</h3>
${group.items
  .map(
    (item) =>
      `<a href="#${item.id}" data-group="${escapeHtml(group.name)}"><span class="n">${escapeHtml(item.num)}</span>${escapeHtml(item.title)}</a>`,
  )
  .join("\n")}</div>`,
    )
    .join("\n");

  const themeOptions = [...new Set(ordered.map((entry) => entry.theme))].sort().map(
    (theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`,
  );
  const proposerOptions = [...new Set(ordered.map((entry) => entry.proposer))].sort().map(
    (proposer) => `<option value="${escapeHtml(proposer)}">${escapeHtml(proposer)}</option>`,
  );

  const renderOrderedCard = (index) => {
    const prevIndex = index > 0 ? index - 1 : -1;
    const nextIndex = index < ordered.length - 1 ? index + 1 : -1;
    const prev = prevIndex >= 0 ? { id: orderIds[prevIndex], label: labels.get(orderIds[prevIndex]) } : null;
    const next = nextIndex >= 0 ? { id: orderIds[nextIndex], label: labels.get(orderIds[nextIndex]) } : null;
    return renderCardHtml(ordered[index], prev, next);
  };
  const experimentCards = experiments.map((_, index) => renderOrderedCard(index)).join("\n\n");
  const additionalCards = additional
    .map((_, offset) => renderOrderedCard(experiments.length + offset))
    .join("\n\n");

  const html = `<!doctype html>
<!-- Generated by scripts/build-experiments-html.mjs - edit the markdown sources and rebuild -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Agent Connect - Experiment Catalog</title>
${PAGE_BOOT}
<style>${CSS}</style>
</head>
<body>
<header id="topbar">
  <button id="nav-toggle" type="button" aria-label="Toggle navigation">&#9776;</button>
  <div class="brand">Agent Connect <span>&middot; Experiment Catalog</span></div>
  <input id="q" type="search" placeholder="Search experiments&hellip;" autocomplete="off">
  <select id="f-theme" aria-label="Filter by theme"><option value="">All themes</option>${themeOptions.join("")}</select>
  <select id="f-proposer" aria-label="Filter by proposer"><option value="">All proposers</option>${proposerOptions.join("")}</select>
  <span id="count">${ordered.length} / ${ordered.length}</span>
  <button id="theme-toggle" type="button" aria-label="Toggle color theme">&#9728;</button>
</header>
<div id="layout">
<aside id="sidebar">
<nav>
${sidebarHtml}
</nav>
</aside>
<main>
<div class="intro">
${intro}
</div>
${experimentCards}
<h2 class="divider" id="additional">Beyond the main list</h2>
${additionalCards}
</main>
</div>
<script>${PAGE_JS}</script>
</body>
</html>
`;

  await writeFile(OUT, html, "utf8");
  console.log(`Wrote ${OUT} (${ordered.length} cards: ${experiments.length} experiments + ${additional.length} additional)`);
}

main();
