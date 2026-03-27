import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def generate_explanation(
    gene: str,
    allele: str,
    phenotype: str,
    drug: str,
    risk_score: float,
    cpic_recommendation: str = "",
    consultation_text: str = ""
) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return "AI explanation unavailable."
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.5-flash-lite"
        )
        prompt = f"""You are a clinical pharmacogenomics expert.
Write a concise 3-sentence clinical explanation for a doctor.
Patient data:
- Gene: {gene}
- Allele: {allele}
- Phenotype: {phenotype}
- Drug: {drug}
- Risk Score: {risk_score}/100
- CPIC Recommendation: {cpic_recommendation}
Write exactly 3 sentences.
Be specific and clinical.
Mention gene name and phenotype.
State what action doctor should take.
No bullet points.
"""
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"AI explanation unavailable: {str(e)}"
