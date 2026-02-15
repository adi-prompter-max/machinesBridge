import fs from "fs";
import Papa from "papaparse";

const csv = fs.readFileSync("mock_machines.csv", "utf8");
const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

// German category → app category
const CATEGORY_MAP = {
  // meat
  "Fleischverarbeitungsmaschinen": "meat",
  "Fischverarbeitungsmaschinen": "meat",
  "Räucheranlagen": "meat",
  // dairy
  "Milch & Milchprodukte": "dairy",
  "Dekanter": "dairy",
  "Molkereianlagen": "dairy",
  "Separatoren für Lebensmittel": "dairy",
  "Eismaschinen": "dairy",
  // bakery
  "Bäckereimaschinen": "bakery",
  "Süßwarenmaschinen": "bakery",
  "Pastamaschinen": "bakery",
  // beverage
  "Getränkemaschinen": "beverage",
  "Getränkeautomaten": "beverage",
  "Brauereianlagen": "beverage",
  "Kaffee-, Tee- & Tabakmaschinen": "beverage",
  // packaging
  "Verpackungsmaschinen": "packaging",
  "Kühlanlagen für Lebensmittel": "packaging",
  "Trockner für Lebensmittel": "packaging",
  "Waagen (Lebensmittel)": "packaging",
  "Lagerung & Handhabung": "packaging",
  "Kartoffelchipsherstellungsmaschinen": "packaging",
  // mixing
  "Mischanlagen": "mixing",
  "Kochkessel": "mixing",
  "Mühlen für Lebensmittel": "mixing",
  "Getreideverarbeitung": "mixing",
  "Pulverherstellung & Verarbeitung": "mixing",
  "Siebanlagen für Lebensmittel": "mixing",
  "Sonstige Lebensmitteltechnik": "mixing",
  "Labortechnik für Lebensmittel": "mixing",
  "Anschlagmaschinen": "mixing",
  "Mengenmaschinen": "mixing",
  "Ölherstellung": "mixing",
  "Fettherstellung & Verarbeitung": "mixing",
  // filling
  "Filter (Lebensmitteltechnik)": "filling",
  "Pumpen (Lebensmitteltechnik)": "filling",
  "Reinigungstechnik": "filling",
  "Gastronomiemaschinen & -Geräte": "filling",
  "Küchentechnik": "filling",
  "Obstverarbeitung & Gemüseverarbeitung": "filling",
  "Maschinen für Feinkost": "filling",
};

// Condition mapping
function mapCondition(cond) {
  if (!cond) return "Fair";
  const c = cond.toLowerCase();
  if (c.includes("sehr gut") || c.includes("neu") || c === "neuwertig") return "Excellent";
  if (c.includes("gut") || c === "gebraucht" || c === "überholt") return "Good";
  return "Fair";
}

// Emoji by category
const EMOJI_MAP = {
  filling: "\u{1FAD9}",   // 🫙
  packaging: "\u{1F4E6}", // 📦
  mixing: "\u{1F504}",    // 🔄
  bakery: "\u{1F35E}",    // 🍞
  dairy: "\u{1F95B}",     // 🥛
  meat: "\u{1F969}",      // 🥩
  beverage: "\u{1F964}",  // 🥤
};

// HS code + duty by category
const HS_MAP = {
  filling: { hsCode: "8422.30", duty: 7.5 },
  packaging: { hsCode: "8422.40", duty: 7.5 },
  mixing: { hsCode: "8438.80", duty: 7.5 },
  bakery: { hsCode: "8438.10", duty: 7.5 },
  dairy: { hsCode: "8434.20", duty: 7.5 },
  meat: { hsCode: "8438.50", duty: 7.5 },
  beverage: { hsCode: "8422.30", duty: 7.5 },
};

// Real Unsplash images per category (4 each for variety)
const IMAGE_POOL = {
  filling: [
    "https://plus.unsplash.com/premium_photo-1663045337142-aed6c496ccbc?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1763256340688-cbd3614c9a56?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1758522965224-7a69eedbad8a?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1767814984749-afb88afca4d7?w=600&h=400&fit=crop&auto=format",
  ],
  packaging: [
    "https://plus.unsplash.com/premium_photo-1682144489819-d5efccb05721?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1764745021344-317b80f09e40?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1755937303351-57ad0f70f773?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1730705788367-dbd288c40ee7?w=600&h=400&fit=crop&auto=format",
  ],
  mixing: [
    "https://plus.unsplash.com/premium_photo-1761846736549-27842d888eca?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1575215913471-52cde4fb8a6e?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1730401996604-61114d4a953e?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1583145326503-e8257db257d2?w=600&h=400&fit=crop&auto=format",
  ],
  bakery: [
    "https://plus.unsplash.com/premium_photo-1663047600157-3d042098e0f3?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1703607888337-aae6d77b3d83?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1738717201678-412395e65b36?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1591482862924-b98dbf239e8f?w=600&h=400&fit=crop&auto=format",
  ],
  dairy: [
    "https://plus.unsplash.com/premium_photo-1682145514902-59f426028d65?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1580686954168-b08d0309d203?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1523473827533-2a64d0d36748?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1649715985821-9a25b85bfc83?w=600&h=400&fit=crop&auto=format",
  ],
  meat: [
    "https://plus.unsplash.com/premium_photo-1682129520075-6e97df4cba3f?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1656711858987-1956a99f646a?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1699841669442-d13df0725af3?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1640503006343-1614ff8b15f5?w=600&h=400&fit=crop&auto=format",
  ],
  beverage: [
    "https://plus.unsplash.com/premium_photo-1663036488065-e72992044d62?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1545287072-469f3761413c?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1689348745037-21adeb31dd2a?w=600&h=400&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1586962371016-e47edc9834c6?w=600&h=400&fit=crop&auto=format",
  ],
};

// Track per-category index for image cycling
const catImageIndex = {};
function getImageUrl(cat) {
  const pool = IMAGE_POOL[cat];
  if (!pool) return null;
  if (!(cat in catImageIndex)) catImageIndex[cat] = 0;
  const url = pool[catImageIndex[cat] % pool.length];
  catImageIndex[cat]++;
  return url;
}

// Source names to cycle through
const SOURCES = ["Maschinensucher", "TradeMachines", "Surplex", "Machinio"];

// German machine type → English
const TITLE_MAP = {
  "Verarbeitungsanlage": "Processing Line",
  "Produktionsmaschine": "Production Machine",
  "Fertigungsmaschine": "Manufacturing Machine",
  "Prozessanlage": "Processing Plant",
  "Industriemaschine": "Industrial Machine",
  "Konvektomat": "Combi Oven",
  "Schneidemaschine": "Cutting Machine",
  "Pasteur": "Pasteurizer",
  "Intensivmischer": "Intensive Mixer",
  "Pflugscharmischer": "Ploughshare Mixer",
  "Schlauchbeutelmaschine": "Flow Wrapper",
  "Separator": "Separator",
  "Schockfroster": "Blast Chiller",
  "Kippkochkessel": "Tilting Kettle",
  "Sprühtrockner": "Spray Dryer",
  "Verschließer": "Sealing Machine",
  "Waschmaschine": "Washing Machine",
  "Gefriertunnel": "Freezing Tunnel",
  "Maischebottich": "Mash Tun",
  "Wirbelschichttrockner": "Fluid Bed Dryer",
  "Membranfilter": "Membrane Filter",
  "Kühlzelle": "Cold Room",
  "Zentrifugaldekanter": "Centrifugal Decanter",
  "Teigteiler": "Dough Divider",
  "Mehrkopfwaage": "Multihead Weigher",
  "Druckfilter": "Pressure Filter",
  "Langwirkmaschine": "Long Moulder",
  "Planetenrührer": "Planetary Mixer",
  "CIP-Anlage": "CIP System",
  "Temperiermaschine": "Tempering Machine",
  "Schälmaschine": "Peeling Machine",
  "Überziehmaschine": "Enrober",
  "Geschirrspüler": "Dishwasher",
  "Membranpumpe": "Diaphragm Pump",
  "Schläger": "Beater",
  "Gärschrank": "Proofing Cabinet",
  "Spiralkneter": "Spiral Kneader",
  "Paddelmischer": "Paddle Mixer",
  "Homogenisator": "Homogenizer",
  "Konusmischer": "Conical Mixer",
  "Walzentrockner": "Drum Dryer",
  "Stikkenofen": "Rack Oven",
  "2-Phasen-Dekanter": "2-Phase Decanter",
  "Clipmaschine": "Clipping Machine",
  "Desinfektionsanlage": "Sanitizing System",
  "Entschwartungsmaschine": "Derinding Machine",
  "Kreiselpumpe": "Centrifugal Pump",
  "Passiermaschine": "Strainer",
  "Drehkolbenpumpe": "Rotary Lobe Pump",
  "Mogulanlage": "Mogul Plant",
  "Kartonierer": "Cartoner",
  "Bandfilter": "Belt Filter",
  "Kühltunnel": "Cooling Tunnel",
  "Kombinationswaage": "Combination Weigher",
  "Eiscrusher": "Ice Crusher",
  "Etikettiermaschine": "Labeling Machine",
  "Käsefertiger": "Cheese Vat",
  "Tiefziehverpackungsmaschine": "Thermoformer",
  "Aufschlagmaschine": "Whipping Machine",
  "Walzwerk": "Roller Mill",
  "Fleischwolf": "Meat Grinder",
  "Zahnradpumpe": "Gear Pump",
  "Gefriertrockner": "Freeze Dryer",
  "Salamander": "Salamander Grill",
  "Würfelschneider": "Dicer",
  "Schlagmaschine": "Beating Machine",
  "Etikettierer": "Labeler",
  "Brötchenpresse": "Bun Press",
  "Eismaschine": "Ice Cream Machine",
  "Kutter": "Bowl Cutter",
  "Hochdruckreiniger": "Pressure Washer",
  "3-Phasen-Dekanter": "3-Phase Decanter",
  "Exzenterschneckenpumpe": "Progressive Cavity Pump",
  "Bandtrockner": "Belt Dryer",
  "Rührkochkessel": "Stirring Kettle",
  "Mischer": "Mixer",
  "Abfüllanlage": "Filling Line",
  "Dampfkochkessel": "Steam Kettle",
  "Plattenfilter": "Plate Filter",
  "Conche": "Conche",
  "Vakuumierer": "Vacuum Sealer",
  "Kombidämpfer": "Combi Steamer",
  "Brauanlage": "Brewing System",
  "Vakuumkocher": "Vacuum Cooker",
  "Sägemaschine": "Sawing Machine",
  "Füllmaschine": "Filling Machine",
  "Plattformwaage": "Platform Scale",
  "Entsafter": "Juicer",
  "Gärtank": "Fermentation Tank",
  "Speiseeisbereiter": "Ice Cream Maker",
  "Plattenkühler": "Plate Cooler",
  "Würzepfanne": "Wort Kettle",
  "Kerzenfilter": "Candle Filter",
  "Läuterbottich": "Lauter Tun",
  "Sudhaus": "Brewhouse",
  "Dekanter": "Decanter",
  "Kontrollwaage": "Checkweigher",
  "Rinser": "Rinser",
  "Dosierbandwaage": "Belt Feeder Scale",
};

// German country → English
const COUNTRY_MAP = {
  "Deutschland": "Germany",
  "Italien": "Italy",
  "Schweiz": "Switzerland",
  "Österreich": "Austria",
  "Spanien": "Spain",
  "Belgien": "Belgium",
  "Niederlande": "Netherlands",
  "Polen": "Poland",
  "Frankreich": "France",
  "Tschechien": "Czech Republic",
  "Dänemark": "Denmark",
  "Schweden": "Sweden",
};

function translateTitle(title) {
  if (!title) return title;
  for (const [de, en] of Object.entries(TITLE_MAP)) {
    if (title.startsWith(de + " ")) {
      return en + " " + title.slice(de.length + 1);
    }
    if (title === de) return en;
  }
  return title;
}

function translateLocation(loc) {
  if (!loc) return "Germany";
  let cleaned = loc.replace(/"/g, "");
  for (const [de, en] of Object.entries(COUNTRY_MAP)) {
    cleaned = cleaned.replace(de, en);
  }
  return cleaned;
}

function buildDescription(row, englishName, condition) {
  const brand = row.manufacturer || "Unknown";
  const model = row.model || "";
  const cat = CATEGORY_MAP[row.category] || "mixing";

  const CATEGORY_LABELS = {
    meat: "meat processing",
    dairy: "dairy processing",
    bakery: "bakery & confectionery",
    beverage: "beverage production",
    packaging: "packaging & storage",
    mixing: "mixing & processing",
    filling: "filling & filtration",
  };
  const catLabel = CATEGORY_LABELS[cat] || "food processing";

  const condPhrases = {
    Excellent: "in excellent condition, fully tested and operational",
    Good: "in good working condition, regularly maintained",
    Fair: "in fair condition, suitable for reconditioning",
  };
  const condPhrase = condPhrases[condition] || condPhrases.Good;

  const templates = [
    `${englishName} by ${brand}${model ? " (Model: " + model + ")" : ""}. This ${catLabel} machine is ${condPhrase}. Available for immediate inspection and shipping.`,
    `${brand}${model ? " " + model : ""} — ${englishName}. Category: ${catLabel}. ${condition} condition. Ready for dispatch from warehouse.`,
    `We offer a ${englishName} from ${brand}${model ? ", model " + model : ""}. The machine is ${condPhrase}. Spare parts available.`,
    `${englishName} — ${brand}${model ? " " + model : ""}. This ${catLabel} equipment is ${condPhrase}. Can be inspected on site.`,
    `${brand} ${englishName}${model ? " (" + model + ")" : ""}. Industrial-grade ${catLabel} equipment, ${condPhrase}. All functions verified.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function parsePrice(priceStr) {
  if (!priceStr || priceStr === "Preisinfo") return null;
  // German format: dots as thousands separators (e.g. "6.029" = 6029)
  const cleaned = priceStr.replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function buildSpecs(row) {
  const specs = {};
  if (row.dimensions && row.dimensions.trim()) {
    specs.dimensions = row.dimensions.trim();
  }
  if (row.weight && row.weight.trim()) {
    specs.weight = row.weight.trim();
  }
  if (row.electrical && row.electrical.trim()) {
    const elec = row.electrical.trim();
    const voltMatch = elec.match(/Spannung:\s*([^;]+)/);
    const powerMatch = elec.match(/Leistung:\s*([^;]+)/);
    if (voltMatch) specs.voltage = voltMatch[1].trim();
    if (powerMatch) specs.power = powerMatch[1].trim();
  }
  // Ensure at least one spec
  if (Object.keys(specs).length === 0) {
    specs.type = "Industrial";
  }
  return specs;
}

const machines = data
  .filter((row) => row.title && row.category)
  .map((row, i) => {
    const cat = CATEGORY_MAP[row.category] || "mixing";
    const hs = HS_MAP[cat];
    const condition = mapCondition(row.condition);
    const englishName = translateTitle(row.title);
    return {
      id: i + 1,
      name: englishName,
      category: cat,
      brand: row.manufacturer || "Unknown",
      year: row.year ? parseInt(row.year, 10) : null,
      condition,
      price: parsePrice(row.price),
      location: translateLocation(row.location),
      source: SOURCES[i % SOURCES.length],
      image: EMOJI_MAP[cat],
      imageUrl: getImageUrl(cat),
      specs: buildSpecs(row),
      description: buildDescription(row, englishName, condition),
      hsCode: hs.hsCode,
      customsDuty: hs.duty,
    };
  });

const output = `// Auto-generated from mock_machines.csv — ${machines.length} machines
export const MACHINES = ${JSON.stringify(machines, null, 2)};
`;

fs.writeFileSync("app/src/data/machines.js", output);
console.log(`Wrote ${machines.length} machines to app/src/data/machines.js`);
