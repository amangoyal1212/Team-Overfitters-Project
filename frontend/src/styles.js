// Shared styles and constants for GeneGuard UI — Clinical Sanctuary Design
export const API = import.meta.env.VITE_API_URL;

// ── Color Palette (Stitch Clinical Sanctuary) ──
const C = {
  primary: '#1A6B3C',
  primaryDark: '#005129',
  primaryLight: '#A5F4B8',
  primaryBg: 'rgba(26,107,60,0.06)',
  primaryBorder: 'rgba(26,107,60,0.15)',
  bg: '#F7F8F5',
  surface: '#ffffff',
  surfaceLow: '#F3F4F1',
  surfaceMid: '#EDEEEB',
  text: '#191C1B',
  textSecondary: '#404940',
  textMuted: '#707A70',
  border: '#BFC9BE',
  borderLight: '#E2E3E0',
  danger: '#ba1a1a',
  dangerBg: 'rgba(186,26,26,0.06)',
  dangerBorder: 'rgba(186,26,26,0.15)',
  warning: '#92400e',
  warningBg: 'rgba(146,64,14,0.06)',
  warningBorder: 'rgba(146,64,14,0.15)',
  blue: '#2563eb',
};

export const PATIENTS = [
  { id:"Ramesh Singh", risk:"NORMAL", allele:"Multi-Gene Panel", stripe:"green",
    payload:{ patient_id:"Ramesh Singh", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*1", CYP2C9:"*1/*1", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Harshini Mehta", risk:"MODERATE", allele:"Multi-Gene Panel", stripe:"amber",
    payload:{ patient_id:"Harshini Mehta", allele_calls:{ CYP2D6:"*1/*4", CYP2C19:"*1/*2", CYP2C9:"*1/*2", SLCO1B1:"*5", DPYD:"*1/*2A", TPMT:"*1/*2" }}},
  { id:"Aarushi Yadav", risk:"HIGH", allele:"Multi-Gene Panel", stripe:"red",
    payload:{ patient_id:"Aarushi Yadav", allele_calls:{ CYP2D6:"*4/*4", CYP2C19:"*2/*2", CYP2C9:"*3/*3", SLCO1B1:"*5/*5", DPYD:"*2A/*2A", TPMT:"*3/*3" }}},
  { id:"Rajesh Kumar", risk:"NORMAL", allele:"Multi-Gene Panel", stripe:"green",
    payload:{ patient_id:"Rajesh Kumar", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*1", CYP2C9:"*1/*1", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Priya Sharma", risk:"MODERATE", allele:"Multi-Gene Panel", stripe:"amber",
    payload:{ patient_id:"Priya Sharma", allele_calls:{ CYP2D6:"*1/*4", CYP2C19:"*1/*1", CYP2C9:"*1/*2", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Amit Patel", risk:"HIGH", allele:"Multi-Gene Panel", stripe:"red",
    payload:{ patient_id:"Amit Patel", allele_calls:{ CYP2D6:"*4/*4", CYP2C19:"*2/*2", CYP2C9:"*1/*1", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Sneha Desai", risk:"NORMAL", allele:"Multi-Gene Panel", stripe:"green",
    payload:{ patient_id:"Sneha Desai", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*1", CYP2C9:"*1/*1", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Vikram Malhotra", risk:"MODERATE", allele:"Multi-Gene Panel", stripe:"amber",
    payload:{ patient_id:"Vikram Malhotra", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*2", CYP2C9:"*1/*1", SLCO1B1:"*1/*5", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Anita Reddy", risk:"HIGH", allele:"Multi-Gene Panel", stripe:"red",
    payload:{ patient_id:"Anita Reddy", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*1", CYP2C9:"*3/*3", SLCO1B1:"*5/*5", DPYD:"*1/*1", TPMT:"*1/*1" }}},
  { id:"Sanjay Gupta", risk:"NORMAL", allele:"Multi-Gene Panel", stripe:"green",
    payload:{ patient_id:"Sanjay Gupta", allele_calls:{ CYP2D6:"*1/*1", CYP2C19:"*1/*1", CYP2C9:"*1/*1", SLCO1B1:"*1/*1", DPYD:"*1/*1", TPMT:"*1/*1" }}},
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
  width:'100%', height:'44px', border:'none', borderBottom:'2px solid transparent',
  borderRadius:'10px', padding:'0 16px', fontSize:'14px', outline:'none',
  background:'#EDEEEB', boxSizing:'border-box', color:'#191C1B',
  fontFamily:'Inter, system-ui, sans-serif', transition:'all 0.2s ease'
};

export const labelStyle = {
  display:'block', fontSize:'11px', fontWeight:'600', color:'#707A70',
  marginBottom:'6px', letterSpacing:'1px', textTransform:'uppercase'
};

export const sevColor = (s) =>
  s==='HIGH'?'#ba1a1a':s==='MODERATE'?'#92400e':s==='LOW'?'#2563eb':'#1A6B3C';

export const sevBg = (s) =>
  s==='HIGH'?'rgba(186,26,26,0.06)':s==='MODERATE'?'rgba(146,64,14,0.06)':'rgba(26,107,60,0.06)';

export const sevBorder = (s) =>
  s==='HIGH'?'1px solid rgba(186,26,26,0.15)':s==='MODERATE'?'1px solid rgba(146,64,14,0.15)':'1px solid rgba(26,107,60,0.15)';

export const stripeColor = (s) =>
  s==='green'?'#1A6B3C':s==='amber'?'#92400e':'#ba1a1a';
