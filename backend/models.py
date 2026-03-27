"""
Pydantic models for GeneGuard request / response schemas.
"""

from __future__ import annotations

from typing import Literal, Optional, List

from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class PatientInput(BaseModel):
    """Payload sent by the front-end."""

    patient_id: str = Field(..., examples=["P-10042"], description="Unique patient identifier")
    prescribed_drug: Optional[str] = Field(default=None, examples=["sertraline"], description="Single drug (legacy)")
    drugs: List[str] = Field(default_factory=list, examples=[["sertraline", "clopidogrel"]], description="List of drugs to analyze (max 5)")
    allele_calls: dict[str, str] = Field(
        ...,
        examples=[{"CYP2D6": "*4/*4", "CYP2C19": "*1/*2"}],
        description="Mapping of gene symbol → star-allele diplotype",
    )

    def get_drugs(self) -> List[str]:
        """Resolve drug list: prefer 'drugs', fall back to 'prescribed_drug'."""
        if self.drugs:
            return self.drugs[:5]
        if self.prescribed_drug:
            return [self.prescribed_drug]
        return []


# ── Response ─────────────────────────────────────────────────────────────────

class AnalysisResult(BaseModel):
    """Single gene-drug analysis result returned to the front-end."""

    patient_id: str
    drug: str
    gene: str
    allele: str = ""
    phenotype: str = ""
    risk_score: float = Field(default=0, ge=0, le=100)
    severity: str = "NORMAL"
    evidence_level: str = ""
    recommendation: str = ""
    evidence_breakdown: dict = Field(default_factory=dict)
    pmids: List[str] = Field(default_factory=list)
    cpic_source: str = ""
    activity_score: Optional[float] = None
    cpic_recommendation: str = ""
    cpic_classification: str = ""
    cpic_guideline_url: str = ""
    ehr_priority: str = ""
    consultation_text: str = ""
    alternatives: List[dict] = Field(default_factory=list)
