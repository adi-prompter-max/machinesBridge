#!/usr/bin/env node
/**
 * Transform scraped CSV data from the Scraper folder into machines.js for the platform.
 */
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// ── CSV file paths ──
const CSV_FILES = [
  {
    path: "Scraper/machineseeker/food_processing/machineseeker_food_output/2026-02-15/listings.csv",
    sourceLabel: "Machineseeker",
    defaultCategory: "food_processing",
  },
  {
    path: "Scraper/machineseeker/print_and_paper/machineseeker_output/2026-02-15/listings.csv",
    sourceLabel: "Machineseeker",
    defaultCategory: "printing",
  },
  {
    path: "Scraper/papermachinetrading_de/scraper_output/2026-02-11/listings.csv",
    sourceLabel: "PaperMachineTrading",
    defaultCategory: "paper",
  },
];

// ── Category classification keywords ──
const FOOD_CATEGORY_KEYWORDS = {
  beverage: ["bottling", "bottl", "beverage", "brew", "brewhouse", "water khs", "filling machine", "bottle washer", "bottle inspector", "decrater", "crater", "retort"],
  meat: ["burger", "nugget", "fryer", "frying", "fish", "skinning", "tumbler", "batter", "enrober", "preduster", "pre-duster", "former for", "multifor", "speedbatcher", "stir fryer", "freezer", "tunnel freezer", "flowcook", "cookstar", "spiral oven"],
  dairy: ["cheese", "milk", "cream", "dairy", "edible oil", "oil refinery"],
  filling: ["filling", "filler", "pouch", "sealer", "vacuum", "dosing", "standardization"],
  packaging: ["wrapper", "packing", "packer", "conveyor", "tipper", "dolav", "washing machine", "container wash", "metal detector"],
  mixing: ["mixer", "mixing", "blending", "paddle", "process tank", "sieve", "vibrating"],
  bakery: ["pasta", "oven", "tunnel oven", "bread", "baking"],
};

// ── Condition normalization ──
function normalizeCondition(raw) {
  if (!raw) return "Good";
  const c = raw.toLowerCase().trim();
  if (c.includes("excellent")) return "Excellent";
  if (c.includes("like new")) return "Like New";
  if (c.includes("new") && !c.includes("used")) return "Like New";
  if (c.includes("ready for operation")) return "Good";
  if (c.includes("good")) return "Good";
  if (c.includes("fair")) return "Fair";
  return "Good"; // "used", empty, etc.
}

// ── Price parsing ──
function parsePrice(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (
    s === "" ||
    s.toLowerCase().includes("contact") ||
    s.toLowerCase().includes("newsletter") ||
    s.toLowerCase().includes("request") ||
    s.toLowerCase().includes("new price")
  )
    return null;
  // Remove currency symbols, spaces, and parse
  const cleaned = s.replace(/[€$£\s]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── Year parsing ──
function parseYear(raw) {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 1900 || n > 2030 ? null : n;
}

// ── Classify food processing machine into sub-category ──
function classifyFoodCategory(title, description) {
  const text = `${title} ${description || ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(FOOD_CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "filling"; // default food sub-category
}

// ── HS Code & customs duty mapping ──
const HS_CODE_MAP = {
  beverage: { hsCode: "8422.30", duty: 7.5 },
  meat: { hsCode: "8438.50", duty: 7.5 },
  dairy: { hsCode: "8434.20", duty: 7.5 },
  filling: { hsCode: "8422.30", duty: 7.5 },
  packaging: { hsCode: "8422.40", duty: 7.5 },
  mixing: { hsCode: "8438.80", duty: 7.5 },
  bakery: { hsCode: "8438.10", duty: 7.5 },
  printing: { hsCode: "8443.39", duty: 7.5 },
  paper: { hsCode: "8439.20", duty: 7.5 },
};

// ── Emoji mapping ──
const EMOJI_MAP = {
  beverage: "\uD83E\uDD64",
  meat: "\uD83E\uDD69",
  dairy: "\uD83E\uDD5B",
  filling: "\uD83E\uDED9",
  packaging: "\uD83D\uDCE6",
  mixing: "\uD83D\uDD04",
  bakery: "\uD83C\uDF5E",
  printing: "\uD83D\uDDA8\uFE0F",
  paper: "\uD83D\uDCC4",
};

// ── Main transform ──
function transformAll() {
  const allMachines = [];
  let idCounter = 1;

  for (const csvDef of CSV_FILES) {
    const csvPath = path.resolve(__dirname, csvDef.path);
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV not found: ${csvPath}`);
      continue;
    }
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    for (const row of parsed.data) {
      const title = (row.title || "").trim();
      if (!title) continue;

      // Determine category
      let category;
      if (csvDef.defaultCategory === "food_processing") {
        category = classifyFoodCategory(title, row.description);
      } else {
        category = csvDef.defaultCategory;
      }

      // Extract brand (manufacturer field)
      const brand = (row.manufacturer || "").trim() || "Unknown";

      // Condition
      const condition = normalizeCondition(row.condition);

      // Price
      const price = parsePrice(row.price);

      // Year
      const year = parseYear(row.year);

      // Location - clean up
      let location = (row.location || "").trim();
      // Remove leading commas/spaces
      location = location.replace(/^[,\s]+/, "").trim();
      if (!location) location = "Europe";

      // HS code & duty
      const { hsCode, duty } = HS_CODE_MAP[category] || { hsCode: "8479.89", duty: 7.5 };

      // Build specs from model and functionality
      const specs = {};
      const model = (row.model || "").trim();
      if (model) specs.model = model;
      const functionality = (row.functionality || "").trim();
      if (functionality) specs.functionality = functionality;

      // Description
      let description = (row.description || "").trim();
      if (!description) {
        description = `${brand} ${title}. ${condition} condition, sourced from ${csvDef.sourceLabel}.`;
      }
      // Clean multiline descriptions for JS
      description = description.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

      // Source URL
      const url = (row.url || "").trim();

      // Image URL — use scraped image from public/machines/{originalId}.jpg
      const originalId = (row.id || "").trim();
      const imageUrl = originalId ? `/machines/${originalId}.jpg` : "";

      const machine = {
        id: idCounter++,
        name: title,
        category,
        brand,
        year,
        condition,
        price,
        location,
        source: csvDef.sourceLabel,
        image: EMOJI_MAP[category] || "\u2699\uFE0F",
        imageUrl,
        specs,
        description,
        hsCode,
        customsDuty: duty,
        url,
      };

      allMachines.push(machine);
    }
  }

  return allMachines;
}

// ── Generate machines.js ──
const machines = transformAll();

const header = `// Auto-generated from Scraper data — ${machines.length} real machines
// Sources: Machineseeker (Food Processing), Machineseeker (Print & Paper), PaperMachineTrading.de
// Generated: ${new Date().toISOString().split("T")[0]}
export const MACHINES = `;

const output = header + JSON.stringify(machines, null, 2) + ";\n";
const outPath = path.resolve(__dirname, "app/src/data/machines.js");
fs.writeFileSync(outPath, output, "utf-8");

console.log(`✓ Generated ${machines.length} machines → ${outPath}`);

// Print category breakdown
const catCounts = {};
for (const m of machines) {
  catCounts[m.category] = (catCounts[m.category] || 0) + 1;
}
console.log("\nCategory breakdown:");
for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}

// Print source breakdown
const srcCounts = {};
for (const m of machines) {
  srcCounts[m.source] = (srcCounts[m.source] || 0) + 1;
}
console.log("\nSource breakdown:");
for (const [src, count] of Object.entries(srcCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src}: ${count}`);
}
