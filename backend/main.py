"""
GeneGuard – Pharmacogenomics Risk Analysis API
FastAPI backend entry point.
All clinical recommendations are deterministic (no AI/ML/NLP).
"""

from dotenv import load_dotenv
load_dotenv()

import os
import json
import time
import asyncio

from database import create_tables, create_vcf_table, get_db, VCFUpload, VCFStatus  # noqa: E402
from auth_routes import router as auth_router, get_current_user, User  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from fastapi import FastAPI, HTTPException, File, UploadFile, Depends  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from models import PatientInput, AnalysisResult  # noqa: E402
from phenotype_mapper import map_phenotype  # noqa: E402
from pharmgkb_lookup import lookup_interaction, get_relevant_gene  # noqa: E402
from risk_engine import calculate_risk, get_alternatives  # noqa: E402
from evidence_breakdown import build_evidence_breakdown  # noqa: E402
from vcf_parser import parse_vcf_content  # noqa: E402
from cpic_client import (  # noqa: E402
    get_cpic_phenotype,
    get_cpic_recommendation,
    DRUG_RXNORM_MAP,
)

app = FastAPI(
    title="GeneGuard API",
    description="Pharmacogenomics drug-interaction risk analysis by GeneGuard",
    version="0.1.0",
)

create_tables()
create_vcf_table()
app.include_router(auth_router)

# ---------------------------------------------------------------------------
# CORS – allow the Vite dev-server on localhost:5173
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://team-overfitters-project-production.up.railway.app",
        "https://team-overfitters-project.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/sample-patients")
async def sample_patients():
    return [
        {
            "patient_id": "P-10042",
            "prescribed_drug": "sertraline",
            "allele_calls": {"CYP2D6": "*4/*4", "CYP2C19": "*1/*2"}
        },
        {
            "patient_id": "P-20088",
            "prescribed_drug": "clopidogrel",
            "allele_calls": {"CYP2C19": "*2/*2", "CYP2D6": "*1/*1"}
        },
        {
            "patient_id": "P-30015",
            "prescribed_drug": "warfarin",
            "allele_calls": {"CYP2C9": "*3/*3"}
        }
    ]


@app.post("/api/analyze")
async def analyze(payload: PatientInput):
    """
    Accept patient genetic / medication data and return a list of
    pharmacogenomic risk results — one per drug in the request.
    Supports both legacy single-drug (prescribed_drug) and multi-drug (drugs[]).
    Drugs are analyzed sequentially to avoid API rate limits.
    If one drug fails, the rest continue and partial results are returned.
    """
    drug_list = payload.get_drugs()
    if not drug_list:
        raise HTTPException(status_code=400, detail="No drugs specified for analysis")

    results = []

    for idx, drug_name in enumerate(drug_list):
        # Brief pause between sequential calls
        if idx > 0:
            time.sleep(0.2)
        try:
            relevant_gene = get_relevant_gene(drug_name)
            if not relevant_gene:
                results.append({
                    "patient_id": payload.patient_id,
                    "drug": drug_name,
                    "error": f"No relevant gene mapping found for drug '{drug_name}'"
                })
                continue

            if relevant_gene not in payload.allele_calls:
                results.append({
                    "patient_id": payload.patient_id,
                    "drug": drug_name,
                    "gene": relevant_gene,
                    "error": f"Missing allele data for gene {relevant_gene}"
                })
                continue

            gene = relevant_gene
            diplotype = payload.allele_calls[gene]

            # Step 1 – Derive metaboliser phenotype via CPIC API
            cpic_result = await get_cpic_phenotype(gene, diplotype)
            phenotype = cpic_result["phenotype"]
            cpic_source = cpic_result["source"]
            activity_score = cpic_result.get("activity_score")
            cpic_guideline_url = cpic_result.get("guideline_url", "")
            ehr_priority = cpic_result.get("ehr_priority", "")
            consultation_text = cpic_result.get("consultation_text", "")

            # Step 2 – Look up PharmGKB clinical annotations
            annotation = lookup_interaction(gene, phenotype, drug_name)

            # Step 2b – Get CPIC drug recommendation
            rxnorm_id = DRUG_RXNORM_MAP.get(drug_name.lower(), "")
            cpic_rec = {}
            if rxnorm_id:
                cpic_rec = await get_cpic_recommendation(
                    gene, phenotype, rxnorm_id
                )

            # Step 3 – Score the risk
            risk_score, severity = calculate_risk(
                phenotype, annotation.get("evidence_level", "none")
            )

            # Step 4 – Get safer alternatives
            alternatives = get_alternatives(gene, phenotype, drug_name, payload.allele_calls)

            # Step 5 – Build deterministic Evidence Breakdown
            evidence = build_evidence_breakdown(
                gene=gene,
                diplotype=diplotype,
                phenotype=phenotype,
                drug=drug_name,
                risk_score=risk_score,
                severity=severity,
                evidence_level=annotation.get("evidence_level", "none"),
                annotation_text=annotation.get("annotation_text", ""),
                pmids=annotation.get("pmids", []),
                cpic_source=cpic_source,
                activity_score=activity_score,
                cpic_recommendation=cpic_rec.get("cpic_recommendation", ""),
                cpic_guideline_url=cpic_guideline_url,
                consultation_text=consultation_text,
            )

            result = AnalysisResult(
                patient_id=payload.patient_id,
                drug=drug_name,
                gene=gene,
                allele=diplotype,
                phenotype=phenotype,
                risk_score=risk_score,
                severity=severity,
                evidence_level=annotation.get("evidence_level", "none"),
                recommendation=cpic_rec.get("recommendation", "Review clinical annotation for detailed guidelines."),
                evidence_breakdown=evidence,
                pmids=annotation.get("pmids", []),
                cpic_source=cpic_source,
                activity_score=activity_score,
                cpic_recommendation=cpic_rec.get("cpic_recommendation", ""),
                cpic_classification=cpic_rec.get("classification", ""),
                cpic_guideline_url=cpic_guideline_url,
                ehr_priority=ehr_priority,
                consultation_text=consultation_text,
                alternatives=alternatives,
            )
            results.append(result.dict())

        except Exception as drug_exc:
            results.append({
                "patient_id": payload.patient_id,
                "drug": drug_name,
                "error": str(drug_exc)
            })

    if not results:
        raise HTTPException(status_code=500, detail="All drug analyses failed")

    return results


@app.post("/api/analyze/vcf")
async def analyze_vcf(
    file: UploadFile = File(...),
    drug: str = "sertraline",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept a VCF file upload.
    Parse it, extract CYP genes,
    run through existing analysis pipeline.
    """
    try:
        # Read file content
        content = await file.read()
        try:
            vcf_text = content.decode("utf-8")
        except UnicodeDecodeError:
            vcf_text = content.decode(
                "utf-8", errors="replace"
            )

        # Parse VCF
        parsed = parse_vcf_content(vcf_text)

        if not parsed["success"]:
            raise HTTPException(
                status_code=400,
                detail=f"VCF parse error: {parsed.get('error', 'Unknown error')}"
            )

        # Process each gene through existing pipeline
        results = []

        for gene, gene_data in parsed["genes"].items():
            diplotype = gene_data["diplotype"]
            active_variants = gene_data["active_variants"]
            all_variants = gene_data["variants"]

            # Step 1 – CPIC phenotype
            cpic_data = await get_cpic_phenotype(
                gene, diplotype
            )
            phenotype = cpic_data.get(
                "phenotype", "Unknown"
            )

            # Step 2 – PharmGKB lookup
            interaction = lookup_interaction(
                gene, phenotype, drug
            )

            # Step 2b – CPIC recommendation
            rxnorm_id = DRUG_RXNORM_MAP.get(
                drug.lower(), ""
            )
            cpic_rec = {}
            if rxnorm_id:
                cpic_rec = await get_cpic_recommendation(
                    gene, phenotype, rxnorm_id
                )

            # Step 3 – Score the risk
            risk_score, severity = calculate_risk(
                phenotype,
                interaction.get("evidence_level", "none")
            )
            risk = {"risk_score": risk_score, "severity": severity}

            # Step 4 – Safer alternatives
            alternatives = get_alternatives(
                gene, phenotype, drug, {}
            )

            # Step 5 – Build deterministic Evidence Breakdown
            evidence = build_evidence_breakdown(
                gene=gene,
                diplotype=diplotype,
                phenotype=phenotype,
                drug=drug,
                risk_score=risk_score,
                severity=severity,
                evidence_level=interaction.get("evidence_level", "none"),
                annotation_text=interaction.get("annotation_text", ""),
                pmids=interaction.get("pmids", []),
                cpic_source=cpic_data.get("source", "CPIC Official API"),
                activity_score=cpic_data.get("activity_score"),
                cpic_recommendation=cpic_rec.get("cpic_recommendation", ""),
                cpic_guideline_url=cpic_data.get("guideline_url", ""),
                consultation_text=cpic_data.get("consultation_text", ""),
            )

            # Build result
            result = AnalysisResult(
                patient_id=parsed["sample_id"],
                drug=drug,
                gene=gene,
                allele=diplotype,
                phenotype=phenotype,
                risk_score=risk["risk_score"],
                severity=risk["severity"],
                evidence_level=interaction.get(
                    "evidence_level", ""
                ),
                recommendation=cpic_rec.get(
                    "recommendation", "Review clinical annotation for detailed guidelines."
                ),
                evidence_breakdown=evidence,
                pmids=interaction.get("pmids", []),
                cpic_source=cpic_data.get(
                    "source", "CPIC Official API"
                ),
                activity_score=cpic_data.get(
                    "activity_score"
                ),
                cpic_recommendation=cpic_rec.get(
                    "cpic_recommendation", ""
                ),
                cpic_classification=cpic_rec.get(
                    "classification", ""
                ),
                cpic_guideline_url=cpic_data.get(
                    "guideline_url", ""
                ),
                ehr_priority=cpic_data.get(
                    "ehr_priority", ""
                ),
                consultation_text=cpic_data.get(
                    "consultation_text", ""
                ),
                alternatives=alternatives
            )

            results.append({
                "analysis": result.dict(),
                "vcf_metadata": {
                    "source": "VCF File",
                    "vcf_version": parsed["vcf_version"],
                    "sample_id": parsed["sample_id"],
                    "diplotype_called": diplotype,
                    "variants_detected": [
                        {
                            "rsid": v["rsid"],
                            "genotype": v["genotype"],
                            "variant_name": v["variant_name"],
                            "allele": v["allele"]
                        }
                        for v in all_variants
                    ],
                    "active_variants": [
                        {
                            "rsid": v["rsid"],
                            "genotype": v["genotype"],
                            "variant_name": v["variant_name"]
                        }
                        for v in active_variants
                    ],
                    "rsids_scanned": parsed["rsids_detected"],
                    "total_variants_found": parsed["total_variants_found"]
                }
            })

        # Save to database
        try:
            genes_analyzed = {}
            for gene, gene_data in parsed["genes"].items():
                variants_dict = {}
                for v in gene_data["variants"]:
                    variants_dict[v["rsid"]] = v["genotype"]
                genes_analyzed[gene] = variants_dict

            vcf_record = VCFUpload(
                user_id=current_user.id,
                patient_id=parsed["sample_id"],
                filename=file.filename,
                file_content=vcf_text,
                genes_analyzed=genes_analyzed,
                status=VCFStatus.analyzed
            )
            db.add(vcf_record)
            db.commit()
            db.refresh(vcf_record)
            vcf_id = vcf_record.id
        except Exception as db_err:
            print(f"Error saving VCF to DB: {db_err}")
            vcf_id = None

        return {
            "success": True,
            "vcf_id": vcf_id,
            "file_name": file.filename,
            "drug_analyzed": drug,
            "genes_analyzed": list(
                parsed["genes"].keys()
            ),
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"VCF analysis failed: {str(e)}"
        )


@app.get("/api/vcf/history")
async def get_vcf_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        from sqlalchemy import desc
        history = db.query(VCFUpload).filter(
            VCFUpload.user_id == current_user.id
        ).order_by(desc(VCFUpload.upload_date)).all()
        
        return [
            {
                "vcf_id": record.id,
                "filename": record.filename,
                "date": record.upload_date.isoformat() if record.upload_date else None,
                "patient_id": record.patient_id,
                "status": record.status.value if record.status else None
            }
            for record in history
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch VCF history: {str(e)}")


# ---------------------------------------------------------------------------
# Local Medicine Strip Scanner (EasyOCR + RapidFuzz, no cloud API)
# ---------------------------------------------------------------------------
from medicine_scanner import scan_medicine as _scan_medicine, get_drug_entry, search_drugs as local_search_drugs

@app.post("/api/scan-medicine")
async def scan_medicine_endpoint(file: UploadFile = File(...)):
    """
    Local-only medicine strip scanner.
    Uses EasyOCR for text extraction + RapidFuzz for drug name matching.
    No cloud API, no AI/ML for clinical decisions.
    """
    try:
        image_bytes = await file.read()
        result = await asyncio.to_thread(_scan_medicine, image_bytes)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Medicine scan failed: {str(e)}"
        )


class ScanConfirmInput(BaseModel):
    drug_name: str
    patient_gene: str = ""
    patient_allele: str = ""


@app.post("/api/scan-medicine/confirm")
async def confirm_scanned_medicine(payload: ScanConfirmInput):
    """
    Called ONLY after user confirms the detected drug.
    If the drug is PGx-relevant and patient genotype exists,
    runs deterministic CPIC PGx check and returns interaction status.
    Scanner output NEVER directly triggers prescribing.
    """
    drug_name = payload.drug_name.strip()
    entry = get_drug_entry(drug_name)

    if not entry:
        return {
            "confirmed": True,
            "drug_name": drug_name,
            "pgx_relevant": False,
            "message": "Drug confirmed. Unable to identify in database.",
            "pgx_check": None,
        }

    pgx_relevant = entry.get("pgx_relevant", False)

    if not pgx_relevant:
        category = entry.get("category", entry.get("therapeutic_class", ""))
        indication = entry.get("common_indication", "")
        return {
            "confirmed": True,
            "drug_name": drug_name,
            "pgx_relevant": False,
            "message": f"{drug_name} has no known pharmacogenomic interactions. Standard dosing applies.",
            "category": category,
            "common_indication": indication,
            "pgx_check": None,
        }

    # PGx-relevant drug: run deterministic check if genotype provided
    if not payload.patient_gene or not payload.patient_allele:
        return {
            "confirmed": True,
            "drug_name": drug_name,
            "pgx_relevant": True,
            "pgx_genes": entry.get("pgx_genes", []),
            "message": f"Drug is PGx-relevant ({', '.join(entry.get('pgx_genes', []))}). Provide patient genotype for interaction check.",
            "pgx_check": None,
        }

    # Run deterministic CPIC PGx check
    gene = payload.patient_gene
    allele = payload.patient_allele

    cpic_data = await get_cpic_phenotype(gene, allele)
    phenotype = cpic_data.get("phenotype", "Unknown")

    interaction = lookup_interaction(gene, phenotype, drug_name.lower())
    risk_score, severity = calculate_risk(
        phenotype, interaction.get("evidence_level", "none")
    )

    # Build evidence breakdown
    evidence = build_evidence_breakdown(
        gene=gene, diplotype=allele, phenotype=phenotype,
        drug=drug_name, risk_score=risk_score, severity=severity,
        evidence_level=interaction.get("evidence_level", "none"),
        annotation_text=interaction.get("annotation_text", ""),
        pmids=interaction.get("pmids", []),
        cpic_source=cpic_data.get("source", ""),
        activity_score=cpic_data.get("activity_score"),
        cpic_guideline_url=cpic_data.get("guideline_url", ""),
        consultation_text=cpic_data.get("consultation_text", ""),
    )

    # Get alternatives only if HIGH risk
    alternatives = []
    if severity == "HIGH":
        alternatives = entry.get("alternatives", [])

    return {
        "confirmed": True,
        "drug_name": drug_name,
        "pgx_relevant": True,
        "pgx_genes": entry.get("pgx_genes", []),
        "pgx_check": {
            "gene": gene,
            "allele": allele,
            "phenotype": phenotype,
            "risk_score": risk_score,
            "severity": severity,
            "evidence_breakdown": evidence,
            "alternatives": alternatives,
        },
        "message": (
            f"{'⚠️ HIGH RISK' if severity == 'HIGH' else '✓ ' + severity} — "
            f"{phenotype} for {gene}. "
            f"{'Consider alternatives: ' + ', '.join(alternatives) if alternatives else 'Standard precautions apply.'}"
        ),
    }


from pharmgkb_lookup import get_drug_database_info
from therapeutic_classes import THERAPEUTIC_CLASS, GENE_PATHWAY, get_alternatives as tc_get_alternatives

@app.get("/api/drug/search")
async def api_search_drugs(q: str = "", limit: int = 10):
    return local_search_drugs(q, limit=limit)


@app.get("/api/drug/database")
async def api_drug_database():
    return get_drug_database_info()



class QuickCheckInput(BaseModel):
    drug_name: str
    patient_genotype: str | None = None

@app.post("/api/drug/quick-check")
async def api_drug_quick_check(payload: QuickCheckInput):
    drug = payload.drug_name.lower().strip()
    gene = get_relevant_gene(drug)
    
    if not gene or gene == "No PGx":
        return {
            "drug": drug,
            "gene": "No PGx",
            "risk_preview": "UNKNOWN",
            "message": "No specific pharmacogenomic interaction identified.",
            "has_guideline": False,
            "cpic_url": ""
        }
        
    response = {
        "drug": drug,
        "gene": gene,
        "risk_preview": "UNKNOWN",
        "message": f"Requires {gene} testing.",
        "has_guideline": True,
        "cpic_url": ""
    }
        
    if payload.patient_genotype:
        # Calculate risk based on genotype
        try:
            cpic_res = await get_cpic_phenotype(gene, payload.patient_genotype)
            phenotype = cpic_res.get("phenotype", "Unknown")
            response["cpic_url"] = cpic_res.get("guideline_url", "")
            
            interaction = lookup_interaction(gene, phenotype, drug)
            risk_score, severity = calculate_risk(phenotype, interaction.get("evidence_level", "none"))
            
            response["risk_preview"] = severity.upper()
            
            if severity == "high":
                response["message"] = f"High risk for {phenotype}. Consider alternatives."
            elif severity == "moderate":
                response["message"] = f"Moderate risk for {phenotype}. Monitor therapy."
            else:
                response["message"] = f"Standard precautions apply for {phenotype}."
                
        except Exception:
            pass # Fail gracefully to return default message
            
    return response


@app.get("/api/drugs/list")
async def api_drugs_list():
    """Return list of available drugs for multi-drug selection."""
    return [
        {"name": "sertraline", "category": "SSRI", "gene": "CYP2D6"},
        {"name": "clopidogrel", "category": "Antiplatelet", "gene": "CYP2C19"},
        {"name": "citalopram", "category": "SSRI", "gene": "CYP2C19"},
        {"name": "warfarin", "category": "Anticoagulant", "gene": "CYP2C9"},
        {"name": "simvastatin", "category": "Statin", "gene": "SLCO1B1"},
        {"name": "fluorouracil", "category": "Chemotherapy", "gene": "DPYD"},
        {"name": "codeine", "category": "Opioid", "gene": "CYP2D6"},
        {"name": "azathioprine", "category": "Immunosuppressant", "gene": "TPMT"},
    ]


class AlternativeRequest(BaseModel):
    current_drug: str
    gene: str
    phenotype: str
    patient_alleles: dict = {}


@app.post("/api/alternatives")
async def api_alternatives(payload: AlternativeRequest):
    """Return enhanced alternative drug recommendations."""
    alts = tc_get_alternatives(
        drug=payload.current_drug,
        gene=payload.gene,
        phenotype=payload.phenotype,
        patient_alleles=payload.patient_alleles,
    )
    return {
        "current_drug": payload.current_drug,
        "alternatives": alts,
        "disclaimer": "Consult prescribing physician before making any medication changes. GeneGuard provides decision support only.",
    }


# ---------------------------------------------------------------------------
# Genetic Compatibility Checker (Mendelian, 100% local, no external API)
# ---------------------------------------------------------------------------
from compatibility_checker import run_compatibility_analysis

@app.post("/api/compatibility")
async def analyze_compatibility(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
):
    """
    Accept two VCF files (one per partner) and compute Mendelian
    inheritance probabilities for pharmacogenomic risks.
    100% deterministic, 100% local — no external API calls.
    """
    try:
        # Read both files
        content1 = await file1.read()
        content2 = await file2.read()

        try:
            vcf1_text = content1.decode("utf-8")
        except UnicodeDecodeError:
            vcf1_text = content1.decode("utf-8", errors="replace")

        try:
            vcf2_text = content2.decode("utf-8")
        except UnicodeDecodeError:
            vcf2_text = content2.decode("utf-8", errors="replace")

        # Run compatibility analysis (fully local)
        result = run_compatibility_analysis(vcf1_text, vcf2_text)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Analysis failed"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Compatibility analysis failed: {str(e)}"
        )


@app.on_event("startup")
async def startup_check():
    print("\n========================================")
    print("  GENEGUARD STARTED SUCCESSFULLY")
    print("========================================")
    print("  Pipeline: Deterministic PGx")
    print("  Scanner : Local OCR (EasyOCR)")
    print("  DB      : geneguard_db")
    print("  Port    : 8000")
    print("  Search  : Fuzzy Enabled")
    print("  AI/LLM  : NONE (all deterministic)")
    print("========================================\n")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
