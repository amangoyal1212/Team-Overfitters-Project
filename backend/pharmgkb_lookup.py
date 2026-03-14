"""
# Triggering Pyre analysis
pharmgkb_lookup.py
Loads PharmGKB clinical annotations using pandas at startup.
"""

import pandas as pd
from pathlib import Path

# Paths to data
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ANNOTATIONS_PATH = DATA_DIR / "clinical_annotations.tsv"

# Load dataframe globally at module startup
df_annotations = pd.DataFrame()
if ANNOTATIONS_PATH.exists():
    df_annotations = pd.read_csv(ANNOTATIONS_PATH, sep="\t")
    # Clean up column names handling potential whitespace
    df_annotations.columns = [col.strip() for col in df_annotations.columns]

# Priority mapping for level of evidence
_EVIDENCE_PRIORITY = {
    "1A": 6,
    "1B": 5,
    "2A": 4,
    "2B": 3,
    "3": 2,
    "4": 1,
}

DRUG_ALIASES = {
    "zoloft": "sertraline",
    "prozac": "fluoxetine",
    "paxil": "paroxetine",
    "lexapro": "escitalopram",
    "celexa": "citalopram",
    "plavix": "clopidogrel",
    "coumadin": "warfarin",
    "lipitor": "atorvastatin",
    "zocor": "simvastatin",
    "risperdal": "risperidone"
}

_EXTENDED_DRUG_MAP = {
    "sertraline": "CYP2D6",
    "fluoxetine": "CYP2D6",
    "paroxetine": "CYP2D6",
    "citalopram": "CYP2C19",
    "escitalopram": "CYP2C19",
    "simvastatin": "SLCO1B1",
    "atorvastatin": "SLCO1B1",
    "clopidogrel": "CYP2C19",
    "warfarin": "CYP2C9",
    "codeine": "CYP2D6",
    "fluorouracil": "DPYD",
    "azathioprine": "TPMT",
    "aspirin": "CYP2C19",
    "metoprolol": "CYP2D6",
    "propranolol": "CYP2D6",
    "carvedilol": "CYP2D6",
    "omeprazole": "CYP2C19",
    "pantoprazole": "CYP2C19",
    "lansoprazole": "CYP2C19",
    "ibuprofen": "CYP2C9",
    "celecoxib": "CYP2C9",
    "diclofenac": "CYP2C9",
    "tacrolimus": "CYP3A5",
    "cyclosporine": "CYP3A5",
    "morphine": "CYP2D6",
    "oxycodone": "CYP2D6",
    "hydrocodone": "CYP2D6",
    "tamoxifen": "CYP2D6",
    "atomoxetine": "CYP2D6",
    "risperidone": "CYP2D6",
    "aripiprazole": "CYP2D6",
    "clozapine": "CYP1A2",
    "phenytoin": "CYP2C9",
    "carbamazepine": "CYP2C19",
    "valproic acid": "No PGx",
    "allopurinol": "HLA-B*58:01",
    "abacavir": "HLA-B*57:01"
}

def get_relevant_gene(drug: str) -> str:
    """
    Maps specific antidepressant / statin drugs to their primary relevant gene.
    Returns empty string if unknown.
    """
    return _EXTENDED_DRUG_MAP.get(drug.lower(), "")

def get_drug_database_info() -> list:
    """
    Returns a unified list of drugs with pre-populated fields for the Drug Database table.
    """
    results = []
    
    # Simple heuristic class mapper
    def guess_class(drug_name):
        if drug_name in ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram"]: return "SSRI Antidepressant"
        if drug_name in ["simvastatin", "atorvastatin"]: return "Statin"
        if drug_name in ["clopidogrel", "warfarin"]: return "Anticoagulant / Antiplatelet"
        if drug_name in ["codeine", "morphine", "oxycodone", "hydrocodone"]: return "Opioid Analgesic"
        if drug_name in ["omeprazole", "pantoprazole", "lansoprazole"]: return "Proton Pump Inhibitor (PPI)"
        if drug_name in ["metoprolol", "propranolol", "carvedilol"]: return "Beta Blocker"
        if drug_name in ["ibuprofen", "celecoxib", "diclofenac"]: return "NSAID"
        if drug_name in ["risperidone", "aripiprazole", "clozapine"]: return "Antipsychotic"
        if drug_name in ["tacrolimus", "cyclosporine", "azathioprine"]: return "Immunosuppressant"
        if drug_name in ["fluorouracil", "tamoxifen"]: return "Antineoplastic"
        if drug_name in ["phenytoin", "carbamazepine", "valproic acid"]: return "Anticonvulsant"
        if drug_name in ["allopurinol"]: return "Xanthine Oxidase Inhibitor"
        if drug_name in ["abacavir"]: return "Antiretroviral"
        if drug_name in ["atomoxetine"]: return "ADHD Medication"
        return "Other"

    for drug, gene in _EXTENDED_DRUG_MAP.items():
        # High level heuristics just for demo purposes absent a full database
        evidence = "High (CPIC Level A/B)" if gene != "No PGx" else "None"
        if drug in ["sertraline", "clopidogrel", "warfarin", "codeine", "abacavir", "allopurinol"]:
            evidence = "Highest (CPIC Level A)"
            
        results.append({
            "drug_name": drug,
            "gene": gene,
            "therapeutic_class": guess_class(drug),
            "evidence_level": evidence
        })
    return results


def lookup_interaction(gene: str, phenotype: str, drug: str) -> dict:
    """
    Returns the best PharmGKB interaction match based on highest level of evidence.
    """
    empty_result = {
        "annotation_text": "No PharmGKB annotation found",
        "evidence_level": "none",
        "pmids": []
    }
    
    if df_annotations.empty:
        return empty_result
        
    # Match criteria
    gene_match = df_annotations["Gene"].str.contains(gene, case=False, na=False)
    drug_match = df_annotations["Drug"].str.contains(drug, case=False, na=False)
    phenotype_match = df_annotations["Phenotype Category"].str.contains(phenotype, case=False, na=False)
    
    # Filter the dataframe
    filtered_df = df_annotations[gene_match & drug_match & phenotype_match].copy()
    
    if filtered_df.empty:
        return empty_result
        
    # Add a numeric priority column for sorting based on level of evidence
    filtered_df["_priority"] = filtered_df["Level of Evidence"].apply(
        lambda x: _EVIDENCE_PRIORITY.get(str(x).strip().upper(), 0)
    )
    
    # Sort by priority descending and grab the top row
    top_row = filtered_df.sort_values(by="_priority", ascending=False).iloc[0]
    
    # Parse pmids
    raw_pmids = str(top_row.get("PMID", ""))
    pmids = [p.strip() for p in raw_pmids.split(",") if p.strip()]
    
    return {
        "annotation_text": str(top_row.get("Sentence", empty_result["annotation_text"])),
        "evidence_level": str(top_row.get("Level of Evidence", "none")),
        "pmids": pmids
    }
