"""
medicine_scanner.py
Local-only medicine strip scanner using Tesseract OCR + RapidFuzz.
No cloud APIs, no AI/ML models for clinical decisions.
This module is ONLY for medication identification via OCR.
"""

from __future__ import annotations

import io
import re
import json
from pathlib import Path

import pytesseract
from PIL import Image
from rapidfuzz import fuzz

# ---------------------------------------------------------------------------
# Load drug database at module startup
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "indian_drug_database.json"

_drug_database: list[dict] = []
_brand_index: dict[str, dict] = {}   # lowercase brand → drug entry
_generic_index: dict[str, dict] = {} # lowercase generic → drug entry

def _load_database():
    global _drug_database, _brand_index, _generic_index
    if DB_PATH.exists():
        with open(DB_PATH, "r", encoding="utf-8") as f:
            _drug_database = json.load(f)
        for entry in _drug_database:
            gn = entry.get("generic_name", entry.get("name", "")).lower()
            _generic_index[gn] = entry
            _generic_index[entry.get("name", "").lower()] = entry
            for brand in entry.get("brand_names", []):
                _brand_index[brand.lower()] = entry

_load_database()


# ---------------------------------------------------------------------------
# Tesseract OCR text extraction
# ---------------------------------------------------------------------------
_MAX_OCR_WIDTH = 1280

def extract_text_from_image(image_bytes: bytes) -> list[str]:
    """
    Extract text from a medicine strip image using Tesseract OCR.
    Returns a list of non-empty text lines.
    """
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')

    # Downscale large images for speed
    w, h = image.size
    if w > _MAX_OCR_WIDTH:
        ratio = _MAX_OCR_WIDTH / w
        new_size = (int(w * ratio), int(h * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Extract text using Tesseract
    # --oem 3: Default (LSTM + legacy combined)
    # --psm 6: Assume a single uniform block of text
    custom_config = r'--oem 3 --psm 6'
    text = pytesseract.image_to_string(
        image,
        config=custom_config,
        lang='eng',
    )

    # Split into non-empty lines
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    return lines


# ---------------------------------------------------------------------------
# Dose pattern extraction
# ---------------------------------------------------------------------------
_DOSE_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|iu)\b",
    re.IGNORECASE,
)

def _extract_dose(text_blocks: list[str]) -> str | None:
    """Extract first dose pattern from OCR text blocks."""
    for block in text_blocks:
        m = _DOSE_PATTERN.search(block)
        if m:
            return f"{m.group(1)}{m.group(2).lower()}"
    return None


# ---------------------------------------------------------------------------
# Fuzzy matching against drug database
# ---------------------------------------------------------------------------
def _fuzzy_match_drug(text_blocks: list[str]) -> list[dict]:
    """
    Match OCR text against brand_names and generic_names.
    Returns top matches with confidence scores.
    """
    # Build candidate tokens from OCR text
    all_text = " ".join(text_blocks)
    # Split into potential drug name tokens (words 3+ chars)
    tokens = re.findall(r"[A-Za-z]{3,}", all_text)
    # Also try multi-word combinations (2-3 word spans)
    for i in range(len(tokens) - 1):
        tokens.append(f"{tokens[i]} {tokens[i+1]}")

    matches: list[dict] = []
    seen_names: set[str] = set()

    for token in tokens:
        token_lower = token.lower()

        # Match against brand names
        for brand_lower, entry in _brand_index.items():
            score = fuzz.token_sort_ratio(token_lower, brand_lower)
            entry_name = entry.get("name", "")
            if score >= 50 and entry_name not in seen_names:
                matches.append({
                    "drug_name": entry_name,
                    "matched_against": brand_lower,
                    "match_type": "brand_name",
                    "match_confidence": round(score, 1),
                    "entry": entry,
                })
                if score >= 70:
                    seen_names.add(entry_name)

        # Match against generic names
        for generic_lower, entry in _generic_index.items():
            score = fuzz.token_sort_ratio(token_lower, generic_lower)
            entry_name = entry.get("name", "")
            if score >= 50 and entry_name not in seen_names:
                matches.append({
                    "drug_name": entry_name,
                    "matched_against": generic_lower,
                    "match_type": "generic_name",
                    "match_confidence": round(score, 1),
                    "entry": entry,
                })
                if score >= 70:
                    seen_names.add(entry_name)

    # Deduplicate keeping highest score per drug
    best: dict[str, dict] = {}
    for m in matches:
        name = m["drug_name"]
        if name not in best or m["match_confidence"] > best[name]["match_confidence"]:
            best[name] = m

    # Sort by confidence descending
    sorted_matches = sorted(best.values(), key=lambda x: x["match_confidence"], reverse=True)
    return sorted_matches[:10]


# ---------------------------------------------------------------------------
# Main scan function
# ---------------------------------------------------------------------------
def scan_medicine(image_bytes: bytes) -> dict:
    """
    Scan a medicine image using local OCR + fuzzy matching.
    Returns standardized JSON output.

    Pipeline (all deterministic):
    1. Tesseract OCR extracts text lines
    2. Regex extracts dose patterns
    3. Fuzzy match against brand_names and generic_names
    4. Apply threshold rules
    """
    # Step 1: OCR via Tesseract
    ocr_text_blocks = extract_text_from_image(image_bytes)
    # Tesseract doesn't provide per-line confidence in basic mode
    avg_ocr_confidence = None

    # Step 2: Extract dose
    detected_dose = _extract_dose(ocr_text_blocks)

    # Step 3: Fuzzy match
    all_matches = _fuzzy_match_drug(ocr_text_blocks)

    # Step 4: Apply threshold
    top_3 = all_matches[:3]
    best_match = top_3[0] if top_3 else None

    # Determine detected drug
    detected_drug = None
    match_confidence = 0
    manufacturer = None

    entry = None
    if best_match and best_match["match_confidence"] >= 70:
        detected_drug = best_match["drug_name"]
        match_confidence = best_match["match_confidence"]
        manufacturer = best_match["entry"].get("manufacturer")
        entry = best_match["entry"]
    elif best_match:
        match_confidence = best_match["match_confidence"]

    # Overall confidence
    overall_confidence = round(
        (match_confidence * 0.7 + (avg_ocr_confidence or 0) * 0.3), 1
    )

    # Build pgx_status based on drug type
    pgx_status = None
    pgx_relevant = None
    pgx_genes: list[str] = []

    if entry:
        pgx_relevant = entry.get("pgx_relevant", False)
        pgx_genes = entry.get("pgx_genes", [])

        if pgx_relevant:
            pgx_status = {
                "status": "REQUIRES_CHECK",
                "message": f"{detected_drug} is PGx-relevant. "
                           f"Confirm medicine to run gene interaction check.",
                "relevant_genes": pgx_genes,
                "category": entry.get("category", entry.get("therapeutic_class", "")),
                "common_indication": entry.get("common_indication", ""),
            }
        else:
            pgx_status = {
                "status": "NOT_PGx_RELEVANT",
                "message": f"{detected_drug} has no known pharmacogenomic "
                           f"interactions. Standard dosing applies.",
                "category": entry.get("category", entry.get("therapeutic_class", "")),
                "common_indication": entry.get("common_indication", ""),
            }
    elif detected_drug is None:
        # Unknown drug
        pgx_status = None

    return {
        "ocr_text": ocr_text_blocks,
        "detected_drug": detected_drug,
        "top_matches": [
            {
                "drug_name": m["drug_name"],
                "match_confidence": m["match_confidence"],
                "match_type": m["match_type"],
                "matched_against": m["matched_against"],
            }
            for m in top_3
        ],
        "detected_dose": detected_dose,
        "manufacturer": manufacturer,
        "ocr_confidence": avg_ocr_confidence,
        "match_confidence": round(match_confidence, 1),
        "overall_confidence": overall_confidence,
        "requires_user_confirmation": True,
        "pgx_relevant": pgx_relevant,
        "pgx_genes": pgx_genes,
        "pgx_status": pgx_status,
        "source": "Local OCR Pipeline (Tesseract + RapidFuzz)",
    }


def get_drug_entry(drug_name: str) -> dict | None:
    """Look up a drug entry by name from the database."""
    name_lower = drug_name.lower().strip()
    # Try generic name first, then brand name
    entry = _generic_index.get(name_lower) or _brand_index.get(name_lower)
    return entry


def get_drug_info(drug_name: str) -> dict:
    """Get category and indication info for a drug."""
    entry = get_drug_entry(drug_name)
    if entry:
        return {
            "category": entry.get("category", entry.get("therapeutic_class", "")),
            "common_indication": entry.get("common_indication", ""),
            "therapeutic_class": entry.get("therapeutic_class", ""),
        }
    return {"category": "", "common_indication": "", "therapeutic_class": ""}


def search_drugs(query: str, limit: int = 5) -> list[dict]:
    """
    Search drug database by name or brand name using fuzzy matching.
    Returns matching drugs with their details.
    """
    if not query or len(query.strip()) < 2:
        return []

    query_lower = query.lower().strip()

    # Build search corpus: all generic names + all brand names
    all_names: list[tuple[str, dict]] = []
    for entry in _drug_database:
        gn = entry.get("generic_name", entry.get("name", "")).lower()
        all_names.append((gn, entry))
        name_lower = entry.get("name", "").lower()
        if name_lower != gn:
            all_names.append((name_lower, entry))
        for brand in entry.get("brand_names", []):
            all_names.append((brand.lower(), entry))

    # Score all names
    scored: list[tuple[float, str, dict]] = []
    for name, entry in all_names:
        score = fuzz.token_sort_ratio(query_lower, name)
        if score >= 50:
            scored.append((score, name, entry))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Deduplicate by drug name, keeping highest score
    seen: set[str] = set()
    results: list[dict] = []
    for score, matched_name, entry in scored:
        drug_name = entry.get("name", "")
        if drug_name in seen:
            continue
        seen.add(drug_name)
        results.append({
            "name": drug_name,
            "brands": entry.get("brand_names", []),
            "pgx_relevant": entry.get("pgx_relevant", False),
            "pgx_genes": entry.get("pgx_genes", []),
            "category": entry.get("category", entry.get("therapeutic_class", "")),
            "common_indication": entry.get("common_indication", ""),
            "therapeutic_class": entry.get("therapeutic_class", ""),
            "match_score": round(score, 1),
            "matched_term": matched_name,
        })
        if len(results) >= limit:
            break

    return results
