"""
evidence_breakdown.py
Deterministic Evidence Breakdown builder for GeneGuard.
Assembles structured clinical evidence from CPIC, PharmGKB,
and rule-based risk scoring — NO AI/ML/LLM involved.
"""

from __future__ import annotations


# CPIC guideline metadata per gene
_CPIC_GUIDELINES = {
    "CYP2D6": {
        "title": "CPIC Guideline for SSRIs and SNRIs and CYP2D6",
        "id": "cpic-guideline-for-ssri-and-snri-antidepressants",
        "version": "Latest",
        "url": "https://cpicpgx.org/guidelines/cpic-guideline-for-ssri-and-snri-antidepressants/",
    },
    "CYP2C19": {
        "title": "CPIC Guideline for CYP2C19 and Clopidogrel/SSRIs",
        "id": "cpic-guideline-for-cyp2c19-and-clopidogrel",
        "version": "Latest",
        "url": "https://cpicpgx.org/guidelines/cpic-guideline-for-clopidogrel-and-cyp2c19/",
    },
    "CYP2C9": {
        "title": "CPIC Guideline for Warfarin and CYP2C9/VKORC1",
        "id": "cpic-guideline-for-pharmacogenetics-guided-warfarin-dosing",
        "version": "2017",
        "url": "https://cpicpgx.org/guidelines/guideline-for-warfarin-and-cyp2c9-and-vkorc1/",
    },
    "DPYD": {
        "title": "CPIC Guideline for Fluoropyrimidines and DPYD",
        "id": "cpic-guideline-for-fluoropyrimidines-and-dpyd",
        "version": "2018",
        "url": "https://cpicpgx.org/guidelines/guideline-for-fluoropyrimidines-and-dpyd/",
    },
    "SLCO1B1": {
        "title": "CPIC Guideline for Statins and SLCO1B1",
        "id": "cpic-guideline-for-statins",
        "version": "2022",
        "url": "https://cpicpgx.org/guidelines/cpic-guideline-for-statins/",
    },
    "TPMT": {
        "title": "CPIC Guideline for Thiopurines and TPMT/NUDT15",
        "id": "cpic-guideline-for-thiopurines-and-tpmt",
        "version": "2019",
        "url": "https://cpicpgx.org/guidelines/guideline-for-thiopurines-and-tpmt/",
    },
    "CYP3A5": {
        "title": "CPIC Guideline for Tacrolimus and CYP3A5",
        "id": "cpic-guideline-for-tacrolimus-and-cyp3a5",
        "version": "2015",
        "url": "https://cpicpgx.org/guidelines/guideline-for-tacrolimus-and-cyp3a5/",
    },
    "HLA-B*58:01": {
        "title": "CPIC Guideline for Allopurinol and HLA-B",
        "id": "cpic-guideline-for-allopurinol-and-hla-b",
        "version": "2015",
        "url": "https://cpicpgx.org/guidelines/guideline-for-allopurinol-and-hla-b/",
    },
    "HLA-B*57:01": {
        "title": "CPIC Guideline for Abacavir and HLA-B",
        "id": "cpic-guideline-for-abacavir-and-hla-b",
        "version": "2014",
        "url": "https://cpicpgx.org/guidelines/guideline-for-abacavir-and-hla-b/",
    },
    "HLA-B*15:02": {
        "title": "CPIC Guideline for Carbamazepine and HLA-B",
        "id": "cpic-guideline-for-carbamazepine-and-hla-b",
        "version": "2018",
        "url": "https://cpicpgx.org/guidelines/guideline-for-carbamazepine-and-hla-b/",
    },
}

# Default guideline for unknown genes
_DEFAULT_GUIDELINE = {
    "title": "CPIC General Pharmacogenomics Guideline",
    "id": "cpic-general",
    "version": "Latest",
    "url": "https://cpicpgx.org/guidelines/",
}


def build_evidence_breakdown(
    gene: str,
    diplotype: str,
    phenotype: str,
    drug: str,
    risk_score: float,
    severity: str,
    evidence_level: str,
    annotation_text: str = "",
    pmids: list[str] | None = None,
    cpic_source: str = "",
    activity_score: float | None = None,
    cpic_recommendation: str = "",
    cpic_guideline_url: str = "",
    consultation_text: str = "",
) -> dict:
    """
    Build a deterministic Evidence Breakdown dict from the analysis
    pipeline outputs. No AI/ML/NLP is used.
    """
    if pmids is None:
        pmids = []

    # Determine CPIC guideline metadata
    guideline = _CPIC_GUIDELINES.get(gene, _DEFAULT_GUIDELINE)
    if cpic_guideline_url:
        guideline = {**guideline, "url": cpic_guideline_url}

    # Build recommendation summary from available CPIC data
    recommendation_summary = ""
    if cpic_recommendation:
        recommendation_summary = cpic_recommendation
    elif consultation_text:
        recommendation_summary = consultation_text
    elif annotation_text and annotation_text != "No PharmGKB annotation found":
        recommendation_summary = annotation_text
    else:
        recommendation_summary = (
            f"Standard CPIC-guided monitoring recommended for "
            f"{drug} in {phenotype} patients."
        )

    # Phenotype base scores (mirrored from risk_engine.py for transparency)
    phenotype_base_scores = {
        "Poor Metabolizer": 95,
        "Ultrarapid Metabolizer": 80,
        "Intermediate Metabolizer": 50,
        "Rapid Metabolizer": 35,
        "Normal Metabolizer": 8,
        "Unknown - Manual Review Required": 40,
    }
    phenotype_base = phenotype_base_scores.get(phenotype, 40)

    return {
        "gene_analyzed": gene,
        "variants_used": [diplotype],
        "diplotype_called": diplotype,
        "phenotype_assigned": phenotype,
        "activity_score": activity_score,
        "cpic_guideline": {
            "title": guideline["title"],
            "id": guideline["id"],
            "version": guideline["version"],
            "url": guideline["url"],
        },
        "guideline_recommendation": recommendation_summary,
        "risk_score_components": {
            "phenotype_base": phenotype_base,
            "evidence_level": evidence_level if evidence_level else "none",
            "final_score": risk_score,
            "severity": severity,
        },
        "pmids": pmids,
        "annotation_text": annotation_text,
        "cpic_source": cpic_source or "CPIC + PharmGKB (deterministic)",
    }
