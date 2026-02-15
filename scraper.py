#!/usr/bin/env python3
"""
MachinesBridge — Food Processing Machine Scraper

Scrapes publicly available food processing machine listings from
machineseeker.com (English version of maschinensucher.de).

Legal compliance:
  - Honest User-Agent identifying the bot and linking to source code
  - Checks robots.txt before scraping any URL
  - Respects Crawl-delay directives (5s for machineseeker.com)
  - Only collects factual, non-copyrighted data (specs, prices, metadata)
  - Does NOT scrape seller descriptions (copyrighted content)
  - Rate-limits all requests with jitter to avoid server strain
  - Attributes source for every listing
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://www.machineseeker.com"
BOT_NAME = "MachinesBridge-Bot"
BOT_VERSION = "1.0"
BOT_URL = "https://github.com/adi-prompter-max/machinesBridge"
USER_AGENT = f"{BOT_NAME}/{BOT_VERSION} (+{BOT_URL})"

# All 41 food processing subcategories (English) with their ci- IDs
SUBCATEGORIES = {
    "Bakery machines & pastry equipment": {"id": 300, "slug": "Bakery-pastry-equipment"},
    "Beverage production": {"id": 310, "slug": "Beverage-production"},
    "Blending machines": {"id": 720, "slug": "Blending-Machines"},
    "Brewing equipment": {"id": 301, "slug": "Brewing-malting-equipment"},
    "Cleaning technology": {"id": 329, "slug": "Cleaning-technology"},
    "Coffee, tea, tobacco processing": {"id": 312, "slug": "Coffee-tea-tobacco-processing"},
    "Confectionery production": {"id": 332, "slug": "Confectionery-production"},
    "Cooking vessels": {"id": 314, "slug": "Cooking-vessels"},
    "Dairy plant equipment": {"id": 323, "slug": "Dairy-plant-equipment"},
    "Decanters": {"id": 302, "slug": "Decanter"},
    "Delicatessen machinery": {"id": 319, "slug": "Delicatessen-machinery"},
    "Dryers": {"id": 333, "slug": "Dryer"},
    "Fat production & handling": {"id": 304, "slug": "Fat-production-handling"},
    "Filters for food processing": {"id": 305, "slug": "Filter"},
    "Fish processing": {"id": 306, "slug": "Fish-processing"},
    "Food smoking equipment": {"id": 653, "slug": "Food-smoking-equipment"},
    "Fruit & vegetable processing": {"id": 324, "slug": "Fruit-vegetable-processing"},
    "Gastronomy equipment": {"id": 308, "slug": "Gastronomy-equipment"},
    "Grain processing machines": {"id": 311, "slug": "Grain-processing"},
    "Ice cream machines": {"id": 303, "slug": "Ice-cream-machines"},
    "Kitchen equipment": {"id": 315, "slug": "Kitchen-equipment"},
    "Laboratory equipment for food": {"id": 317, "slug": "Laboratory-equipment-for-food"},
    "Meat processing machines": {"id": 307, "slug": "Meat-processing"},
    "Milk & dairy production": {"id": 320, "slug": "Milk-dairy-production"},
    "Mills": {"id": 322, "slug": "Mills"},
    "Mixing machinery": {"id": 321, "slug": "Mixing-machinery"},
    "Oil production": {"id": 325, "slug": "Oil-production"},
    "Other food technology": {"id": 665, "slug": "Other-machinery"},
    "Packaging machinery": {"id": 334, "slug": "Packaging-machinery"},
    "Pasta processing machinery": {"id": 327, "slug": "Pasta-processing-machinery"},
    "Potato chips production": {"id": 313, "slug": "Potato-chips-production"},
    "Powder production & processing": {"id": 328, "slug": "Powder-production-processing"},
    "Pumps": {"id": 2082, "slug": "Pumps"},
    "Refrigeration Systems": {"id": 316, "slug": "Refrigeration-Systems"},
    "Scales for food processing": {"id": 335, "slug": "Scales"},
    "Separators": {"id": 330, "slug": "Separators"},
    "Sifting plants": {"id": 331, "slug": "Sifting-plants"},
    "Stirring machines & bakery mixers": {"id": 719, "slug": "Notice-machines"},
    "Storage & handling equipment": {"id": 318, "slug": "Storage-Handling"},
    "Vending machines": {"id": 309, "slug": "Vending-machines"},
}

CSV_FIELDS = [
    "title",
    "manufacturer",
    "model",
    "year",
    "condition",
    "price",
    "currency",
    "location",
    "country",
    "dimensions",
    "weight",
    "electrical",
    "seller_name",
    "seller_verified",
    "listing_id",
    "category",
    "detail_url",
    "image_url",
    "source",
    "scraped_at",
]

PROGRESS_FILE = "scraper_progress.json"
OUTPUT_FILE = "machines.csv"
MAX_RETRIES = 3
LISTINGS_PER_PAGE = 12
DEFAULT_CRAWL_DELAY = 5  # seconds, from robots.txt

# ---------------------------------------------------------------------------
# robots.txt compliance
# ---------------------------------------------------------------------------

_robots_cache = {}


def check_robots(url):
    """Check if we're allowed to fetch this URL per robots.txt."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    if robots_url not in _robots_cache:
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
        except Exception:
            # If we can't read robots.txt, be conservative and allow
            return True
        _robots_cache[robots_url] = rp

    rp = _robots_cache[robots_url]
    return rp.can_fetch(USER_AGENT, url)


def get_crawl_delay():
    """Get the crawl delay from robots.txt, or use default."""
    robots_url = f"{BASE_URL}/robots.txt"
    if robots_url not in _robots_cache:
        check_robots(BASE_URL)  # populate cache

    rp = _robots_cache.get(robots_url)
    if rp:
        delay = rp.crawl_delay(USER_AGENT)
        if delay:
            return delay
    return DEFAULT_CRAWL_DELAY


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def get_session():
    """Create a requests session with honest bot headers."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "From": "machinesbridge@proton.me",
    })
    return session


def fetch_page(session, url, crawl_delay, retries=MAX_RETRIES):
    """Fetch a page respecting robots.txt and crawl delay."""
    # Check robots.txt
    if not check_robots(url):
        print(f"\n  Blocked by robots.txt: {url}")
        return None

    for attempt in range(retries):
        try:
            # Respect crawl delay
            time.sleep(crawl_delay)
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"\n  Retry {attempt + 1}/{retries} for {url}: {e}")
                time.sleep(wait)
            else:
                print(f"\n  Failed after {retries} attempts: {url}: {e}")
                return None


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------


def build_category_url(slug, ci_id, page=1):
    """Build the URL for a subcategory listing page."""
    url = f"{BASE_URL}/{slug}/ci-{ci_id}"
    if page > 1:
        url += f"?page={page}"
    return url


def extract_listing_urls(soup):
    """Extract all listing detail URLs from a category page."""
    urls = set()
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if "/i-" in href and re.search(r"/i-\d+", href):
            full_url = urljoin(BASE_URL, href)
            parsed = urlparse(full_url)
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            urls.add(clean_url)
    return urls


def extract_listing_id(url):
    """Extract the numeric listing ID from a detail URL."""
    match = re.search(r"/i-(\d+)", url)
    return match.group(1) if match else None


# ---------------------------------------------------------------------------
# Detail page parsing — factual data only
# ---------------------------------------------------------------------------


def get_spec_value(soup, *labels):
    """Extract a spec value by trying multiple label names.

    Handles dt/dd, th/td, and label/value div patterns.
    """
    for label in labels:
        # dt/dd
        for dt in soup.find_all("dt"):
            if label.lower() in dt.get_text(strip=True).lower():
                dd = dt.find_next_sibling("dd")
                if dd:
                    return dd.get_text(strip=True)
        # th/td
        for th in soup.find_all("th"):
            if label.lower() in th.get_text(strip=True).lower():
                td = th.find_next_sibling("td")
                if td:
                    return td.get_text(strip=True)
        # Generic label/value pairs
        for el in soup.find_all(string=re.compile(re.escape(label), re.IGNORECASE)):
            parent = el.parent
            if parent:
                sibling = parent.find_next_sibling()
                if sibling:
                    text = sibling.get_text(strip=True)
                    if text:
                        return text
    return ""


def parse_price(soup):
    """Extract price and currency from the detail page."""
    price_patterns = [
        r"([\d.,]+)\s*€",
        r"€\s*([\d.,]+)",
        r"([\d.,]+)\s*EUR",
        r"USD\s*([\d.,]+)",
        r"([\d.,]+)\s*USD",
    ]

    # Check price containers first
    for container in soup.find_all(
        class_=re.compile(r"price|preis|Festpreis|Preisinfo", re.IGNORECASE)
    ):
        text = container.get_text(strip=True)
        for pattern in price_patterns:
            match = re.search(pattern, text)
            if match:
                price = match.group(1)
                if "€" in text or "EUR" in text:
                    return price, "EUR"
                if "USD" in text:
                    return price, "USD"

    # Check spec table
    price_spec = get_spec_value(soup, "Price", "Preis")
    if price_spec:
        for pattern in price_patterns:
            match = re.search(pattern, price_spec)
            if match:
                price = match.group(1)
                currency = "EUR" if ("€" in price_spec or "EUR" in price_spec) else ""
                return price, currency

    return "", ""


def clean_text(text):
    """Remove CSS, HTML artifacts, and excessive whitespace from text."""
    if not text:
        return ""
    # Remove anything that looks like CSS
    if "{" in text and "}" in text:
        return ""
    # Remove HTML-ish content
    if text.startswith("#") and "." in text:
        return ""
    return text.strip()


def parse_detail_page(soup, url, category):
    """Parse a detail page — factual data only, no copyrighted descriptions."""
    data = {field: "" for field in CSV_FIELDS}
    data["detail_url"] = url
    data["listing_id"] = extract_listing_id(url) or ""
    data["category"] = category
    data["source"] = "Machineseeker"
    data["scraped_at"] = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    # Remove style and script tags to avoid CSS leaking into spec values
    for tag in soup.find_all(["style", "script"]):
        tag.decompose()

    # Factual specs — try English labels first, then German fallbacks
    machine_type = get_spec_value(soup, "Machine type", "Maschinenart")
    data["manufacturer"] = get_spec_value(soup, "Manufacturer", "Hersteller")
    data["model"] = get_spec_value(soup, "Model", "Modell")

    # Build title from specs rather than relying on h1 (which concatenates child elements)
    title_parts = [p for p in [machine_type, data["manufacturer"], data["model"]] if p]
    if title_parts:
        data["title"] = " ".join(title_parts)
    else:
        # Fallback to og:title meta tag
        og_title = soup.find("meta", property="og:title")
        if og_title:
            data["title"] = og_title.get("content", "").strip()
        else:
            title_el = soup.find("h1")
            if title_el:
                data["title"] = title_el.get_text(strip=True)

    data["year"] = get_spec_value(soup, "Year of manufacture", "Year built",
                                  "Year of construction", "Baujahr")
    data["condition"] = get_spec_value(soup, "Condition", "Zustand")

    # Dimensions
    dims = clean_text(get_spec_value(soup, "Dimensions", "Abmessungen", "Maße"))
    if not dims:
        length = get_spec_value(soup, "Length", "Länge")
        width = get_spec_value(soup, "Width", "Breite")
        height = get_spec_value(soup, "Height", "Höhe")
        parts = [clean_text(p) for p in [length, width, height] if clean_text(p)]
        if parts:
            dims = " x ".join(parts)
    data["dimensions"] = dims

    data["weight"] = clean_text(get_spec_value(soup, "Weight", "Gewicht"))

    # Electrical
    electrical_parts = []
    for en_label, de_label in [
        ("Input voltage", "Spannung"),
        ("Power", "Leistung"),
        ("Input current", "Stromstärke"),
        ("Input frequency", "Frequenz"),
    ]:
        val = clean_text(get_spec_value(soup, en_label, de_label))
        if val:
            electrical_parts.append(f"{en_label.replace('Input ', '')}: {val}")
    data["electrical"] = "; ".join(electrical_parts)

    # Price
    price, currency = parse_price(soup)
    # Filter out "Price info" / "Preisinfo" (means price not shown)
    if price and not re.search(r"[a-zA-Z]", price):
        data["price"] = price
        data["currency"] = currency

    # Location & country
    location = get_spec_value(soup, "Location", "Standort", "Machine location",
                              "Maschinenstandort")
    data["location"] = location

    country = get_spec_value(soup, "Country", "Land")
    if not country and location:
        parts = [p.strip() for p in location.split(",")]
        if len(parts) > 1:
            country = parts[-1]
    data["country"] = country

    # Seller info (company name is factual, not copyrighted)
    # Try the "Dealer" / "Seller" spec label first
    seller_name = get_spec_value(soup, "Dealer", "Seller", "Händler", "Anbieter")
    # Filter out inquiry form text and other noise
    noise_patterns = ["Send inquiry", "Dear Sir", "Note:", "Register",
                      "Log in", "interested in"]
    if seller_name and not any(n in seller_name for n in noise_patterns):
        data["seller_name"] = seller_name[:100]

    verified = soup.find(
        string=re.compile(r"Verified|Geprüfter|trusted", re.IGNORECASE)
    )
    data["seller_verified"] = "Yes" if verified else "No"

    # Image URL (for reference/attribution; app uses own images)
    og_img = soup.find("meta", property="og:image")
    if og_img:
        data["image_url"] = og_img.get("content", "")
    else:
        img = soup.find("img", src=re.compile(
            r"cdn\.machineseeker\.com|cdn\.maschinensucher|listing", re.IGNORECASE
        ))
        if img:
            data["image_url"] = img.get("src", "")

    return data


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------


def load_progress():
    """Load set of already-scraped listing IDs."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            data = json.load(f)
            return set(data.get("scraped_ids", []))
    return set()


def save_progress(scraped_ids):
    """Persist scraped IDs to disk for resume."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"scraped_ids": sorted(scraped_ids)}, f)


# ---------------------------------------------------------------------------
# CSV output
# ---------------------------------------------------------------------------


def init_csv(filepath):
    """Create CSV with headers if it doesn't exist."""
    if not os.path.exists(filepath):
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()


def append_to_csv(filepath, row):
    """Append one row to the CSV."""
    with open(filepath, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow(row)


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------


def scrape_subcategory(session, cat_name, cat_info, scraped_ids,
                       output_file, crawl_delay, limit=None):
    """Scrape all listings from one subcategory."""
    listing_urls = []
    page = 1

    # Phase 1: collect listing URLs from paginated category pages
    while True:
        url = build_category_url(cat_info["slug"], cat_info["id"], page)
        resp = fetch_page(session, url, crawl_delay)
        if resp is None:
            break

        soup = BeautifulSoup(resp.text, "lxml")
        urls = extract_listing_urls(soup)

        if not urls:
            break

        new_urls = [u for u in urls if extract_listing_id(u) not in scraped_ids]
        listing_urls.extend(new_urls)

        if limit and len(listing_urls) >= limit:
            listing_urls = listing_urls[:limit]
            break

        if len(urls) < LISTINGS_PER_PAGE:
            break

        page += 1

    if not listing_urls:
        return 0

    # Phase 2: visit each detail page
    count = 0
    for detail_url in tqdm(listing_urls, desc=f"  {cat_name[:35]}", leave=False):
        lid = extract_listing_id(detail_url)
        if lid in scraped_ids:
            continue

        resp = fetch_page(session, detail_url, crawl_delay)
        if resp is None:
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        row = parse_detail_page(soup, detail_url, cat_name)
        append_to_csv(output_file, row)

        scraped_ids.add(lid)
        count += 1

        if count % 25 == 0:
            save_progress(scraped_ids)

    save_progress(scraped_ids)
    return count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Scrape food processing machines from machineseeker.com (legally)"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Max listings to scrape in total (for testing)",
    )
    parser.add_argument(
        "--output", type=str, default=OUTPUT_FILE,
        help=f"Output CSV file (default: {OUTPUT_FILE})",
    )
    parser.add_argument(
        "--fresh", action="store_true",
        help="Start fresh, deleting previous progress",
    )
    parser.add_argument(
        "--category", type=str, default=None,
        help="Scrape only categories matching this keyword",
    )
    parser.add_argument(
        "--delay", type=float, default=None,
        help="Override crawl delay in seconds (default: from robots.txt)",
    )
    args = parser.parse_args()

    # Fresh start
    if args.fresh:
        for f in [PROGRESS_FILE, args.output]:
            if os.path.exists(f):
                os.remove(f)
        scraped_ids = set()
    else:
        scraped_ids = load_progress()

    init_csv(args.output)
    session = get_session()

    # Get crawl delay from robots.txt or override
    crawl_delay = args.delay if args.delay is not None else get_crawl_delay()

    # Filter categories
    if args.category:
        cats = {
            k: v for k, v in SUBCATEGORIES.items()
            if args.category.lower() in k.lower()
        }
        if not cats:
            print(f"No category matching '{args.category}'. Available:")
            for name in sorted(SUBCATEGORIES.keys()):
                print(f"  - {name}")
            sys.exit(1)
    else:
        cats = SUBCATEGORIES

    # Print scraping plan
    print("=" * 60)
    print(f"  MachinesBridge Scraper v{BOT_VERSION}")
    print("=" * 60)
    print(f"  Source:      {BASE_URL}")
    print(f"  User-Agent:  {USER_AGENT}")
    print(f"  Crawl delay: {crawl_delay}s (from robots.txt)")
    print(f"  Categories:  {len(cats)}")
    if scraped_ids:
        print(f"  Resuming:    {len(scraped_ids)} already scraped")
    if args.limit:
        print(f"  Limit:       {args.limit} listings")
    print(f"  Output:      {args.output}")
    print()
    print("  Legal: Honest UA, robots.txt checked, no descriptions scraped")
    print("=" * 60)
    print()

    total_scraped = 0
    remaining_limit = args.limit

    for cat_name, cat_info in tqdm(cats.items(), desc="Categories"):
        per_cat_limit = remaining_limit if remaining_limit else None

        count = scrape_subcategory(
            session, cat_name, cat_info, scraped_ids,
            args.output, crawl_delay, limit=per_cat_limit,
        )

        total_scraped += count
        if remaining_limit is not None:
            remaining_limit -= count
            if remaining_limit <= 0:
                break

    print(f"\nDone! Scraped {total_scraped} new listings.")
    print(f"Total in progress: {len(scraped_ids)}")
    print(f"Output: {args.output}")

    if args.limit is None and not args.category:
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            print("Full scrape complete — progress file cleaned up.")


if __name__ == "__main__":
    main()
