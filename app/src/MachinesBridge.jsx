import { useState, useEffect } from "react";
import { MACHINES } from "./data/machines.js";

const EXCHANGE_RATE_EUR_INR = 89.5;
const ITEMS_PER_PAGE = 24;

const CATEGORIES = [
  { id: "all", label: "All Machines", icon: "\u2699\uFE0F" },
  { id: "filling", label: "Filling & Dosing", icon: "\uD83E\uDED9" },
  { id: "packaging", label: "Packaging", icon: "\uD83D\uDCE6" },
  { id: "mixing", label: "Mixing & Blending", icon: "\uD83D\uDD04" },
  { id: "bakery", label: "Bakery Equipment", icon: "\uD83C\uDF5E" },
  { id: "dairy", label: "Dairy Processing", icon: "\uD83E\uDD5B" },
  { id: "meat", label: "Meat Processing", icon: "\uD83E\uDD69" },
  { id: "beverage", label: "Beverage", icon: "\uD83E\uDD64" },
];

const CONDITIONS = ["Excellent", "Good", "Fair"];

const INDIAN_PORTS = [
  { name: "Nhava Sheva (Mumbai)", freight: 2800 },
  { name: "Chennai", freight: 3100 },
  { name: "Mundra (Gujarat)", freight: 2600 },
  { name: "Kolkata", freight: 3400 },
  { name: "Cochin", freight: 3200 },
];

const formatEUR = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const formatINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function calculateLandedCost(priceEUR, port, customsDuty) {
  const priceINR = priceEUR * EXCHANGE_RATE_EUR_INR;
  const freightINR = port.freight * EXCHANGE_RATE_EUR_INR;
  const insuranceINR = (priceINR + freightINR) * 0.008;
  const cifINR = priceINR + freightINR + insuranceINR;
  const dutyINR = cifINR * (customsDuty / 100);
  const gstINR = (cifINR + dutyINR) * 0.18;
  const clearingINR = 35000;
  const totalINR = cifINR + dutyINR + gstINR + clearingINR;
  return { priceINR, freightINR, insuranceINR, cifINR, dutyINR, gstINR, clearingINR, totalINR };
}

function MachineImage({ src, fallback, style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span style={{ fontSize: "3.5rem" }}>{fallback}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}

function Header({ searchQuery, setSearchQuery, showAISearch, setShowAISearch, totalCount }) {
  return (
    <header style={s.header}>
      <div style={s.headerInner} className="header-inner">
        <div style={s.logoArea}>
          <div style={s.logoMark}>MB</div>
          <div>
            <h1 style={s.logoText}>MachinesBridge</h1>
            <p style={s.tagline}>German Machines → Indian Factories</p>
          </div>
        </div>
        <div style={s.searchArea} className="search-area">
          <div style={s.searchBox}>
            <span style={s.searchIcon}>⌕</span>
            <input type="text" placeholder="Search machines, brands, categories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={s.searchInput} />
          </div>
          <button style={{ ...s.aiButton, ...(showAISearch ? s.aiButtonActive : {}) }} onClick={() => setShowAISearch(!showAISearch)}>✦ AI Search</button>
        </div>
        <div style={s.headerStats} className="header-stats">
          <div style={s.statPill}><span style={s.statNum}>{totalCount}</span> Machines</div>
          <div style={s.statPill}><span style={s.statNum}>4</span> Sources</div>
          <div style={s.statPill} className="live-rates-pill"><span style={s.liveDot} />Live Rates</div>
        </div>
      </div>
    </header>
  );
}

function AISearchBar({ onResult }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const handleSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const q = query.toLowerCase();
      let matched = MACHINES.filter((m) => { const text = `${m.name} ${m.category} ${m.brand} ${m.description}`.toLowerCase(); return q.split(" ").some((word) => text.includes(word)); });
      if (matched.length === 0) matched = MACHINES.slice(0, 3);
      setResult({ summary: `Found ${matched.length} machines matching "${query}". Ranked by relevance to your requirements.`, ids: matched.map((m) => m.id) });
      onResult(matched.map((m) => m.id));
      setLoading(false);
    }, 1200);
  };
  return (
    <div style={s.aiSearchBar}>
      <div style={s.aiSearchHeader}><span style={s.aiSparkle}>✦</span><span style={s.aiTitle}>Describe what you need in plain language</span></div>
      <div style={s.aiInputRow} className="ai-input-row">
        <input type="text" placeholder='e.g. "I need a packaging machine for spice packets under ₹50 lakh"' value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} style={s.aiInput} />
        <button onClick={handleSearch} style={s.aiGoButton} disabled={loading}>{loading ? "Searching..." : "Find Machines →"}</button>
      </div>
      {result && <div style={s.aiResult}><span style={s.aiResultIcon}>✦</span> {result.summary}</div>}
    </div>
  );
}

function CategoryBar({ selected, setSelected }) {
  return (
    <div style={s.categoryBar} className="category-bar">
      {CATEGORIES.map((cat) => (
        <button key={cat.id} onClick={() => setSelected(cat.id)} style={{ ...s.categoryPill, ...(selected === cat.id ? s.categoryPillActive : {}) }}><span>{cat.icon}</span> {cat.label}</button>
      ))}
    </div>
  );
}

function Filters({ priceRange, setPriceRange, yearRange, setYearRange, conditionFilter, setConditionFilter }) {
  return (
    <div style={s.filtersRow} className="filters-row">
      <div style={s.filterGroup} className="filter-group">
        <label style={s.filterLabel}>Budget (EUR)</label>
        <div style={s.filterInputs} className="filter-inputs">
          <input type="number" placeholder="Min" value={priceRange[0] || ""} onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])} style={s.filterInput} className="filter-input" />
          <span style={s.filterDash}>-</span>
          <input type="number" placeholder="Max" value={priceRange[1] || ""} onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} style={s.filterInput} className="filter-input" />
        </div>
      </div>
      <div style={s.filterGroup} className="filter-group">
        <label style={s.filterLabel}>Year</label>
        <div style={s.filterInputs} className="filter-inputs">
          <input type="number" placeholder="From" value={yearRange[0] || ""} onChange={(e) => setYearRange([Number(e.target.value), yearRange[1]])} style={s.filterInput} className="filter-input" />
          <span style={s.filterDash}>-</span>
          <input type="number" placeholder="To" value={yearRange[1] || ""} onChange={(e) => setYearRange([yearRange[0], Number(e.target.value)])} style={s.filterInput} className="filter-input" />
        </div>
      </div>
      <div style={s.filterGroup} className="filter-group">
        <label style={s.filterLabel}>Condition</label>
        <div style={s.conditionButtons} className="condition-buttons">
          {CONDITIONS.map((c) => (
            <button key={c} onClick={() => setConditionFilter(conditionFilter === c ? null : c)} style={{ ...s.conditionBtn, ...(conditionFilter === c ? s.conditionBtnActive : {}) }}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MachineCard({ machine, onSelect, isHighlighted }) {
  const hasPrice = machine.price != null;
  const estimatedINR = hasPrice ? machine.price * EXCHANGE_RATE_EUR_INR : null;
  const conditionColor = machine.condition === "Excellent" ? "var(--excellent)" : machine.condition === "Good" ? "var(--good)" : "var(--fair)";
  return (
    <div style={{ ...s.card, ...(isHighlighted ? s.cardHighlighted : {}) }} onClick={() => onSelect(machine)}>
      <div style={s.cardImageArea} className="card-image-area">
        <MachineImage src={machine.imageUrl} fallback={machine.image} />
        <div style={s.cardSource}>{machine.source}</div>
      </div>
      <div style={s.cardBody}>
        <div style={s.cardMeta}>
          <span style={{ ...s.conditionBadge, backgroundColor: conditionColor, color: "var(--primary-foreground)" }}>{machine.condition}</span>
          {machine.year && <span style={s.yearBadge}>{machine.year}</span>}
        </div>
        <h3 style={s.cardTitle}>{machine.name}</h3>
        <p style={s.cardBrand}>{machine.brand} · {machine.location}</p>
        <div style={s.cardSpecs}>
          {Object.entries(machine.specs).slice(0, 2).map(([k, v]) => (<span key={k} style={s.specChip}>{v}</span>))}
        </div>
        <div style={s.cardPricing} className="card-pricing">
          <div>
            {hasPrice ? (
              <>
                <div style={s.priceEUR}>{formatEUR(machine.price)}</div>
                <div style={s.priceINR}>≈ {formatINR(estimatedINR)}</div>
              </>
            ) : (
              <div style={s.priceEUR}>Price on request</div>
            )}
          </div>
          {hasPrice && <button style={s.calcButton} className="calc-button">Calculate Landed Cost →</button>}
        </div>
      </div>
    </div>
  );
}

function MachineDetail({ machine, onClose }) {
  const [selectedPort, setSelectedPort] = useState(INDIAN_PORTS[0]);
  const hasPrice = machine.price != null;
  const landed = hasPrice ? calculateLandedCost(machine.price, selectedPort, machine.customsDuty) : null;
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.detailPanel} className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
        <div style={s.detailImageArea} className="detail-image-area">
          <MachineImage src={machine.imageUrl} fallback={machine.image} style={{ borderRadius: "var(--radius)" }} />
        </div>
        <div style={s.detailHeader}>
          <div>
            <h2 style={s.detailTitle}>{machine.name}</h2>
            <p style={s.detailSub}>{machine.brand} · {machine.year || "N/A"} · {machine.condition} · {machine.location}</p>
          </div>
        </div>
        <p style={s.detailDesc}>{machine.description}</p>
        <div style={s.specsGrid}>
          {Object.entries(machine.specs).map(([k, v]) => (<div key={k} style={s.specItem}><div style={s.specLabel}>{k}</div><div style={s.specValue}>{v}</div></div>))}
          <div style={s.specItem}><div style={s.specLabel}>HS Code</div><div style={s.specValue}>{machine.hsCode}</div></div>
          <div style={s.specItem}><div style={s.specLabel}>Source</div><div style={s.specValue}>{machine.source}</div></div>
        </div>
        {hasPrice && landed ? (
          <div style={s.landedCostSection}>
            <h3 style={s.landedTitle}>Landed Cost Estimator</h3>
            <div style={s.portSelector}>
              <label style={s.portLabel}>Destination Port:</label>
              <select value={selectedPort.name} onChange={(e) => setSelectedPort(INDIAN_PORTS.find((p) => p.name === e.target.value))} style={s.portSelect}>
                {INDIAN_PORTS.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}
              </select>
            </div>
            <div style={s.costBreakdown}>
              <CostRow label="Machine Price (FOB)" value={landed.priceINR} />
              <CostRow label={`Sea Freight → ${selectedPort.name}`} value={landed.freightINR} />
              <CostRow label="Marine Insurance (0.8%)" value={landed.insuranceINR} />
              <CostRow label="CIF Value" value={landed.cifINR} bold />
              <div style={s.costDivider} />
              <CostRow label={`Customs Duty (${machine.customsDuty}%)`} value={landed.dutyINR} />
              <CostRow label="GST (18%)" value={landed.gstINR} />
              <CostRow label="Clearing & Forwarding" value={landed.clearingINR} />
              <div style={s.costDivider} />
              <CostRow label="Total Landed Cost" value={landed.totalINR} total />
            </div>
            <div style={s.disclaimer}>* Estimates based on current rates. Actual costs may vary. Exchange rate: 1 EUR = ₹{EXCHANGE_RATE_EUR_INR}</div>
          </div>
        ) : (
          <div style={s.landedCostSection}>
            <h3 style={s.landedTitle}>Landed Cost Estimator</h3>
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>Price not available — contact seller for a quote to calculate landed costs.</p>
          </div>
        )}
        <div style={s.actionRow} className="action-row">
          <button style={s.primaryAction}>Request Detailed Quote</button>
          <button style={s.secondaryAction}>Schedule Video Inspection</button>
        </div>
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, total }) {
  return (
    <div style={{ ...s.costRow, ...(total ? s.costRowTotal : {}) }}>
      <span style={{ fontWeight: bold || total ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold || total ? 700 : 400, fontSize: total ? "1.15rem" : undefined }}>{formatINR(value)}</span>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);
    pages.push(1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div style={s.pagination} className="pagination">
      <button style={{ ...s.pageBtn, ...(currentPage === 1 ? s.pageBtnDisabled : {}) }} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="page-btn">
        ← Prev
      </button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} style={s.pageDots}>...</span>
        ) : (
          <button key={p} style={{ ...s.pageBtn, ...(p === currentPage ? s.pageBtnActive : {}) }} onClick={() => onPageChange(p)} className="page-btn">
            {p}
          </button>
        )
      )}
      <button style={{ ...s.pageBtn, ...(currentPage === totalPages ? s.pageBtnDisabled : {}) }} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="page-btn">
        Next →
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer style={s.footer}>
      <div style={s.footerInner} className="footer-inner">
        <div style={s.footerCol}>
          <div style={s.footerLogo}><div style={s.logoMarkSmall}>MB</div><span style={s.footerBrand}>MachinesBridge</span></div>
          <p style={s.footerText}>Bridging German engineering with Indian manufacturing. Quality machines, transparent pricing, end-to-end support.</p>
        </div>
        <div style={s.footerCol}>
          <h4 style={s.footerHeading}>Services</h4>
          <p style={s.footerLink}>Machine Sourcing</p>
          <p style={s.footerLink}>Video Inspections</p>
          <p style={s.footerLink}>Logistics & Shipping</p>
          <p style={s.footerLink}>Customs & Compliance</p>
        </div>
        <div style={s.footerCol}>
          <h4 style={s.footerHeading}>Contact</h4>
          <p style={s.footerLink}>info@machinesbridge.com</p>
          <p style={s.footerLink}>+49 (0) 40 XXXX XXXX</p>
          <p style={s.footerLink}>Hamburg, Germany</p>
        </div>
      </div>
    </footer>
  );
}

export default function MachinesBridge() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [yearRange, setYearRange] = useState([0, 0]);
  const [conditionFilter, setConditionFilter] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showAISearch, setShowAISearch] = useState(false);
  const [aiHighlightIds, setAiHighlightIds] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => setMounted(true), []);

  const filtered = MACHINES.filter((m) => {
    if (category !== "all" && m.category !== category) return false;
    if (searchQuery) { const q = searchQuery.toLowerCase(); const text = `${m.name} ${m.brand} ${m.category} ${m.description}`.toLowerCase(); if (!text.includes(q)) return false; }
    if (priceRange[0] && m.price != null && m.price < priceRange[0]) return false;
    if (priceRange[1] && m.price != null && m.price > priceRange[1]) return false;
    if (priceRange[0] && m.price == null) return false;
    if (priceRange[1] && m.price == null) return false;
    if (yearRange[0] && m.year && m.year < yearRange[0]) return false;
    if (yearRange[1] && m.year && m.year > yearRange[1]) return false;
    if (conditionFilter && m.condition !== conditionFilter) return false;
    return true;
  });

  const sorted = aiHighlightIds.length > 0
    ? [...filtered].sort((a, b) => (aiHighlightIds.includes(a.id) ? 0 : 1) - (aiHighlightIds.includes(b.id) ? 0 : 1))
    : filtered;

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paged = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, category, priceRange, yearRange, conditionFilter]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ ...s.app, opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} showAISearch={showAISearch} setShowAISearch={setShowAISearch} totalCount={MACHINES.length} />
      <main style={s.main}>
        {showAISearch && <AISearchBar onResult={setAiHighlightIds} />}
        <CategoryBar selected={category} setSelected={setCategory} />
        <Filters priceRange={priceRange} setPriceRange={setPriceRange} yearRange={yearRange} setYearRange={setYearRange} conditionFilter={conditionFilter} setConditionFilter={setConditionFilter} />
        <div style={s.resultsHeader}>
          <span style={s.resultsCount}>{sorted.length} machines found{totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : ""}</span>
          {aiHighlightIds.length > 0 && <button onClick={() => setAiHighlightIds([])} style={s.clearAI}>Clear AI ranking ✕</button>}
        </div>
        <div style={s.grid} className="machines-grid">
          {paged.map((m) => (<MachineCard key={m.id} machine={m} onSelect={setSelectedMachine} isHighlighted={aiHighlightIds.includes(m.id)} />))}
        </div>
        {sorted.length === 0 && (
          <div style={s.emptyState}>
            <span style={{ fontSize: "3rem" }}>🔍</span>
            <h3 style={{ fontSize: "1.25rem", marginTop: "1rem", color: "var(--foreground)" }}>No machines match your filters</h3>
            <p style={{ color: "var(--muted-foreground)", marginTop: "0.5rem" }}>Try adjusting your search or filters</p>
          </div>
        )}
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={handlePageChange} />
      </main>
      <Footer />
      {selectedMachine && <MachineDetail machine={selectedMachine} onClose={() => setSelectedMachine(null)} />}
    </div>
  );
}

const s = {
  app: { fontFamily: "var(--font-sans)", background: "var(--background)", minHeight: "100vh", color: "var(--foreground)" },

  // Header
  header: { background: "var(--header-bg)", borderBottom: "3px solid var(--primary)", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { maxWidth: "1280px", margin: "0 auto", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" },
  logoArea: { display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 },
  logoMark: { width: "42px", height: "42px", background: "var(--accent)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1rem", color: "var(--accent-foreground)" },
  logoText: { fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: "var(--header-fg)", lineHeight: 1.1 },
  tagline: { fontSize: "0.7rem", color: "var(--accent)", fontWeight: 500, letterSpacing: "0.05em" },
  searchArea: { flex: 1, display: "flex", gap: "0.5rem", minWidth: "280px" },
  searchBox: { flex: 1, position: "relative" },
  searchIcon: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "1.1rem", color: "var(--header-stat-fg)" },
  searchInput: { width: "100%", padding: "0.65rem 1rem 0.65rem 2.25rem", border: "2px solid var(--header-input-border)", borderRadius: "var(--radius)", background: "var(--header-input-bg)", color: "var(--header-fg)", fontSize: "0.9rem", fontFamily: "var(--font-sans)" },
  aiButton: { padding: "0.65rem 1rem", background: "transparent", border: "2px solid var(--accent)", borderRadius: "var(--radius)", color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" },
  aiButtonActive: { background: "var(--accent)", color: "var(--accent-foreground)" },
  headerStats: { display: "flex", gap: "0.75rem", flexShrink: 0, alignItems: "center" },
  statPill: { display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem", background: "var(--header-stat-bg)", borderRadius: "20px", fontSize: "0.75rem", color: "var(--header-stat-fg)", fontWeight: 500 },
  statNum: { color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 700 },
  liveDot: { width: "6px", height: "6px", borderRadius: "50%", background: "var(--excellent)" },

  // Main
  main: { maxWidth: "1280px", margin: "0 auto", padding: "1.5rem" },

  // AI Search
  aiSearchBar: { background: "var(--secondary)", borderRadius: "calc(var(--radius) + 4px)", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid var(--border)" },
  aiSearchHeader: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" },
  aiSparkle: { color: "var(--primary)", fontSize: "1.2rem" },
  aiTitle: { color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 500 },
  aiInputRow: { display: "flex", gap: "0.5rem" },
  aiInput: { flex: 1, padding: "0.75rem 1rem", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--foreground)", fontSize: "0.9rem", fontFamily: "var(--font-sans)" },
  aiGoButton: { padding: "0.75rem 1.25rem", background: "var(--primary)", border: "none", borderRadius: "var(--radius)", color: "var(--primary-foreground)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", whiteSpace: "nowrap" },
  aiResult: { marginTop: "0.75rem", padding: "0.75rem 1rem", background: "var(--accent)", borderRadius: "var(--radius)", color: "var(--accent-foreground)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  aiResultIcon: { fontSize: "1rem" },

  // Categories
  categoryBar: { display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1rem" },
  categoryPill: { padding: "0.5rem 1rem", background: "var(--secondary)", border: "2px solid transparent", borderRadius: "24px", fontFamily: "var(--font-sans)", fontSize: "0.8rem", fontWeight: 500, color: "var(--secondary-foreground)", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.35rem", transition: "all 0.2s" },
  categoryPillActive: { background: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--ring)" },

  // Filters
  filtersRow: { display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap", padding: "1rem 1.25rem", background: "var(--muted)", borderRadius: "calc(var(--radius) + 2px)", border: "1px solid var(--border)" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  filterLabel: { fontSize: "0.7rem", fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" },
  filterInputs: { display: "flex", alignItems: "center", gap: "0.35rem" },
  filterInput: { width: "100px", padding: "0.45rem 0.6rem", border: "1px solid var(--input)", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.85rem", fontFamily: "var(--font-sans)", background: "var(--background)", color: "var(--foreground)" },
  filterDash: { color: "var(--muted-foreground)", fontSize: "0.9rem" },
  conditionButtons: { display: "flex", gap: "0.35rem" },
  conditionBtn: { padding: "0.45rem 0.75rem", background: "var(--background)", border: "1px solid var(--input)", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.8rem", fontFamily: "var(--font-sans)", cursor: "pointer", color: "var(--foreground)", transition: "all 0.15s" },
  conditionBtnActive: { background: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" },

  // Results
  resultsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  resultsCount: { fontSize: "0.85rem", color: "var(--muted-foreground)", fontWeight: 500 },
  clearAI: { padding: "0.35rem 0.75rem", background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "calc(var(--radius) - 2px)", color: "var(--accent-foreground)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "var(--font-sans)" },

  // Grid & Cards
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" },
  card: { background: "var(--card)", borderRadius: "calc(var(--radius) + 4px)", overflow: "hidden", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.25s ease", boxShadow: "var(--shadow-sm)" },
  cardHighlighted: { border: "2px solid var(--ring)", boxShadow: "var(--shadow-lg)" },
  cardImageArea: { height: "180px", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  cardSource: { position: "absolute", top: "8px", right: "8px", padding: "3px 8px", background: "var(--primary)", borderRadius: "calc(var(--radius) - 2px)", color: "var(--primary-foreground)", fontSize: "0.65rem", fontWeight: 600, fontFamily: "var(--font-mono)" },
  cardBody: { padding: "1rem 1.25rem 1.25rem" },
  cardMeta: { display: "flex", gap: "0.5rem", marginBottom: "0.5rem" },
  conditionBadge: { padding: "2px 8px", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.7rem", fontWeight: 600 },
  yearBadge: { padding: "2px 8px", background: "var(--muted)", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.7rem", fontWeight: 600, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" },
  cardTitle: { fontSize: "0.95rem", fontWeight: 700, lineHeight: 1.3, color: "var(--card-foreground)", marginBottom: "0.25rem" },
  cardBrand: { fontSize: "0.78rem", color: "var(--muted-foreground)", marginBottom: "0.75rem" },
  cardSpecs: { display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.75rem" },
  specChip: { padding: "3px 8px", background: "var(--muted)", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.7rem", color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" },
  cardPricing: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" },
  priceEUR: { fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.1rem", color: "var(--secondary-foreground)" },
  priceINR: { fontSize: "0.78rem", color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" },
  calcButton: { padding: "0.4rem 0.75rem", background: "var(--primary)", border: "none", borderRadius: "calc(var(--radius) - 2px)", color: "var(--primary-foreground)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" },

  // Pagination
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "2rem", paddingBottom: "1rem" },
  pageBtn: { padding: "0.5rem 0.85rem", background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontFamily: "var(--font-sans)", fontSize: "0.82rem", fontWeight: 600, color: "var(--secondary-foreground)", cursor: "pointer", transition: "all 0.15s" },
  pageBtnActive: { background: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" },
  pageBtnDisabled: { opacity: 0.4, cursor: "default" },
  pageDots: { color: "var(--muted-foreground)", fontSize: "0.9rem", padding: "0 0.25rem" },

  // Detail panel
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 200 },
  detailPanel: { width: "560px", maxWidth: "100vw", height: "100vh", overflowY: "auto", background: "var(--background)", padding: "2rem", position: "relative" },
  closeBtn: { position: "absolute", top: "1rem", right: "1rem", width: "32px", height: "32px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--muted)", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--foreground)", zIndex: 1 },
  detailImageArea: { width: "100%", height: "240px", borderRadius: "calc(var(--radius) + 4px)", overflow: "hidden", marginBottom: "1.25rem", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" },
  detailHeader: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" },
  detailTitle: { fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 },
  detailSub: { fontSize: "0.82rem", color: "var(--muted-foreground)", marginTop: "0.25rem" },
  detailDesc: { fontSize: "0.88rem", lineHeight: 1.6, color: "var(--foreground)", marginBottom: "1.25rem", padding: "1rem", background: "var(--muted)", borderRadius: "var(--radius)" },
  specsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" },
  specItem: { padding: "0.6rem 0.8rem", background: "var(--card)", borderRadius: "var(--radius)", border: "1px solid var(--border)" },
  specLabel: { fontSize: "0.65rem", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "0.2rem" },
  specValue: { fontSize: "0.88rem", fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-mono)" },
  landedCostSection: { background: "var(--card)", borderRadius: "calc(var(--radius) + 4px)", padding: "1.5rem", border: "1px solid var(--border)", marginBottom: "1.5rem" },
  landedTitle: { fontSize: "1.05rem", fontWeight: 700, color: "var(--secondary-foreground)", marginBottom: "1rem" },
  portSelector: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" },
  portLabel: { fontSize: "0.82rem", fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap" },
  portSelect: { flex: 1, padding: "0.5rem 0.75rem", border: "1px solid var(--input)", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.85rem", fontFamily: "var(--font-sans)", background: "var(--background)", color: "var(--foreground)" },
  costBreakdown: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  costRow: { display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--foreground)", padding: "0.3rem 0" },
  costRowTotal: { color: "var(--secondary-foreground)", fontSize: "1rem", paddingTop: "0.5rem" },
  costDivider: { height: "1px", background: "var(--border)", margin: "0.25rem 0" },
  disclaimer: { marginTop: "1rem", fontSize: "0.7rem", color: "var(--muted-foreground)", fontStyle: "italic" },

  // Actions
  actionRow: { display: "flex", gap: "0.75rem" },
  primaryAction: { flex: 1, padding: "0.85rem", background: "var(--primary)", border: "none", borderRadius: "var(--radius)", color: "var(--primary-foreground)", fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" },
  secondaryAction: { flex: 1, padding: "0.85rem", background: "transparent", border: "2px solid var(--primary)", borderRadius: "var(--radius)", color: "var(--primary)", fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" },

  // Empty state
  emptyState: { textAlign: "center", padding: "4rem 2rem" },

  // Footer
  footer: { background: "var(--header-bg)", borderTop: "3px solid var(--primary)", marginTop: "3rem", padding: "2.5rem 1.5rem" },
  footerInner: { maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "2rem" },
  footerCol: {},
  footerLogo: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" },
  logoMarkSmall: { width: "28px", height: "28px", background: "var(--accent)", borderRadius: "calc(var(--radius) - 2px)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.7rem", color: "var(--accent-foreground)" },
  footerBrand: { fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--header-fg)", fontSize: "0.95rem" },
  footerText: { fontSize: "0.82rem", color: "var(--header-stat-fg)", lineHeight: 1.6 },
  footerHeading: { fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" },
  footerLink: { fontSize: "0.82rem", color: "var(--header-stat-fg)", marginBottom: "0.5rem", cursor: "pointer" },
};
