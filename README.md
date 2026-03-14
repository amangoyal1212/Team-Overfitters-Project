# 🧬 GeneGuard: Precision Pharmacogenomics at Scale

> **"Adverse drug reactions are the 4th leading cause of death in hospital settings. GeneGuard is here to change that."**

---

## 🚀 The Vision
In a world where medical treatments are often "one-size-fits-all," **GeneGuard** bridges the gap between raw genomic data and actionable clinical insights. We empower healthcare providers with a precision medicine dashboard that analyzes a patient's genetic profile to predict drug efficacy and safety—before the first prescription is even written.

## ⚠️ The Problem
Every year, millions of patients suffer from Adverse Drug Reactions (ADRs) because their bodies metabolize medications differently.
- **Genetic Complexity**: Deciphering raw DNA data (VCF files) is traditionally slow and requires specialized bioinformatics knowledge.
- **Information Silos**: Clinical guidelines (CPIC) and drug interaction databases are scattered and difficult to access at the point of care.
- **Actionability Gap**: Doctors need clear, human-readable explanations, not just raw "ACGT" sequences.

## 🛡️ The Solution: GeneGuard
GeneGuard is an end-to-end clinical decision support system that transforms complex genomic data into simple, life-saving recommendations.

### 💎 Key Features
*   **Instant Genomic Intelligence**: Our custom, pure-Python VCF parser decodes raw genome files in seconds, identifying critical variants in key metabolic genes like `CYP2D6` and `CYP2C19`.
*   **Clinical Gold-Standard Integration**: Real-time integration with the **CPIC (Clinical Pharmacogenetics Implementation Consortium) API** ensures all recommendations follow world-class medical standards.
*   **AI-Powered Clinical Explanations**: Leveraging Large Language Models (Gemini), GeneGuard generates natural language summaries that explain *why* a specific risk exists, making complex biology understandable for clinicians.
*   **Risk Scoring Engine**: A proprietary logic engine that quantifies risk (Normal, Moderate, or High) based on phenotype, activity scores, and drug-gene interaction data.
*   **Medical-Grade UX**: A stunning, premium interface designed for high-stakes environments, featuring dark/light modes, pulsing risk alerts, and a seamless data-upload workflow.
*   **Ethical "India Context"**: Specialized analysis modules that consider genetic distribution within the Indian population.

---

## ⚙️ How It Works (The Engine Room)

GeneGuard is built on a high-performance, modern tech stack designed for security and speed.

### 1. Data Ingestion & Parsing
The backend accepts **Patient JSON profiles** or raw **VCF (Variant Call Format)** genome files. Unlike typical systems that rely on heavy bioinformatics libraries, GeneGuard uses a **Pure-Python VCF Parser** designed for zero-dependency portability on Windows and Linux systems.

### 2. The Analysis Pipeline
1.  **Variant Extraction**: Identifies rsIDs and genotypes from the uploaded genomic data.
2.  **Diplotype Mapping**: Maps variants to functional alleles (e.g., `*1/*4`) and calculates functional phenotypes (e.g., "Poor Metabolizer").
3.  **Clinical Lookup**: 
    - Queries **CPIC** for official phenotype-based dosing guidelines.
    - Queries **PharmGKB** for evidence levels and scientific references.
4.  **Risk Calculation**: The `risk_engine` evaluates the severity of the interaction, assigning a score from 0-100.
5.  **AI Synthesis**: The `llm_explainer` takes the technical data and synthesizes a concise, professional consultation note.

### 3. The Interactive Dashboard
The **React-based frontend** provides a real-time reactive interface. Clinicians can sequence through patient profiles, upload new genome data, and receive immediate visual feedback via a high-fidelity dashboard.

---

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Axios, Vanilla CSS (Premium Design System).
- **Backend**: FastAPI (Python), Pydantic, Uvicorn.
- **Clinical Sources**: CPIC API, PharmGKB.
- **AI/ML**: Google Gemini (via `google-generativeai`).

---

## 🏁 Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm

### Installation & Launch

1.  **Backend Setup**:
    ```bash
    cd pharmaguard/backend
    pip install -r requirements.txt
    python -m uvicorn main:app --reload --port 8000
    ```

2.  **Frontend Setup**:
    ```bash
    cd pharmaguard/frontend
    npm install
    npm run dev
    ```

---

## 📈 Future Roadmap
- [ ] Integration with Electronic Health Records (EHR).
- [ ] Support for broader Whole Exome Sequencing (WES) data.
- [ ] Mobile-native app for bedside pharmacogenomics.

**GeneGuard: Precision Medicine. Personalized Safety.**
