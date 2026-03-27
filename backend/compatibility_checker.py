"""
compatibility_checker.py
Mendelian inheritance analysis for pharmacogenomic compatibility.
100% deterministic — no AI/ML, no external API dependencies.
Uses local CPIC phenotype tables and rule-based risk scoring.
"""

from __future__ import annotations
from collections import Counter

from vcf_parser import parse_vcf_content
from cpic_client import get_local_phenotype
from risk_engine import calculate_risk

# Genes we analyze for compatibility
COMPATIBILITY_GENES = ["CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "DPYD", "TPMT"]

# Risk level descriptions for child phenotypes
RISK_DESCRIPTIONS = {
    "Normal Metabolizer": "Standard drug response expected. No dosage adjustment needed.",
    "Intermediate Metabolizer": "Reduced enzyme activity. Some drugs may need dosage adjustment.",
    "Poor Metabolizer": "Significantly reduced enzyme activity. High ADR risk for multiple drug classes.",
    "Ultrarapid Metabolizer": "Increased enzyme activity. Risk of toxicity or therapeutic failure.",
    "Rapid Metabolizer": "Above-normal enzyme activity. Monitor for altered drug response.",
    "Normal Function": "Standard transporter function. No dosage adjustment needed.",
    "Decreased Function": "Reduced transporter function. Some drugs may accumulate.",
    "Poor Function": "Significantly reduced transporter function. High risk of drug accumulation.",
}

# Drug classes affected by each gene
GENE_DRUG_CLASSES = {
    "CYP2D6": "Antidepressants (SSRIs), Opioids (codeine, tramadol), Beta-blockers",
    "CYP2C19": "Antiplatelets (clopidogrel), PPIs, Antidepressants",
    "CYP2C9": "Anticoagulants (warfarin), NSAIDs, Antidiabetics",
    "SLCO1B1": "Statins (simvastatin, atorvastatin)",
    "DPYD": "Chemotherapy (fluorouracil, capecitabine)",
    "TPMT": "Immunosuppressants (azathioprine, mercaptopurine)",
}


def split_diplotype(diplotype: str) -> list[str]:
    """
    Split a diplotype string like '*1/*4' into individual alleles ['*1', '*4'].
    Handles edge cases like '*1a/*5', '*2A/*2A', etc.
    """
    parts = diplotype.split("/")
    if len(parts) == 2:
        return [parts[0].strip(), parts[1].strip()]
    # Fallback: treat as homozygous wild-type
    return ["*1", "*1"]


def normalize_diplotype(allele1: str, allele2: str) -> str:
    """
    Normalize a diplotype by sorting alleles consistently.
    E.g., '*4/*1' -> '*1/*4'
    """
    # Sort by the numeric/string part after '*'
    sorted_alleles = sorted([allele1, allele2], key=lambda a: a.lstrip("*"))
    return f"{sorted_alleles[0]}/{sorted_alleles[1]}"


def compute_punnett_square(
    parent1_diplotype: str, parent2_diplotype: str
) -> list[dict]:
    """
    Compute the Punnett square for two parents' diplotypes.
    Returns 4 child diplotype combinations with 25% probability each.
    """
    p1_alleles = split_diplotype(parent1_diplotype)
    p2_alleles = split_diplotype(parent2_diplotype)

    children = []
    for a1 in p1_alleles:
        for a2 in p2_alleles:
            child_diplotype = normalize_diplotype(a1, a2)
            children.append({
                "diplotype": child_diplotype,
                "from_parent1": a1,
                "from_parent2": a2,
                "probability": 25.0,  # Each combination is 25%
            })

    return children


def merge_child_outcomes(children: list[dict], gene: str) -> list[dict]:
    """
    Merge duplicate child diplotypes and look up phenotypes.
    Returns a list of unique outcomes with combined probabilities.
    """
    # Count occurrences of each diplotype
    diplotype_counts = Counter(c["diplotype"] for c in children)

    outcomes = []
    for diplotype, count in diplotype_counts.items():
        probability = count * 25.0  # Each occurrence = 25%

        # Get phenotype from local CPIC table (no external API)
        pheno_data = get_local_phenotype(gene, diplotype)
        phenotype = pheno_data["phenotype"]
        activity_score = pheno_data.get("activity_score")

        # Get risk score for this phenotype
        risk_score, severity = calculate_risk(phenotype, "1A")

        outcomes.append({
            "diplotype": diplotype,
            "phenotype": phenotype,
            "activity_score": activity_score,
            "probability": probability,
            "risk_score": risk_score,
            "severity": severity,
            "description": RISK_DESCRIPTIONS.get(phenotype, ""),
        })

    # Sort by probability descending
    outcomes.sort(key=lambda x: x["probability"], reverse=True)
    return outcomes


def analyze_gene_compatibility(
    gene: str,
    parent1_data: dict,
    parent2_data: dict,
) -> dict:
    """
    Analyze compatibility for a single gene.
    Returns a structured report for the gene.
    """
    p1_diplotype = parent1_data.get("diplotype", "*1/*1")
    p2_diplotype = parent2_data.get("diplotype", "*1/*1")

    # Get parent phenotypes (local only)
    p1_pheno = get_local_phenotype(gene, p1_diplotype)
    p2_pheno = get_local_phenotype(gene, p2_diplotype)

    # Compute Punnett square
    children = compute_punnett_square(p1_diplotype, p2_diplotype)

    # Merge and look up phenotypes
    child_outcomes = merge_child_outcomes(children, gene)

    # Determine worst-case child risk
    max_risk = max(o["risk_score"] for o in child_outcomes) if child_outcomes else 0
    high_risk_prob = sum(
        o["probability"] for o in child_outcomes if o["severity"] in ("HIGH",)
    )

    # Gene-level risk assessment
    if high_risk_prob >= 50:
        gene_risk = "HIGH"
    elif high_risk_prob >= 25:
        gene_risk = "MODERATE"
    elif max_risk >= 45:
        gene_risk = "LOW"
    else:
        gene_risk = "NORMAL"

    return {
        "gene": gene,
        "drug_classes_affected": GENE_DRUG_CLASSES.get(gene, ""),
        "parent1": {
            "diplotype": p1_diplotype,
            "phenotype": p1_pheno["phenotype"],
            "activity_score": p1_pheno.get("activity_score"),
        },
        "parent2": {
            "diplotype": p2_diplotype,
            "phenotype": p2_pheno["phenotype"],
            "activity_score": p2_pheno.get("activity_score"),
        },
        "child_outcomes": child_outcomes,
        "high_risk_probability": high_risk_prob,
        "max_child_risk_score": max_risk,
        "gene_risk_level": gene_risk,
        "punnett_square": [
            {
                "from_parent1": c["from_parent1"],
                "from_parent2": c["from_parent2"],
                "diplotype": c["diplotype"],
            }
            for c in children
        ],
    }


def compute_overall_score(gene_reports: list[dict]) -> dict:
    """
    Compute an overall compatibility score (0-100).
    100 = perfectly compatible (all children Normal Metabolizer).
    0 = highly incompatible (all children Poor Metabolizer).

    Formula:
    - For each gene, compute weighted avg risk of child outcomes.
    - Overall = 100 - avg(gene_risk_scores)
    """
    if not gene_reports:
        return {"score": 100, "label": "Excellent", "description": "No data to analyze."}

    gene_risk_scores = []
    for report in gene_reports:
        # Weighted average risk for this gene's child outcomes
        weighted_risk = sum(
            o["risk_score"] * (o["probability"] / 100.0)
            for o in report["child_outcomes"]
        )
        gene_risk_scores.append(weighted_risk)

    avg_risk = sum(gene_risk_scores) / len(gene_risk_scores)
    compatibility_score = round(max(0, min(100, 100 - avg_risk)), 1)

    if compatibility_score >= 85:
        label = "Excellent"
        description = "Very low probability of inherited pharmacogenomic risks."
    elif compatibility_score >= 70:
        label = "Good"
        description = "Low probability of significant inherited ADR risks."
    elif compatibility_score >= 50:
        label = "Moderate"
        description = "Some pharmacogenomic risks may be inherited. Genetic counseling recommended."
    elif compatibility_score >= 30:
        label = "Concerning"
        description = "Notable probability of inherited ADR risks. Genetic counseling strongly recommended."
    else:
        label = "High Risk"
        description = "Significant inherited pharmacogenomic risks identified. Professional genetic counseling essential."

    return {
        "score": compatibility_score,
        "label": label,
        "description": description,
        "genes_analyzed": len(gene_reports),
        "average_child_risk": round(avg_risk, 1),
    }


def run_compatibility_analysis(vcf1_text: str, vcf2_text: str) -> dict:
    """
    Main entry point: parse two VCF files & return full compatibility report.
    100% local, deterministic, no external API calls.
    """
    # Parse both VCF files
    parsed1 = parse_vcf_content(vcf1_text)
    parsed2 = parse_vcf_content(vcf2_text)

    if not parsed1["success"]:
        return {
            "success": False,
            "error": f"Failed to parse Partner 1 VCF: {parsed1.get('error', 'Unknown error')}",
        }
    if not parsed2["success"]:
        return {
            "success": False,
            "error": f"Failed to parse Partner 2 VCF: {parsed2.get('error', 'Unknown error')}",
        }

    # Analyze each gene
    gene_reports = []
    for gene in COMPATIBILITY_GENES:
        p1_gene_data = parsed1["genes"].get(gene, {"diplotype": "*1/*1", "variants": [], "active_variants": []})
        p2_gene_data = parsed2["genes"].get(gene, {"diplotype": "*1/*1", "variants": [], "active_variants": []})

        report = analyze_gene_compatibility(gene, p1_gene_data, p2_gene_data)
        gene_reports.append(report)

    # Compute overall score
    overall = compute_overall_score(gene_reports)

    # Count flagged genes
    flagged_genes = [r for r in gene_reports if r["gene_risk_level"] in ("HIGH", "MODERATE")]

    return {
        "success": True,
        "partner1_sample": parsed1["sample_id"],
        "partner2_sample": parsed2["sample_id"],
        "overall_compatibility": overall,
        "flagged_gene_count": len(flagged_genes),
        "total_genes_analyzed": len(gene_reports),
        "gene_reports": gene_reports,
        "metadata": {
            "pipeline": "Deterministic Mendelian PGx",
            "ai_ml_used": False,
            "external_api": False,
            "source": "Local CPIC Tables + Rule-Based Risk Engine",
        },
    }
