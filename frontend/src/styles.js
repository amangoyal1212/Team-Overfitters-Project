// Shared styles and constants for GeneGuard UI
export const API = "http://localhost:8000";

export const PATIENTS = [
  { id:"PT-001", drug:"Sertraline", risk:"NORMAL", allele:"CYP2D6: *1/*1", stripe:"green",
    payload:{ patient_id:"PT-001", prescribed_drug:"sertraline", allele_calls:{ CYP2D6:"*1/*1" }}},
  { id:"PT-002", drug:"Sertraline", risk:"MODERATE", allele:"CYP2D6: *1/*4", stripe:"amber",
    payload:{ patient_id:"PT-002", prescribed_drug:"sertraline", allele_calls:{ CYP2D6:"*1/*4" }}},
  { id:"PT-003", drug:"Sertraline", risk:"HIGH", allele:"CYP2D6: *4/*4", stripe:"red",
    payload:{ patient_id:"PT-003", prescribed_drug:"sertraline", allele_calls:{ CYP2D6:"*4/*4" }}},
];

export const DRUGS = [
  { name:"Sertraline", gene:"CYP2D6", category:"Antidepressant" },
  { name:"Citalopram", gene:"CYP2C19", category:"Antidepressant" },
  { name:"Warfarin", gene:"CYP2C9", category:"Blood thinner" },
  { name:"Simvastatin", gene:"SLCO1B1", category:"Cholesterol" },
  { name:"Codeine", gene:"CYP2D6", category:"Pain reliever" },
  { name:"Clopidogrel", gene:"CYP2C19", category:"Antiplatelet" },
  { name:"Fluorouracil", gene:"DPYD", category:"Chemotherapy" },
  { name:"Azathioprine", gene:"TPMT", category:"Immunosuppressant" },
];

export const ALL_GENES = ["CYP2C19","CYP2C9","CYP2D6","DPYD","SLCO1B1","TPMT"];

export const DRUG_GENE_REASON = {
  "clopidogrel":"Clopidogrel requires CYP2C19 to convert to active form. Poor metabolizers get no therapeutic effect and face increased clotting risk.",
  "sertraline":"Sertraline is metabolized by CYP2D6. Poor metabolizers face drug accumulation and increased side effect risk.",
  "citalopram":"Citalopram depends on CYP2C19. Poor metabolizers have increased toxicity and QT prolongation risk.",
  "warfarin":"Warfarin dosing is critically affected by CYP2C9 variants. Poor metabolizers need significantly lower doses.",
  "simvastatin":"Simvastatin transport depends on SLCO1B1. Variants increase myopathy and rhabdomyolysis risk.",
  "codeine":"Codeine requires CYP2D6 to convert to morphine. Poor metabolizers get no pain relief; ultrarapid metabolizers face toxicity.",
  "fluorouracil":"Fluorouracil is broken down by DPYD. Poor metabolizers face severe life-threatening toxicity.",
  "azathioprine":"Azathioprine metabolism depends on TPMT. Poor metabolizers risk life-threatening bone marrow toxicity.",
};

export const inputStyle = {
  width:'100%', height:'40px', border:'1px solid #e2e8f0', borderRadius:'6px',
  padding:'0 12px', fontSize:'14px', outline:'none', background:'#f8fafc',
  boxSizing:'border-box', color:'#0f172a', fontFamily:'Inter, system-ui, sans-serif'
};

export const labelStyle = {
  display:'block', fontSize:'12px', fontWeight:'500', color:'#374151',
  marginBottom:'6px', letterSpacing:'0.3px'
};

export const sevColor = (s) =>
  s==='HIGH'?'#dc2626':s==='MODERATE'?'#d97706':s==='LOW'?'#2563eb':'#16a34a';

export const sevBg = (s) =>
  s==='HIGH'?'#fef2f2':s==='MODERATE'?'#fffbeb':'#f0fdf4';

export const sevBorder = (s) =>
  s==='HIGH'?'1px solid #fecaca':s==='MODERATE'?'1px solid #fde68a':'1px solid #bbf7d0';

export const stripeColor = (s) =>
  s==='green'?'#16a34a':s==='amber'?'#d97706':'#dc2626';
