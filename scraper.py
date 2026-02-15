#!/usr/bin/env python3
"""
Maschinensucher.de Food Processing Machine Scraper

Scrapes all food processing machine listings (~7,285) from the
Lebensmitteltechnik category, including full details from each
listing's detail page. Outputs to CSV.
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

BASE_URL = "https://www.maschinensucher.de"

# All 40 subcategories under Lebensmitteltechnik (ci-9)
SUBCATEGORIES = {
    "Anschlagmaschinen": 719,
    "Brauereianlagen": 301,
    "Bäckereimaschinen": 300,
    "Dekanter": 302,
    "Eismaschinen": 303,
    "Fettherstellung & Verarbeitung": 304,
    "Filter (Lebensmitteltechnik)": 305,
    "Fischverarbeitungsmaschinen": 306,
    "Fleischverarbeitungsmaschinen": 307,
    "Gastronomiemaschinen & -Geräte": 308,
    "Getreideverarbeitung": 311,
    "Getränkeautomaten": 309,
    "Getränkemaschinen": 310,
    "Kaffee-, Tee- & Tabakmaschinen": 312,
    "Kartoffelchipsherstellungsmaschinen": 313,
    "Kochkessel": 314,
    "Küchentechnik": 315,
    "Kühlanlagen für Lebensmittel": 316,
    "Labortechnik für Lebensmittel": 317,
    "Lagerung & Handhabung": 318,
    "Maschinen für Feinkost": 319,
    "Mengenmaschinen": 720,
    "Milch & Milchprodukte": 320,
    "Mischanlagen": 321,
    "Molkereianlagen": 323,
    "Mühlen für Lebensmittel": 322,
    "Obstverarbeitung & Gemüseverarbeitung": 324,
    "Ölherstellung": 325,
    "Pastamaschinen": 327,
    "Pulverherstellung & Verarbeitung": 328,
    "Pumpen (Lebensmitteltechnik)": 2082,
    "Reinigungstechnik": 329,
    "Räucheranlagen": 653,
    "Separatoren für Lebensmittel": 330,
    "Siebanlagen für Lebensmittel": 331,
    "Sonstige Lebensmitteltechnik": 665,
    "Süßwarenmaschinen": 332,
    "Trockner für Lebensmittel": 333,
    "Verpackungsmaschinen": 334,
    "Waagen (Lebensmittel)": 335,
}

CSV_FIELDS = [
    "title",
    "manufacturer",
    "model",
    "year",
    "condition",
    "functionality",
    "price",
    "currency",
    "location",
    "country",
    "dimensions",
    "weight",
    "electrical",
    "description",
    "seller_name",
    "seller_verified",
    "listing_id",
    "category",
    "detail_url",
    "image_url",
    "last_updated",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}

PROGRESS_FILE = "scraper_progress.json"
OUTPUT_FILE = "machines.csv"
MAX_RETRIES = 3
LISTINGS_PER_PAGE = 12


def get_session():
    """Create a requests session with default headers."""
    session = requests.Session()
    session.headers.update(HEADERS)
    return session


def fetch_page(session, url, retries=MAX_RETRIES):
    """Fetch a page with retry logic and rate limiting."""
    for attempt in range(retries):
        try:
            delay = random.uniform(1.0, 2.0)
            time.sleep(delay)
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1) + random.uniform(0, 1)
                print(f"\n  Retry {attempt + 1}/{retries} for {url}: {e}")
                time.sleep(wait)
            else:
                print(f"\n  Failed after {retries} attempts: {url}: {e}")
                return None


def build_category_url(cat_name, ci_id, page=1):
    """Build the URL for a subcategory page."""
    slug = cat_name.replace(" & ", "-").replace(" ", "-")
    slug = slug.replace("(", "").replace(")", "")
    slug = slug.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
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
            # Normalize: strip query params and fragments
            parsed = urlparse(full_url)
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            urls.add(clean_url)
    return urls


def extract_listing_id(url):
    """Extract the numeric listing ID from a detail URL."""
    match = re.search(r"/i-(\d+)", url)
    return match.group(1) if match else None


def get_spec_value(soup, label):
    """Extract a specification value by its label from the detail page.

    Handles common patterns:
    - <dt>Label</dt><dd>Value</dd> in a definition list
    - <th>Label</th><td>Value</td> in a table
    - Label/value pairs in various div structures
    """
    # Try dt/dd pattern
    for dt in soup.find_all("dt"):
        if label.lower() in dt.get_text(strip=True).lower():
            dd = dt.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)

    # Try th/td pattern
    for th in soup.find_all("th"):
        if label.lower() in th.get_text(strip=True).lower():
            td = th.find_next_sibling("td")
            if td:
                return td.get_text(strip=True)

    # Try label/value div pairs
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
    price = ""
    currency = ""

    # Look for price patterns in text
    price_patterns = [
        r"([\d.,]+)\s*€",
        r"€\s*([\d.,]+)",
        r"([\d.,]+)\s*EUR",
        r"USD\s*([\d.,]+)",
        r"([\d.,]+)\s*USD",
    ]

    # Search in common price containers
    price_containers = soup.find_all(
        class_=re.compile(r"price|preis|Festpreis|Preisinfo", re.IGNORECASE)
    )
    for container in price_containers:
        text = container.get_text(strip=True)
        for pattern in price_patterns:
            match = re.search(pattern, text)
            if match:
                price = match.group(1)
                if "€" in text or "EUR" in text:
                    currency = "EUR"
                elif "USD" in text:
                    currency = "USD"
                return price, currency

    # Broader search in page text
    for pattern in price_patterns:
        match = re.search(pattern, soup.get_text())
        if match:
            price = match.group(1)
            if "€" in soup.get_text()[max(0, match.start() - 10):match.end() + 10]:
                currency = "EUR"
            elif "USD" in soup.get_text()[max(0, match.start() - 10):match.end() + 10]:
                currency = "USD"
            return price, currency

    # Check spec table
    price_spec = get_spec_value(soup, "Preis")
    if price_spec:
        for pattern in price_patterns:
            match = re.search(pattern, price_spec)
            if match:
                price = match.group(1)
                currency = "EUR" if "€" in price_spec or "EUR" in price_spec else ""
                return price, currency
        price = price_spec

    return price, currency


def parse_detail_page(soup, url, category):
    """Parse a detail page and extract all fields."""
    data = {field: "" for field in CSV_FIELDS}
    data["detail_url"] = url
    data["listing_id"] = extract_listing_id(url) or ""
    data["category"] = category

    # Title - try multiple selectors
    title_el = soup.find("h1")
    if title_el:
        data["title"] = title_el.get_text(strip=True)

    # Specs from detail tables
    data["manufacturer"] = get_spec_value(soup, "Hersteller")
    data["model"] = get_spec_value(soup, "Modell")
    data["year"] = get_spec_value(soup, "Baujahr")
    data["condition"] = get_spec_value(soup, "Zustand")
    data["functionality"] = get_spec_value(soup, "Funktionsfähigkeit")
    data["last_updated"] = get_spec_value(soup, "Aktualisiert") or get_spec_value(soup, "Zuletzt")

    # Dimensions: check multiple labels
    dims = get_spec_value(soup, "Abmessungen")
    if not dims:
        dims = get_spec_value(soup, "Maße")
    if not dims:
        length = get_spec_value(soup, "Länge")
        width = get_spec_value(soup, "Breite")
        height = get_spec_value(soup, "Höhe")
        parts = [p for p in [length, width, height] if p]
        if parts:
            dims = " x ".join(parts)
    data["dimensions"] = dims

    data["weight"] = get_spec_value(soup, "Gewicht")

    # Electrical: combine voltage, power, amps
    electrical_parts = []
    for label in ["Spannung", "Leistung", "Stromstärke", "Anschluss"]:
        val = get_spec_value(soup, label)
        if val:
            electrical_parts.append(f"{label}: {val}")
    data["electrical"] = "; ".join(electrical_parts)

    # Price
    price, currency = parse_price(soup)
    data["price"] = price
    data["currency"] = currency

    # Location & country
    location = get_spec_value(soup, "Standort")
    if not location:
        location = get_spec_value(soup, "Maschinenstandort")
    data["location"] = location

    country = get_spec_value(soup, "Land")
    if not country and location:
        # Try to extract country from location (often last part)
        parts = [p.strip() for p in location.split(",")]
        if len(parts) > 1:
            country = parts[-1]
    data["country"] = country

    # Description
    desc_el = soup.find(class_=re.compile(r"description|beschreibung", re.IGNORECASE))
    if desc_el:
        data["description"] = desc_el.get_text(strip=True)
    else:
        # Try finding a description section by heading
        for heading in soup.find_all(["h2", "h3", "h4"]):
            if "beschreibung" in heading.get_text(strip=True).lower():
                # Get text from siblings until next heading
                desc_parts = []
                for sib in heading.find_next_siblings():
                    if sib.name in ["h2", "h3", "h4"]:
                        break
                    text = sib.get_text(strip=True)
                    if text:
                        desc_parts.append(text)
                data["description"] = " ".join(desc_parts)
                break

    # Seller info
    seller_el = soup.find(class_=re.compile(r"seller|dealer|händler|anbieter", re.IGNORECASE))
    if seller_el:
        # Try to find seller name within
        name_el = seller_el.find(["strong", "b", "h3", "h4", "a"])
        if name_el:
            data["seller_name"] = name_el.get_text(strip=True)
        else:
            data["seller_name"] = seller_el.get_text(strip=True)[:100]

    # Seller verified
    verified = soup.find(string=re.compile(r"Geprüfter Händler|verified", re.IGNORECASE))
    data["seller_verified"] = "Yes" if verified else "No"

    # Primary image
    img = soup.find("img", src=re.compile(r"cdn\.machineseeker\.com|listing/img", re.IGNORECASE))
    if img:
        data["image_url"] = img.get("src", "")
    else:
        # Try og:image meta tag
        og_img = soup.find("meta", property="og:image")
        if og_img:
            data["image_url"] = og_img.get("content", "")

    return data


def load_progress():
    """Load progress from disk (set of scraped listing IDs)."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            data = json.load(f)
            return set(data.get("scraped_ids", []))
    return set()


def save_progress(scraped_ids):
    """Save progress to disk."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"scraped_ids": list(scraped_ids)}, f)


def init_csv(filepath):
    """Initialize the CSV file with headers if it doesn't exist."""
    if not os.path.exists(filepath):
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()


def append_to_csv(filepath, row):
    """Append a single row to the CSV file."""
    with open(filepath, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow(row)


def scrape_subcategory(session, cat_name, ci_id, scraped_ids, output_file, limit=None):
    """Scrape all listings from a single subcategory."""
    listing_urls = []
    page = 1

    # Phase 1: Collect all listing URLs from paginated category pages
    while True:
        url = build_category_url(cat_name, ci_id, page)
        resp = fetch_page(session, url)
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

        # If we got fewer links than expected, likely last page
        if len(urls) < LISTINGS_PER_PAGE:
            break

        page += 1

    if not listing_urls:
        return 0

    # Phase 2: Visit each detail page and extract data
    count = 0
    for detail_url in tqdm(listing_urls, desc=f"  {cat_name[:30]}", leave=False):
        lid = extract_listing_id(detail_url)
        if lid in scraped_ids:
            continue

        resp = fetch_page(session, detail_url)
        if resp is None:
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        row = parse_detail_page(soup, detail_url, cat_name)
        append_to_csv(output_file, row)

        scraped_ids.add(lid)
        count += 1

        # Save progress every 50 listings
        if count % 50 == 0:
            save_progress(scraped_ids)

    save_progress(scraped_ids)
    return count


def main():
    parser = argparse.ArgumentParser(
        description="Scrape food processing machines from maschinensucher.de"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit total number of listings to scrape (for testing)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=OUTPUT_FILE,
        help=f"Output CSV file (default: {OUTPUT_FILE})",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Resume from previous progress (default: True)",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Start fresh, ignoring previous progress",
    )
    parser.add_argument(
        "--category",
        type=str,
        default=None,
        help="Scrape only a specific subcategory by name",
    )
    args = parser.parse_args()

    # Handle fresh start
    if args.fresh:
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
        if os.path.exists(args.output):
            os.remove(args.output)
        scraped_ids = set()
    else:
        scraped_ids = load_progress()

    init_csv(args.output)
    session = get_session()

    # Filter subcategories if specified
    if args.category:
        matching = {k: v for k, v in SUBCATEGORIES.items() if args.category.lower() in k.lower()}
        if not matching:
            print(f"No subcategory matching '{args.category}'. Available:")
            for name in sorted(SUBCATEGORIES.keys()):
                print(f"  - {name}")
            sys.exit(1)
        categories = matching
    else:
        categories = SUBCATEGORIES

    total_scraped = 0
    remaining_limit = args.limit

    print(f"Scraping {len(categories)} subcategories from maschinensucher.de")
    if scraped_ids:
        print(f"Resuming: {len(scraped_ids)} listings already scraped")
    if args.limit:
        print(f"Limit: {args.limit} listings")
    print(f"Output: {args.output}")
    print()

    for cat_name, ci_id in tqdm(categories.items(), desc="Subcategories"):
        per_cat_limit = remaining_limit if remaining_limit else None

        count = scrape_subcategory(
            session, cat_name, ci_id, scraped_ids, args.output, limit=per_cat_limit
        )

        total_scraped += count
        if remaining_limit is not None:
            remaining_limit -= count
            if remaining_limit <= 0:
                break

    print(f"\nDone! Scraped {total_scraped} new listings.")
    print(f"Total listings in progress file: {len(scraped_ids)}")
    print(f"Output saved to: {args.output}")

    # Clean up progress file on full completion (no limit)
    if args.limit is None and not args.category:
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            print("Full scrape complete — progress file removed.")


if __name__ == "__main__":
    main()
