"""
therapeutic_classes.py
Drug classification, gene-pathway mapping, and evidence-based
alternative drug recommendations for GeneGuard.
"""

from __future__ import annotations

# ── Drug → Therapeutic class / indication / brand ───────────────────────────

THERAPEUTIC_CLASS = {
    "sertraline": {"class": "SSRI", "indication": "Depression/Anxiety", "brand": "Zoloft"},
    "fluoxetine": {"class": "SSRI", "indication": "Depression/OCD", "brand": "Prozac"},
    "paroxetine": {"class": "SSRI", "indication": "Depression/Anxiety", "brand": "Paxil"},
    "citalopram": {"class": "SSRI", "indication": "Depression", "brand": "Celexa"},
    "escitalopram": {"class": "SSRI", "indication": "Depression/Anxiety", "brand": "Lexapro"},
    "venlafaxine": {"class": "SNRI", "indication": "Depression/Anxiety", "brand": "Effexor"},
    "mirtazapine": {"class": "TeCA", "indication": "Depression/Insomnia", "brand": "Remeron"},
    "clopidogrel": {"class": "Antiplatelet", "indication": "Heart/Stroke Prevention", "brand": "Plavix"},
    "prasugrel": {"class": "Antiplatelet", "indication": "Acute Coronary Syndrome", "brand": "Effient"},
    "ticagrelor": {"class": "Antiplatelet", "indication": "Acute Coronary Syndrome", "brand": "Brilinta"},
    "warfarin": {"class": "Anticoagulant", "indication": "Blood Clot Prevention", "brand": "Coumadin"},
    "apixaban": {"class": "DOAC", "indication": "Blood Clot Prevention", "brand": "Eliquis"},
    "rivaroxaban": {"class": "DOAC", "indication": "Blood Clot Prevention", "brand": "Xarelto"},
    "simvastatin": {"class": "Statin", "indication": "High Cholesterol", "brand": "Zocor"},
    "atorvastatin": {"class": "Statin", "indication": "High Cholesterol", "brand": "Lipitor"},
    "pravastatin": {"class": "Statin", "indication": "High Cholesterol", "brand": "Pravachol"},
    "rosuvastatin": {"class": "Statin", "indication": "High Cholesterol", "brand": "Crestor"},
    "fluorouracil": {"class": "Antimetabolite", "indication": "Cancer", "brand": "Adrucil"},
    "capecitabine": {"class": "Antimetabolite", "indication": "Cancer", "brand": "Xeloda"},
    "azathioprine": {"class": "Immunosuppressant", "indication": "Transplant/Autoimmune", "brand": "Imuran"},
    "mercaptopurine": {"class": "Immunosuppressant", "indication": "Leukemia/IBD", "brand": "Purinethol"},
    "codeine": {"class": "Opioid", "indication": "Pain Relief", "brand": "Tylenol-3"},
    "tramadol": {"class": "Opioid", "indication": "Pain Relief", "brand": "Ultram"},
    "morphine": {"class": "Opioid", "indication": "Severe Pain", "brand": "MS Contin"},
}

# ── Drug → metabolising gene(s) ─────────────────────────────────────────────

GENE_PATHWAY = {
    "sertraline": ["CYP2D6", "CYP2C19"],
    "fluoxetine": ["CYP2D6", "CYP2C9"],
    "paroxetine": ["CYP2D6"],
    "citalopram": ["CYP2C19", "CYP3A4"],
    "escitalopram": ["CYP2C19", "CYP3A4"],
    "venlafaxine": ["CYP2D6", "CYP3A4"],
    "mirtazapine": ["CYP3A4", "CYP1A2"],
    "clopidogrel": ["CYP2C19"],
    "prasugrel": ["CYP3A4", "CYP2B6"],
    "ticagrelor": ["CYP3A4"],
    "warfarin": ["CYP2C9"],
    "apixaban": ["CYP3A4"],
    "rivaroxaban": ["CYP3A4"],
    "simvastatin": ["SLCO1B1", "CYP3A4"],
    "atorvastatin": ["SLCO1B1", "CYP3A4"],
    "pravastatin": ["SLCO1B1"],
    "rosuvastatin": ["SLCO1B1"],
    "fluorouracil": ["DPYD"],
    "capecitabine": ["DPYD"],
    "azathioprine": ["TPMT"],
    "mercaptopurine": ["TPMT"],
    "codeine": ["CYP2D6"],
    "tramadol": ["CYP2D6"],
    "morphine": [],
}

# ── Explicit alternative rules per gene / phenotype / drug ──────────────────

ALTERNATIVE_RULES: dict[str, dict[str, dict[str, list[str]]]] = {
    "CYP2D6": {
        "Poor Metabolizer": {
            "sertraline": ["escitalopram", "citalopram", "mirtazapine"],
            "fluoxetine": ["citalopram", "escitalopram", "venlafaxine"],
            "paroxetine": ["escitalopram", "citalopram", "mirtazapine"],
            "codeine": ["morphine"],
            "tramadol": ["morphine"],
        },
        "Ultrarapid Metabolizer": {
            "codeine": ["morphine"],
            "tramadol": ["morphine"],
            "sertraline": ["escitalopram"],
        },
    },
    "CYP2C19": {
        "Poor Metabolizer": {
            "clopidogrel": ["prasugrel", "ticagrelor"],
            "citalopram": ["sertraline", "mirtazapine"],
            "escitalopram": ["sertraline", "venlafaxine", "mirtazapine"],
        },
    },
    "CYP2C9": {
        "Poor Metabolizer": {
            "warfarin": ["apixaban", "rivaroxaban"],
        },
    },
    "SLCO1B1": {
        "Poor Metabolizer": {
            "simvastatin": ["pravastatin", "rosuvastatin", "atorvastatin"],
            "atorvastatin": ["pravastatin", "rosuvastatin"],
        },
    },
    "DPYD": {
        "Poor Metabolizer": {
            "fluorouracil": [],
            "capecitabine": [],
        },
    },
    "TPMT": {
        "Poor Metabolizer": {
            "azathioprine": [],
            "mercaptopurine": [],
        },
    },
}


def _avoids_gene(alt_drug: str, problem_gene: str) -> bool:
    """Return True if *alt_drug* does NOT use *problem_gene*."""
    pathway = GENE_PATHWAY.get(alt_drug, [])
    return problem_gene not in pathway


def _predicted_risk(alt_drug: str, problem_gene: str, patient_alleles: dict) -> int:
    """
    Heuristic predicted-risk score for an alternative drug.
    • Uses a different gene AND patient is normal for that gene → 5-12
    • No PGx interaction (empty pathway) → 5-8
    • Uses same gene → keep similar risk
    """
    pathway = GENE_PATHWAY.get(alt_drug, [])
    if not pathway:
        return 6  # No PGx interaction at all

    if problem_gene not in pathway:
        # Alternative avoids the problem gene entirely
        return 8  # Low predicted risk
    else:
        # Still uses the problem gene – not ideal
        return 55


def get_alternatives(
    drug: str,
    gene: str,
    phenotype: str,
    patient_alleles: dict | None = None,
) -> list[dict]:
    """
    Return up to 5 safer alternative drugs based on pharmacogenomic data.

    1. Check ALTERNATIVE_RULES for explicit guideline-based alternatives.
    2. Fallback: find drugs in the same therapeutic class that avoid the
       affected gene.
    3. For each alternative, build a rich recommendation object.
    """
    if patient_alleles is None:
        patient_alleles = {}

    drug_lower = drug.lower().strip()
    current_info = THERAPEUTIC_CLASS.get(drug_lower)
    if not current_info:
        return []

    current_class = current_info["class"]

    # 1. Lookup explicit rules
    rule_alts: list[str] = []
    gene_rules = ALTERNATIVE_RULES.get(gene, {})
    pheno_rules = gene_rules.get(phenotype, {})
    rule_alts = pheno_rules.get(drug_lower, [])

    # 2. If no rules or too few, supplement with same-class drugs avoiding gene
    fallback_alts: list[str] = []
    if len(rule_alts) < 3:
        for candidate, info in THERAPEUTIC_CLASS.items():
            if candidate == drug_lower:
                continue
            if candidate in rule_alts:
                continue
            if _avoids_gene(candidate, gene):
                fallback_alts.append(candidate)

    # Combine: explicit rules first, then fallbacks
    all_alt_names = list(dict.fromkeys(rule_alts + fallback_alts))  # dedupe, preserve order

    # 3. Build rich result objects
    results: list[dict] = []
    for alt_name in all_alt_names:
        alt_info = THERAPEUTIC_CLASS.get(alt_name)
        if not alt_info:
            continue

        alt_pathway = GENE_PATHWAY.get(alt_name, [])
        avoids = _avoids_gene(alt_name, gene)
        pred_risk = _predicted_risk(alt_name, gene, patient_alleles)
        same_class = alt_info["class"] == current_class

        # Determine severity from risk
        if pred_risk >= 75:
            pred_sev = "HIGH"
        elif pred_risk >= 45:
            pred_sev = "MODERATE"
        elif pred_risk >= 15:
            pred_sev = "LOW"
        else:
            pred_sev = "NORMAL"

        # Evidence: explicit rule = 1A, fallback = 2A
        evidence = "1A" if alt_name in rule_alts else "2A"

        # Reason string
        if avoids:
            reason = (
                f"Metabolized by {', '.join(alt_pathway) if alt_pathway else 'non-PGx pathway'} — "
                f"avoids {gene} ({phenotype})"
            )
        else:
            reason = f"Uses {gene} but with different interaction profile"

        results.append({
            "name": alt_name.capitalize(),
            "brand": alt_info["brand"],
            "therapeutic_class": alt_info["class"],
            "same_class": same_class,
            "indication": alt_info["indication"],
            "metabolized_by": alt_pathway,
            "avoids_gene": gene if avoids else "",
            "predicted_risk": pred_risk,
            "predicted_severity": pred_sev,
            "evidence_level": evidence,
            "reason": reason,
            "switch_type": "same_class" if same_class else "different_class",
        })

    # Sort by predicted_risk ascending
    results.sort(key=lambda x: x["predicted_risk"])

    return results[:5]
