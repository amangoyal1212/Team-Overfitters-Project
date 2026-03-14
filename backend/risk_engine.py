"""
risk_engine.py
Scores pharmacogenomic interaction risk based on metaboliser phenotype
and level of evidence.

Returns a tuple: (risk_score, severity)
"""

from __future__ import annotations


def calculate_risk(
    phenotype: str,
    evidence_level: str
) -> tuple[float, str]:

    evidence_multipliers = {
        "1A": 1.0, "1B": 0.85,
        "2A": 0.65, "2B": 0.50,
        "3": 0.30, "4": 0.15,
        "none": 0.0, "": 0.0
    }

    phenotype_base_scores = {
        "Poor Metabolizer": 95,
        "Ultrarapid Metabolizer": 80,
        "Intermediate Metabolizer": 50,
        "Rapid Metabolizer": 35,
        "Normal Metabolizer": 8,
        "Unknown - Manual Review Required": 40
    }

    base = phenotype_base_scores.get(
        phenotype, 40
    )
    ev_mult = evidence_multipliers.get(
        evidence_level, 0.0
    )

    if evidence_level in ("none", "", None):
        risk_score = base * 0.6
    else:
        risk_score = base * (0.4 + ev_mult * 0.6)

    # Override: Poor Metabolizer minimum 80
    if phenotype == "Poor Metabolizer":
        risk_score = max(risk_score, 80)
    
    # Override: Ultrarapid minimum 75
    if phenotype == "Ultrarapid Metabolizer":
        risk_score = max(risk_score, 75)

    risk_score = min(100, max(0, risk_score))

    if risk_score >= 75:
        severity = "HIGH"
    elif risk_score >= 45:
        severity = "MODERATE"
    elif risk_score >= 15:
        severity = "LOW"
    else:
        severity = "NORMAL"

    return (round(risk_score, 1), severity)



# ── Legacy alternatives (kept for backward-compatibility reference) ──────────
_LEGACY_SAFER_ALTERNATIVES = {
    ("CYP2D6", "Poor Metabolizer", "sertraline"): [
        {"drug": "Escitalopram", "reason": "Uses CYP2C19 pathway", "note": "Avoid if CYP2C19 also impaired"},
        {"drug": "Venlafaxine",  "reason": "Minimal CYP2D6 dependence", "note": "Monitor blood pressure"},
        {"drug": "Mirtazapine",  "reason": "No significant PGx interaction", "note": "First line alternative"},
    ],
    ("CYP2D6", "Poor Metabolizer", "fluoxetine"): [
        {"drug": "Citalopram",  "reason": "CYP2C19 pathway", "note": "Check CYP2C19 status"},
        {"drug": "Venlafaxine", "reason": "Minimal PGx interaction", "note": "Standard monitoring"},
    ],
}

def _legacy_alternatives(gene: str, phenotype: str, drug: str) -> list:
    key = (gene, phenotype, drug.lower())
    return _LEGACY_SAFER_ALTERNATIVES.get(key, [])


# ── New enhanced alternatives via therapeutic_classes module ─────────────────
from therapeutic_classes import get_alternatives as _tc_get_alternatives   # noqa: E402


def get_alternatives(
    gene: str,
    phenotype: str,
    drug: str,
    patient_alleles: dict | None = None,
) -> list:
    """
    Return enhanced alternative drug recommendations.
    Falls back to legacy data if the new module returns nothing.
    """
    enhanced = _tc_get_alternatives(drug, gene, phenotype, patient_alleles)
    if enhanced:
        return enhanced
    return _legacy_alternatives(gene, phenotype, drug)
