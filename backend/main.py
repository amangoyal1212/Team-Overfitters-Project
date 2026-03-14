"""
# Triggering Pyre analysis
GeneGuard – Pharmacogenomics Risk Analysis API
FastAPI backend entry point.
"""

from dotenv import load_dotenv
load_dotenv()

import os
import json
import time
import base64
import asyncio

import google.generativeai as genai

from database import create_tables, create_vcf_table, get_db, VCFUpload, VCFStatus  # noqa: E402
from auth_routes import router as auth_router, get_current_user, User  # noqa: E402
from sqlalchemy.orm import Session # noqa: E402
from fastapi import FastAPI, HTTPException, File, UploadFile, Depends  # noqa: E402
from fastapi import FastAPI, HTTPException, File, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from models import PatientInput, AnalysisResult  # noqa: E402
from phenotype_mapper import map_phenotype  # noqa: E402
from pharmgkb_lookup import lookup_interaction, get_relevant_gene  # noqa: E402
from risk_engine import calculate_risk, get_alternatives  # noqa: E402
from llm_explainer import generate_explanation  # noqa: E402
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
    allow_origins=["http://localhost:5173"],
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
        # Rate-limit sequential calls to avoid Gemini 429 errors
        if idx > 0:
            time.sleep(1)
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

            # Step 4 – Generate a human-readable explanation via LLM
            llm_explanation = await asyncio.to_thread(
                generate_explanation,
                gene=gene,
                allele=diplotype,
                phenotype=phenotype,
                drug=drug_name,
                risk_score=risk_score,
                cpic_recommendation=cpic_rec.get("recommendation", ""),
                consultation_text=consultation_text
            )

            # Step 5 – Get safer alternatives
            alternatives = get_alternatives(gene, phenotype, drug_name, payload.allele_calls)

            result = AnalysisResult(
                patient_id=payload.patient_id,
                drug=drug_name,
                gene=gene,
                allele=diplotype,
                phenotype=phenotype,
                risk_score=risk_score,
                severity=severity,
                evidence_level=annotation.get("evidence_level", "none"),
                mechanism="See LLM explanation for mechanism details.",
                recommendation=cpic_rec.get("recommendation", "Review clinical annotation for detailed guidelines."),
                llm_explanation=llm_explanation,
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

            # Step 4 – Generate LLM explanation
            llm_text = await asyncio.to_thread(
                generate_explanation,
                gene=gene,
                allele=diplotype,
                phenotype=phenotype,
                drug=drug,
                risk_score=risk_score,
                cpic_recommendation=cpic_rec.get("recommendation", ""),
                consultation_text=cpic_data.get("consultation_text", "")
            )

            # Step 5 – Safer alternatives
            alternatives = get_alternatives(
                gene, phenotype, drug, {}
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
                mechanism="See LLM explanation for mechanism details.",
                recommendation=cpic_rec.get(
                    "recommendation", "Review clinical annotation for detailed guidelines."
                ),
                llm_explanation=llm_text,
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


@app.post("/api/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    patient_gene: str = "CYP2D6",
    patient_allele: str = "*4/*4"
):
    try:
        image_bytes = await file.read()
        image_b64 = base64.b64encode(
            image_bytes
        ).decode("utf-8")
        content_type = (
            file.content_type or "image/jpeg"
        )

        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY not configured"
            )

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-flash-latest"
        )

        extraction_prompt = """
Look at this medicine photo carefully.
Extract the generic drug name from the
pill strip, bottle label, or packaging.
Return ONLY a JSON object like this:
{
  "drug_name": "clopidogrel",
  "brand_name": "Plavix",
  "dosage": "75mg",
  "confidence": "high"
}
If cannot identify return:
{
  "drug_name": "unknown",
  "brand_name": "",
  "dosage": "",
  "confidence": "low"
}
Only JSON. Nothing else.
"""

        image_part = {
            "mime_type": content_type,
            "data": image_b64
        }

        response = model.generate_content(
            [extraction_prompt, image_part]
        )

        raw_text = response.text.strip()
        if "```json" in raw_text:
            raw_text = raw_text.split(
                "```json"
            )[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split(
                "```"
            )[1].split("```")[0].strip()

        try:
            drug_data = json.loads(raw_text)
        except Exception:
            drug_data = {
                "drug_name": "unknown",
                "confidence": "low"
            }

        extracted_drug = drug_data.get(
            "drug_name", "unknown"
        ).lower().strip()
        brand_name = drug_data.get("brand_name", "")
        confidence = drug_data.get("confidence", "low")

        if extracted_drug == "unknown":
            return {
                "success": False,
                "error": "Could not identify medicine. Try a clearer photo."
            }

        DRUG_NAME_MAP = {
            "clopidogrel": "clopidogrel",
            "plavix": "clopidogrel",
            "sertraline": "sertraline",
            "zoloft": "sertraline",
            "citalopram": "citalopram",
            "celexa": "citalopram",
            "escitalopram": "escitalopram",
            "lexapro": "escitalopram",
            "fluoxetine": "fluoxetine",
            "prozac": "fluoxetine",
            "paroxetine": "paroxetine",
            "paxil": "paroxetine",
            "warfarin": "warfarin",
            "coumadin": "warfarin",
            "simvastatin": "simvastatin",
            "zocor": "simvastatin",
            "atorvastatin": "atorvastatin",
            "lipitor": "atorvastatin",
            "codeine": "codeine",
            "fluorouracil": "fluorouracil",
            "azathioprine": "azathioprine",
            "risperidone": "risperidone",
            "risperdal": "risperidone"
        }

        mapped_drug = DRUG_NAME_MAP.get(
            extracted_drug, extracted_drug
        )
        gene = patient_gene
        allele = patient_allele

        cpic_data = await get_cpic_phenotype(
            gene, allele
        )
        phenotype = cpic_data.get(
            "phenotype", "Unknown"
        )

        interaction = lookup_interaction(
            gene, phenotype, mapped_drug
        )
        cpic_rec = await get_cpic_recommendation(
            gene,
            phenotype,
            DRUG_RXNORM_MAP.get(mapped_drug, "")
        )
        risk_score, severity = calculate_risk(
            phenotype,
            interaction.get("evidence_level", "none")
        )
        alternatives = get_alternatives(
            gene, phenotype, mapped_drug, {}
        )
        llm_text = await asyncio.to_thread(
            generate_explanation,
            gene, allele, phenotype,
            mapped_drug,
            risk_score,
            cpic_rec.get("recommendation", ""),
            cpic_data.get("consultation_text", "")
        )

        return {
            "success": True,
            "scanned_drug": extracted_drug,
            "brand_name": brand_name,
            "mapped_drug": mapped_drug,
            "confidence": confidence,
            "gene": gene,
            "allele": allele,
            "phenotype": phenotype,
            "risk_score": risk_score,
            "severity": severity,
            "recommendation": interaction.get(
                "recommendation", ""
            ),
            "llm_explanation": llm_text,
            "alternatives": alternatives,
            "cpic_recommendation": cpic_rec.get(
                "recommendation", ""
            ),
            "consultation_text": cpic_data.get(
                "consultation_text", ""
            ),
            "ehr_priority": cpic_data.get(
                "ehr_priority", ""
            ),
            "activity_score": cpic_data.get(
                "activity_score"
            ),
            "source": "Camera Scan + Gemini Vision"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image analysis failed: {str(e)}"
        )


from drug_search import search_drugs
from pharmgkb_lookup import get_drug_database_info
from therapeutic_classes import THERAPEUTIC_CLASS, GENE_PATHWAY, get_alternatives as tc_get_alternatives

@app.get("/api/drug/search")
async def api_search_drugs(q: str = "", limit: int = 10):
    return search_drugs(q, limit=limit)


@app.get("/api/drug/database")
async def api_drug_database():
    return get_drug_database_info()


from pydantic import BaseModel
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


@app.on_event("startup")
async def startup_check():
    key = os.getenv("GEMINI_API_KEY", "")
    print("\n========================================")
    print("  GENEGUARD STARTED SUCCESSFULLY")
    print("========================================")
    if key:
        print(f"  Gemini  : OK (...{key[-6:]})")
    else:
        print("  Gemini  : MISSING!")
    print("  DB      : geneguard_db")
    print("  Port    : 8000")
    print("  Model   : gemini-flash-latest")
    print("  Search  : Fuzzy Enabled")
    print("========================================\n")
