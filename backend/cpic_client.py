import httpx
import asyncio
import re

CPIC_BASE = "https://api.cpicpgx.org/v1"

DRUG_RXNORM_MAP = {
    "sertraline":   "RxNorm:36437",
    "citalopram":   "RxNorm:2556",
    "escitalopram": "RxNorm:321988",
    "fluoxetine":   "RxNorm:4493",
    "paroxetine":   "RxNorm:32937",
    "simvastatin":  "RxNorm:36567",
    "atorvastatin": "RxNorm:83367",
}

CYP2D6_TABLE = {
    "*1/*1":   {"phenotype": "Normal Metabolizer", "activity_score": 2.0},
    "*1/*2":   {"phenotype": "Normal Metabolizer", "activity_score": 2.0},
    "*1/*4":   {"phenotype": "Intermediate Metabolizer", "activity_score": 1.0},
    "*1/*10":  {"phenotype": "Intermediate Metabolizer", "activity_score": 1.25},
    "*2/*4":   {"phenotype": "Intermediate Metabolizer", "activity_score": 1.0},
    "*4/*4":   {"phenotype": "Poor Metabolizer", "activity_score": 0.0},
    "*4/*5":   {"phenotype": "Poor Metabolizer", "activity_score": 0.0},
    "*1/*1xN": {"phenotype": "Ultrarapid Metabolizer", "activity_score": 3.0},
    "*2/*2xN": {"phenotype": "Ultrarapid Metabolizer", "activity_score": 3.0},
}

CYP2C19_TABLE = {
    "*1/*1":   {"phenotype": "Normal Metabolizer", "activity_score": 2.0},
    "*1/*2":   {"phenotype": "Intermediate Metabolizer", "activity_score": 1.0},
    "*1/*3":   {"phenotype": "Intermediate Metabolizer", "activity_score": 1.0},
    "*2/*2":   {"phenotype": "Poor Metabolizer", "activity_score": 0.0},
    "*2/*3":   {"phenotype": "Poor Metabolizer", "activity_score": 0.0},
    "*1/*17":  {"phenotype": "Rapid Metabolizer", "activity_score": 2.5},
    "*17/*17": {"phenotype": "Ultrarapid Metabolizer", "activity_score": 3.0},
}

def get_local_phenotype(gene: str, diplotype: str) -> dict:
    tables = {"CYP2D6": CYP2D6_TABLE, "CYP2C19": CYP2C19_TABLE}
    gene_table = tables.get(gene, {})
    result = (
        gene_table.get(diplotype) or
        gene_table.get("/".join(reversed(diplotype.split("/"))))
    )
    if result:
        return {
            "phenotype": result["phenotype"],
            "activity_score": result["activity_score"],
            "ehr_priority": "",
            "consultation_text": "",
            "source": "CPIC 2023 Local Table",
            "cpic_version": "2023",
            "guideline_url": "https://doi.org/10.1002/cpt.2903"
        }
    return {
        "phenotype": "Unknown - Manual Review Required",
        "activity_score": None,
        "ehr_priority": "",
        "consultation_text": "",
        "source": "Not found in CPIC tables",
        "cpic_version": "2023",
        "guideline_url": ""
    }

def fill_consultation_text(text: str, row: dict) -> str:
    """Replace CPIC template placeholders with actual allele function counts."""
    f1 = row.get("function1", "")
    f2 = row.get("function2", "")

    normal_count = sum(1 for f in [f1, f2]
        if "normal" in f.lower())
    decreased_count = sum(1 for f in [f1, f2]
        if "decreased" in f.lower())
    nonfunc_count = sum(1 for f in [f1, f2]
        if "no function" in f.lower())

    text = re.sub(
        r'\[X copies of a normal function allele[^\]]*\]',
        str(normal_count),
        text
    )
    text = re.sub(
        r'\[X copies of a decreased function allele[^\]]*\]',
        str(decreased_count),
        text
    )
    text = re.sub(
        r'\[X copies of a no function allele[^\]]*\]',
        str(nonfunc_count),
        text
    )
    return text


async def get_cpic_phenotype(gene: str, diplotype: str) -> dict:
    url = f"{CPIC_BASE}/diplotype"
    params = {
        "genesymbol": f"eq.{gene}",
        "diplotype": f"eq.{diplotype}"
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            if data and len(data) > 0:
                row = data[0]
                phenotype = row.get("generesult", "")
                if phenotype:
                    raw_consultation = row.get("consultationtext", "")
                    consultation = fill_consultation_text(raw_consultation, row)
                    return {
                        "phenotype": row.get("generesult", "Unknown"),
                        "activity_score": float(
                            row.get("totalactivityscore", 0) or 0
                        ),
                        "ehr_priority": row.get(
                            "ehrpriority", ""
                        ),
                        "consultation_text": consultation,
                        "source": "CPIC Official API v1",
                        "cpic_version": "2023",
                        "guideline_url": (
                            "https://cpicpgx.org/guidelines/"
                            "cpic-guideline-for-ssri-and-"
                            "snri-antidepressants/"
                        )
                    }
    except Exception as e:
        print(f"[CPIC API ERROR] {e} — using local fallback")
    return get_local_phenotype(gene, diplotype)

async def get_cpic_recommendation(
    gene: str, phenotype: str, drug_rxnorm: str
) -> dict:
    import json
    url = f"{CPIC_BASE}/recommendation"
    lookup_key = json.dumps({gene: phenotype})
    params = {
        "drugid": f"eq.{drug_rxnorm}",
        "lookupkey": f"cs.{lookup_key}",
        "population": "eq.general"
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
            if data and len(data) > 0:
                rec = data[0]
                return {
                    "cpic_recommendation": rec.get("drugrecommendation", ""),
                    "classification": rec.get("classification", ""),
                    "comments": rec.get("comments", ""),
                    "cpic_source": True
                }
    except Exception as e:
        print(f"[CPIC REC ERROR] {e}")
    return {
        "cpic_recommendation": "",
        "classification": "",
        "cpic_source": False
    }
