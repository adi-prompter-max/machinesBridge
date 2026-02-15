#!/usr/bin/env python3
"""Generate 500 realistic mock food processing machine listings."""

import csv
import random
import string

CSV_FIELDS = [
    "title", "manufacturer", "model", "year", "condition", "functionality",
    "price", "currency", "location", "country", "dimensions", "weight",
    "electrical", "description", "seller_name", "seller_verified",
    "listing_id", "category", "detail_url", "image_url", "last_updated",
]

CATEGORIES = [
    "Anschlagmaschinen", "Brauereianlagen", "Bäckereimaschinen", "Dekanter",
    "Eismaschinen", "Fettherstellung & Verarbeitung",
    "Filter (Lebensmitteltechnik)", "Fischverarbeitungsmaschinen",
    "Fleischverarbeitungsmaschinen", "Gastronomiemaschinen & -Geräte",
    "Getreideverarbeitung", "Getränkeautomaten", "Getränkemaschinen",
    "Kaffee-, Tee- & Tabakmaschinen", "Kartoffelchipsherstellungsmaschinen",
    "Kochkessel", "Küchentechnik", "Kühlanlagen für Lebensmittel",
    "Labortechnik für Lebensmittel", "Lagerung & Handhabung",
    "Maschinen für Feinkost", "Mengenmaschinen", "Milch & Milchprodukte",
    "Mischanlagen", "Molkereianlagen", "Mühlen für Lebensmittel",
    "Obstverarbeitung & Gemüseverarbeitung", "Ölherstellung",
    "Pastamaschinen", "Pulverherstellung & Verarbeitung",
    "Pumpen (Lebensmitteltechnik)", "Reinigungstechnik", "Räucheranlagen",
    "Separatoren für Lebensmittel", "Siebanlagen für Lebensmittel",
    "Sonstige Lebensmitteltechnik", "Süßwarenmaschinen",
    "Trockner für Lebensmittel", "Verpackungsmaschinen",
    "Waagen (Lebensmittel)",
]

MANUFACTURERS = {
    "Bäckereimaschinen": ["Werner & Pfleiderer", "Diosna", "Kemper", "WP Bakery", "Bühler", "Rondo", "Koenig", "Debag", "Wachtel", "Miwe"],
    "Fleischverarbeitungsmaschinen": ["Seydelmann", "Handtmann", "Vemag", "Laska", "Kilia", "Wolfking", "Risco", "Frey", "CFS", "Marel"],
    "Verpackungsmaschinen": ["Bosch", "Multivac", "Ulma", "Ishida", "Sealed Air", "Haver & Boecker", "Rovema", "Optima", "Koch Pac", "GEA"],
    "Getränkemaschinen": ["Krones", "KHS", "Sidel", "Tetra Pak", "GEA", "Alfa Laval", "APV", "Ziemann", "Steinecker", "BrauKon"],
    "Kochkessel": ["Stephan", "Inotec", "Karl Schnell", "Kustner", "Auriol", "Nilma", "Firex", "Electrolux", "Rational", "MKN"],
    "Mischanlagen": ["Lödige", "Eirich", "Zeppelin", "Amixon", "IKA", "Hosokawa", "Diosna", "Kemper", "Collette", "Glatt"],
    "Küchentechnik": ["Rational", "Electrolux", "Hobart", "MKN", "Convotherm", "Eloma", "Palux", "Zanussi", "Fagor", "Bertos"],
    "Milch & Milchprodukte": ["GEA", "Tetra Pak", "Alfa Laval", "APV", "SPX Flow", "Westfalia", "Krones", "Serac", "Elopak", "SIG"],
    "Süßwarenmaschinen": ["Bühler", "Sollich", "Aasted", "Hacos", "Prefamac", "Mol d'Art", "Selmi", "Gami", "Savage Bros", "Hilliard"],
    "Obstverarbeitung & Gemüseverarbeitung": ["Urschel", "FAM", "KRONEN", "Sormac", "TREIF", "Dornow", "Eillert", "Nilma", "Marel", "TOMRA"],
}

DEFAULT_MANUFACTURERS = [
    "GEA", "Bühler", "Alfa Laval", "Marel", "JBT", "SPX Flow", "Tetra Pak",
    "Krones", "Multivac", "Handtmann", "Bosch", "Siemens", "ABB",
    "Flottwerk", "Hiller", "Pieralisi", "Andritz", "Netzsch", "Seepex",
    "Fristam", "Grundfos", "Waukesha", "Silverson", "Ross", "Ystral",
    "Hosokawa", "Fritsch", "Retsch", "IKA", "Eirich", "Lödige",
    "Zeppelin", "Amixon", "Dinnissen", "Kemper", "Rieter", "Brabender",
    "Rheon", "Rademaker", "Haas", "Franz Haas", "Baker Perkins",
]

MACHINE_TYPES = {
    "Anschlagmaschinen": ["Schlagmaschine", "Aufschlagmaschine", "Planetenrührer", "Schläger", "Knetmaschine"],
    "Brauereianlagen": ["Brauanlage", "Sudhaus", "Gärtank", "Läuterbottich", "Maischebottich", "Würzepfanne"],
    "Bäckereimaschinen": ["Spiralkneter", "Teigteiler", "Brötchenpresse", "Langwirkmaschine", "Gärschrank", "Stikkenofen"],
    "Dekanter": ["Dekanter", "Zentrifugaldekanter", "3-Phasen-Dekanter", "2-Phasen-Dekanter", "Separator"],
    "Eismaschinen": ["Eismaschine", "Speiseeisbereiter", "Softeismaschine", "Eiscrusher", "Gefriertunnel"],
    "Fleischverarbeitungsmaschinen": ["Fleischwolf", "Kutter", "Füllmaschine", "Clipmaschine", "Entschwartungsmaschine", "Sägemaschine"],
    "Getränkemaschinen": ["Abfüllanlage", "Etikettiermaschine", "Verschließer", "Rinser", "Pasteur", "Mischer"],
    "Kochkessel": ["Kochkessel", "Dampfkochkessel", "Vakuumkocher", "Rührkochkessel", "Kippkochkessel"],
    "Küchentechnik": ["Kombidämpfer", "Konvektomat", "Schneidemaschine", "Geschirrspüler", "Salamander"],
    "Mischanlagen": ["Bandmischer", "Pflugscharmischer", "Konusmischer", "Intensivmischer", "Paddelmischer"],
    "Milch & Milchprodukte": ["Homogenisator", "Pasteur", "Separator", "Buttermaschine", "Käsefertiger"],
    "Verpackungsmaschinen": ["Tiefziehverpackungsmaschine", "Schlauchbeutelmaschine", "Vakuumierer", "Kartonierer", "Etikettierer"],
    "Süßwarenmaschinen": ["Temperiermaschine", "Conche", "Überziehmaschine", "Mogulanlage", "Walzwerk"],
    "Obstverarbeitung & Gemüseverarbeitung": ["Würfelschneider", "Schälmaschine", "Entsafter", "Passiermaschine", "Waschmaschine"],
    "Kühlanlagen für Lebensmittel": ["Kühltunnel", "Schockfroster", "Kühlzelle", "Spiralkühler", "Plattenkühler"],
    "Filter (Lebensmitteltechnik)": ["Plattenfilter", "Kerzenfilter", "Membranfilter", "Druckfilter", "Bandfilter"],
    "Pumpen (Lebensmitteltechnik)": ["Kreiselpumpe", "Drehkolbenpumpe", "Exzenterschneckenpumpe", "Membranpumpe", "Zahnradpumpe"],
    "Reinigungstechnik": ["CIP-Anlage", "Hochdruckreiniger", "Waschanlage", "Sterilisator", "Desinfektionsanlage"],
    "Trockner für Lebensmittel": ["Sprühtrockner", "Wirbelschichttrockner", "Bandtrockner", "Walzentrockner", "Gefriertrockner"],
    "Waagen (Lebensmittel)": ["Mehrkopfwaage", "Kontrollwaage", "Plattformwaage", "Dosierbandwaage", "Kombinationswaage"],
}

DEFAULT_MACHINE_TYPES = ["Industriemaschine", "Verarbeitungsanlage", "Produktionsmaschine", "Prozessanlage", "Fertigungsmaschine"]

CONDITIONS = [
    ("gebraucht", 30), ("gut (gebraucht)", 25), ("sehr gut (gebraucht)", 20),
    ("neu", 10), ("überholt", 10), ("neuwertig", 5),
]

FUNCTIONALITIES = [
    ("voll funktionsfähig", 50), ("funktionsfähig", 25),
    ("eingeschränkt funktionsfähig", 10), ("nicht geprüft", 10),
    ("", 5),
]

LOCATIONS = [
    ("Berlin, Deutschland", "Deutschland"),
    ("München, Deutschland", "Deutschland"),
    ("Hamburg, Deutschland", "Deutschland"),
    ("Köln, Deutschland", "Deutschland"),
    ("Frankfurt am Main, Deutschland", "Deutschland"),
    ("Stuttgart, Deutschland", "Deutschland"),
    ("Düsseldorf, Deutschland", "Deutschland"),
    ("Dortmund, Deutschland", "Deutschland"),
    ("Essen, Deutschland", "Deutschland"),
    ("Bremen, Deutschland", "Deutschland"),
    ("Dresden, Deutschland", "Deutschland"),
    ("Hannover, Deutschland", "Deutschland"),
    ("Nürnberg, Deutschland", "Deutschland"),
    ("Leipzig, Deutschland", "Deutschland"),
    ("Bielefeld, Deutschland", "Deutschland"),
    ("Wien, Österreich", "Österreich"),
    ("Graz, Österreich", "Österreich"),
    ("Salzburg, Österreich", "Österreich"),
    ("Zürich, Schweiz", "Schweiz"),
    ("Basel, Schweiz", "Schweiz"),
    ("Bern, Schweiz", "Schweiz"),
    ("Amsterdam, Niederlande", "Niederlande"),
    ("Rotterdam, Niederlande", "Niederlande"),
    ("Brüssel, Belgien", "Belgien"),
    ("Antwerpen, Belgien", "Belgien"),
    ("Warschau, Polen", "Polen"),
    ("Krakau, Polen", "Polen"),
    ("Prag, Tschechien", "Tschechien"),
    ("Brno, Tschechien", "Tschechien"),
    ("Mailand, Italien", "Italien"),
    ("Bologna, Italien", "Italien"),
    ("Parma, Italien", "Italien"),
    ("Madrid, Spanien", "Spanien"),
    ("Barcelona, Spanien", "Spanien"),
    ("Paris, Frankreich", "Frankreich"),
    ("Lyon, Frankreich", "Frankreich"),
    ("London, United Kingdom", "United Kingdom"),
    ("Birmingham, United Kingdom", "United Kingdom"),
    ("Kopenhagen, Dänemark", "Dänemark"),
    ("Stockholm, Schweden", "Schweden"),
]

SELLER_NAMES = [
    "Maschinen Müller GmbH", "Technik Bauer AG", "Industriehandel Schmidt",
    "Weber Maschinenhandel", "Koch Industrietechnik", "FoodTech Solutions GmbH",
    "ProMach Handels GmbH", "EuroMachinery BV", "MaschinenMarkt24",
    "Gastro-Technik Becker", "TradeMachines International", "IndustriePark Nord",
    "Gebrauchte-Maschinen.de", "Anlagen & Maschinen Fischer", "B&K Maschinenhandel",
    "MH Maschinenhandel GmbH", "Dietrich Industrieanlagen", "Surplus Select BV",
    "TechniTrade GmbH", "Lebensmitteltechnik Meier", "Anlagenbau Schneider",
    "ProcessTech Europe", "FoodMach International", "MaschinenWelt Online",
    "Deutsche Industriemaschinen", "Techno-Food Systems", "Machinery Europe GmbH",
    "Pacific Food Machinery", "Nordic Machine Trading", "Alpine Technik AG",
    "Rhein-Maschinen GmbH", "Süd-Maschinen Handel", "Ost-Technik Vertrieb",
    "Anlagen Center Berlin", "Bayerische Maschinenhandel", "Hansa Industrietechnik",
]

VOLTAGES = ["230V", "400V", "380V", "480V", "220V"]
FREQUENCIES = ["50Hz", "60Hz"]
POWER_RATINGS = [
    "0.37 kW", "0.55 kW", "0.75 kW", "1.1 kW", "1.5 kW", "2.2 kW",
    "3 kW", "4 kW", "5.5 kW", "7.5 kW", "11 kW", "15 kW", "18.5 kW",
    "22 kW", "30 kW", "37 kW", "45 kW", "55 kW", "75 kW", "90 kW",
]

MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]


def weighted_choice(choices):
    items, weights = zip(*choices)
    return random.choices(items, weights=weights, k=1)[0]


def gen_model(manufacturer):
    prefixes = ["", "X", "S", "M", "L", "XL", "P", "R", "K", "V", "A", "E", "T", "F", "H", "C", "D", "N", "Z", "W"]
    prefix = random.choice(prefixes)
    number = random.randint(1, 9999)
    suffixes = ["", "", "", "-S", "-M", "-L", "A", "B", "C", "E", "i", "Plus", "Pro", "HD", "XL"]
    suffix = random.choice(suffixes)
    sep = random.choice([" ", "-", ""])
    return f"{prefix}{sep}{number}{suffix}".strip()


def gen_dimensions():
    l = random.randint(300, 5000)
    w = random.randint(200, 3000)
    h = random.randint(300, 3500)
    return f"{l} x {w} x {h} mm"


def gen_weight():
    w = random.choice([
        random.randint(5, 50),
        random.randint(50, 200),
        random.randint(200, 1000),
        random.randint(1000, 5000),
        random.randint(5000, 15000),
    ])
    return f"{w} kg"


def gen_electrical():
    parts = []
    v = random.choice(VOLTAGES)
    f = random.choice(FREQUENCIES)
    parts.append(f"Spannung: {v} {f}")
    if random.random() > 0.3:
        p = random.choice(POWER_RATINGS)
        parts.append(f"Leistung: {p}")
    return "; ".join(parts)


def gen_price(condition):
    if condition == "neu":
        base = random.choice([
            random.randint(5000, 20000),
            random.randint(20000, 80000),
            random.randint(80000, 300000),
        ])
    else:
        base = random.choice([
            random.randint(200, 2000),
            random.randint(2000, 10000),
            random.randint(10000, 50000),
            random.randint(50000, 150000),
        ])
    return f"{base:,}".replace(",", ".")


def gen_description(title, manufacturer, model, category, condition):
    templates = [
        f"{title} von {manufacturer}. Modell {model}. Zustand: {condition}. Maschine ist einsatzbereit und kann sofort geliefert werden.",
        f"Zu verkaufen: {title} ({manufacturer} {model}). Die Maschine befindet sich in {condition}em Zustand. Besichtigung nach Vereinbarung möglich.",
        f"{manufacturer} {model} - {title}. Kategorie: {category}. Zustand: {condition}. Sofort verfügbar ab Lager.",
        f"Wir bieten eine {title} der Marke {manufacturer} (Modell: {model}) an. Zustand: {condition}. Alle Funktionen geprüft.",
        f"Gebrauchte {title}, Hersteller: {manufacturer}, Typ: {model}. Maschine wurde generalüberholt und ist betriebsbereit.",
        f"{title} - {manufacturer} {model}. Diese Maschine ist in {condition}em Zustand und wurde regelmäßig gewartet.",
        f"Verkauf einer {title} vom Hersteller {manufacturer}. Das Modell {model} ist bekannt für seine Zuverlässigkeit. Zustand: {condition}.",
        f"{manufacturer} Typ {model}. {title}. Die Anlage wurde professionell gewartet und befindet sich in einem sehr guten Zustand.",
    ]
    desc = random.choice(templates)
    if random.random() > 0.5:
        extras = [
            " Inklusive Dokumentation und Bedienungsanleitung.",
            " Preis ist VB (Verhandlungsbasis).",
            " Transport kann organisiert werden.",
            " CE-Kennzeichnung vorhanden.",
            " Ersatzteile verfügbar.",
            " Maschine kann vor Ort besichtigt werden.",
            " Weitere Bilder auf Anfrage.",
            " Inbetriebnahme und Schulung möglich.",
        ]
        desc += random.choice(extras)
    return desc


def gen_listing_id(used_ids):
    while True:
        lid = str(random.randint(1000000, 99999999))
        if lid not in used_ids:
            used_ids.add(lid)
            return lid


def gen_last_updated():
    year = random.choice([2024, 2025, 2025, 2025, 2026, 2026])
    month = random.choice(MONTHS)
    day = str(random.randint(1, 28)).zfill(2)
    return f"{day}.{month}.{year}"


def generate_mock_data(n=500, output_file="mock_machines.csv"):
    used_ids = set()
    rows = []

    for _ in range(n):
        category = random.choice(CATEGORIES)
        mfrs = MANUFACTURERS.get(category, DEFAULT_MANUFACTURERS)
        manufacturer = random.choice(mfrs)
        model = gen_model(manufacturer)

        machine_types = MACHINE_TYPES.get(category, DEFAULT_MACHINE_TYPES)
        machine_type = random.choice(machine_types)
        title = f"{machine_type} {manufacturer} {model}"

        year = str(random.randint(1995, 2026)) if random.random() > 0.15 else ""
        condition = weighted_choice(CONDITIONS)
        functionality = weighted_choice(FUNCTIONALITIES)
        price = gen_price(condition) if random.random() > 0.1 else "Preisinfo"
        currency = "EUR" if price != "Preisinfo" else ""
        location, country = random.choice(LOCATIONS)
        dimensions = gen_dimensions() if random.random() > 0.3 else ""
        weight = gen_weight() if random.random() > 0.35 else ""
        electrical = gen_electrical() if random.random() > 0.25 else ""
        listing_id = gen_listing_id(used_ids)
        seller_name = random.choice(SELLER_NAMES)
        seller_verified = random.choices(["Yes", "No"], weights=[40, 60], k=1)[0]
        description = gen_description(title, manufacturer, model, category, condition)
        last_updated = gen_last_updated()

        detail_url = f"https://www.maschinensucher.de/{manufacturer.lower().replace(' ', '+')}-{model.lower().replace(' ', '+')}/i-{listing_id}"
        image_url = f"https://cdn.machineseeker.com/img/listings/{listing_id}/1.jpg"

        rows.append({
            "title": title,
            "manufacturer": manufacturer,
            "model": model,
            "year": year,
            "condition": condition,
            "functionality": functionality,
            "price": price,
            "currency": currency,
            "location": location,
            "country": country,
            "dimensions": dimensions,
            "weight": weight,
            "electrical": electrical,
            "description": description,
            "seller_name": seller_name,
            "seller_verified": seller_verified,
            "listing_id": listing_id,
            "category": category,
            "detail_url": detail_url,
            "image_url": image_url,
            "last_updated": last_updated,
        })

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {n} mock listings -> {output_file}")


if __name__ == "__main__":
    generate_mock_data(500, "mock_machines.csv")
