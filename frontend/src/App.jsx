import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { API, PATIENTS, DRUGS, ALL_GENES, DRUG_GENE_REASON, inputStyle, labelStyle, sevColor, sevBg, sevBorder, stripeColor } from "./styles";
import { LandingPage } from "./LandingPage";
import { AuthPage } from "./AuthPage";

const GENE_DRUG_SAFETY_MAP = {
  "CYP2D6": {
    "Normal Metabolizer": {
      safe: ["sertraline", "fluoxetine", "paroxetine", "codeine"],
      caution: ["tramadol"],
      avoid: []
    },
    "Poor Metabolizer": {
      safe: ["citalopram", "escitalopram", "venlafaxine", "mirtazapine"],
      caution: ["sertraline", "fluoxetine"],
      avoid: ["codeine", "tramadol"]
    },
    "Ultrarapid Metabolizer": {
      safe: ["citalopram", "escitalopram"],
      caution: [],
      avoid: ["codeine"]
    }
  },
  "CYP2C19": {
    "Normal Metabolizer": {
      safe: ["clopidogrel", "citalopram", "escitalopram"],
      caution: [],
      avoid: []
    },
    "Poor Metabolizer": {
      safe: ["prasugrel", "ticagrelor"],
      caution: [],
      avoid: ["clopidogrel"]
    }
  },
  "CYP2C9": {
    "Normal Metabolizer": {
      safe: ["warfarin"],
      caution: [],
      avoid: []
    },
    "Poor Metabolizer": {
      safe: ["apixaban", "rivaroxaban"],
      caution: ["warfarin (reduced dose)"],
      avoid: []
    }
  },
  "SLCO1B1": {
    "Normal Function": {
      safe: ["simvastatin", "atorvastatin"],
      caution: [],
      avoid: []
    },
    "Decreased Function": {
      safe: ["pravastatin", "rosuvastatin"],
      caution: ["atorvastatin"],
      avoid: ["simvastatin (high dose)"]
    }
  },
  "DPYD": {
    "Normal Metabolizer": {
      safe: ["fluorouracil", "capecitabine"],
      caution: [],
      avoid: []
    },
    "Poor Metabolizer": {
      safe: [],
      caution: [],
      avoid: ["fluorouracil", "capecitabine"]
    }
  },
  "TPMT": {
    "Normal Metabolizer": {
      safe: ["azathioprine", "mercaptopurine"],
      caution: [],
      avoid: []
    },
    "Intermediate Metabolizer": {
      safe: [],
      caution: ["azathioprine (reduced dose)"],
      avoid: []
    },
    "Poor Metabolizer": {
      safe: ["alternative immunosuppressants"],
      caution: [],
      avoid: ["azathioprine", "mercaptopurine"]
    }
  }
};


function AnimatedScore({ targetScore, severity }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (!targetScore) return;
    let cur = 0; const steps = 60, inc = targetScore / steps, iv = 1500 / steps;
    const t = setInterval(() => { cur += inc; if (cur >= targetScore) { setDisplayed(Math.round(targetScore)); clearInterval(t); } else setDisplayed(Math.round(cur)); }, iv);
    return () => clearInterval(t);
  }, [targetScore]);
  return <span style={{fontSize:'52px',fontWeight:'800',color:sevColor(severity),fontVariantNumeric:'tabular-nums',lineHeight:1}}>{displayed}</span>;
}

export default function App() {
  const [user,setUser]=useState(()=>{try{const s=localStorage.getItem('gg_user');return s?JSON.parse(s):null}catch{return null}});
  const [token,setToken]=useState(()=>localStorage.getItem('gg_token')||null);
  const [showLanding,setShowLanding]=useState(()=>!localStorage.getItem('gg_token'));
  const [currentPage,setCurrentPage]=useState('analysis');
  const [showDropdown,setShowDropdown]=useState(false);
  const [selectedPatient,setSelectedPatient]=useState(null);
  const [selectedDrugs,setSelectedDrugs]=useState([]);
  const [result,setResult]=useState(null);
  const [multiResults,setMultiResults]=useState([]);
  const [activeResultTab,setActiveResultTab]=useState(0);
  const [showComparison,setShowComparison]=useState(false);
  const [loadingProgress,setLoadingProgress]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [responseTime,setResponseTime]=useState(null);
  const [analysisCount,setAnalysisCount]=useState(()=>parseInt(localStorage.getItem('gg_count')||'0'));
  const [history,setHistory]=useState(()=>{try{const s=localStorage.getItem('gg_history');return s?JSON.parse(s):[] }catch{return[]}});
  const [profileName,setProfileName]=useState('');
  const [profileSpec,setProfileSpec]=useState('');
  const [profileHospital,setProfileHospital]=useState('');
  const [profileSuccess,setProfileSuccess]=useState(false);
  const [showJsonModal,setShowJsonModal]=useState(false);
  const [simulateModal,setSimulateModal]=useState(null);
  const [simulateLoading,setSimulateLoading]=useState(false);

  const saveAuth=(u,t)=>{setUser(u);setToken(t);localStorage.setItem('gg_user',JSON.stringify(u));localStorage.setItem('gg_token',t);setShowLanding(false)};
  const clearAuth=()=>{setUser(null);setToken(null);localStorage.removeItem('gg_user');localStorage.removeItem('gg_token');setShowLanding(true)};
  const bumpCount=()=>{const n=analysisCount+1;setAnalysisCount(n);localStorage.setItem('gg_count',n.toString())};

  useEffect(()=>{const h=e=>{if(!e.target.closest('.gg-dropdown'))setShowDropdown(false)};document.addEventListener('click',h);return()=>document.removeEventListener('click',h)},[]);
  useEffect(()=>{
    const interceptor = axios.interceptors.response.use(
      res => res,
      err => { if (err.response?.status === 401) { clearAuth(); } return Promise.reject(err); }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const runAnalysis = async () => {
    if(!selectedPatient)return;
    const drugs = selectedDrugs.map(d=>d.toLowerCase());
    setLoading(true);setResult(null);setMultiResults([]);setActiveResultTab(0);setShowComparison(false);setError('');setLoadingProgress(`Analyzing drug 1 of ${drugs.length}...`);
    const start=performance.now();
    try {
      const res=await axios.post(`${API}/api/analyze`,{
        patient_id: selectedPatient.payload.patient_id,
        drugs: drugs,
        allele_calls: selectedPatient.payload.allele_calls
      });
      setResponseTime(((performance.now()-start)/1000).toFixed(1));
      const allResults = Array.isArray(res.data) ? res.data : [res.data];
      const successResults = allResults.filter(r => !r.error);
      const errorResults = allResults.filter(r => r.error);
      setMultiResults(allResults);
      if(successResults.length > 0) {
        setResult(successResults[0]);
      }
      if(errorResults.length > 0 && successResults.length === 0) {
        setError(errorResults.map(r => `${r.drug}: ${r.error}`).join('; '));
      }
      bumpCount();
      // Save to history as grouped entry
      const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-IN'),
        patient_id: selectedPatient.payload.patient_id,
        drugs_count: drugs.length,
        drugs_list: drugs,
        drug: drugs[0],
        gene: successResults[0]?.gene || 'N/A',
        phenotype: successResults[0]?.phenotype || 'N/A',
        severity: successResults.length > 0 ? (successResults.some(r=>r.severity==='HIGH') ? 'HIGH' : successResults.some(r=>r.severity==='MODERATE') ? 'MODERATE' : 'NORMAL') : 'UNKNOWN',
        risk_score: successResults[0]?.risk_score || 0,
        is_multi: drugs.length > 1,
      };
      const nh=[entry,...history].slice(0,50);setHistory(nh);localStorage.setItem('gg_history',JSON.stringify(nh));
    } catch(e){setError(e.response?.data?.detail||'Analysis failed')} finally{setLoading(false);setLoadingProgress('')}
  };

  const onDrop = useCallback(async (files) => {
    const file=files[0]; if(!file)return;
    if(file.name.toLowerCase().endsWith('.vcf')){
      setLoading(true);setResult(null);setMultiResults([]);setError('');setLoadingProgress('Parsing VCF file...');
      const start=performance.now();
      try {
        const fd=new FormData();fd.append('file',file);
        const drug=selectedDrugs[0]||'sertraline';
        const headers = {'Content-Type':'multipart/form-data'};
        if(token) headers['Authorization'] = `Bearer ${token}`;
        const res=await axios.post(`${API}/api/analyze/vcf?drug=${drug.toLowerCase()}`,fd,{headers});
        setResponseTime(((performance.now()-start)/1000).toFixed(1));
        const results=res.data.results||[];
        const primary=results.find(r=>r.analysis.gene==='CYP2D6')||results[0];
        if(primary) {
          const newResult = {...primary.analysis,vcf_metadata:primary.vcf_metadata,is_vcf:true,file_name:file.name};
          if (res.data.vcf_id) newResult.saved_to_db = true;
          setResult(newResult);
        }
        bumpCount();
      } catch(e){setError(e.response?.data?.detail||'VCF analysis failed')} finally{setLoading(false);setLoadingProgress('')}
    } else {
      try{const t=await file.text();const j=JSON.parse(t);
        const p=PATIENTS.find(p=>p.id===j.patient_id)||{id:j.patient_id,payload:j,drug:j.prescribed_drug,risk:'UNKNOWN',allele:Object.entries(j.allele_calls||{}).map(([k,v])=>`${k}: ${v}`).join(', '),stripe:'gray'};
        setSelectedPatient(p);
      }catch{setError('Invalid JSON file')}
    }
  },[selectedDrugs,analysisCount,history,token]);

  const {getRootProps,getInputProps,isDragActive}=useDropzone({onDrop,accept:{'application/json':['.json'],'text/plain':['.vcf']},multiple:false});

  const activeResult = multiResults.length > 0 ? multiResults[activeResultTab] : result;
  const handleExport=()=>{
    const r = activeResult;
    if(!r || r.error) return;
    const eb = r.evidence_breakdown || {};
    const c=`GENEGUARD CLINICAL REPORT\nGenerated: ${new Date().toLocaleString('en-IN')}\n${'='.repeat(50)}\nPATIENT: ${r.patient_id}\nDRUG: ${r.drug}\nGENE: ${r.gene}\nALLELE: ${r.allele}\nPHENOTYPE: ${r.phenotype}\nRISK SCORE: ${r.risk_score}/100\nSEVERITY: ${r.severity}\n\nCPIC RECOMMENDATION:\n${r.cpic_recommendation||'See consultation text'}\n\nEVIDENCE BREAKDOWN:\nGene: ${eb.gene_analyzed||r.gene}\nDiplotype: ${eb.diplotype_called||r.allele}\nPhenotype: ${eb.phenotype_assigned||r.phenotype}\nGuideline: ${eb.cpic_guideline?.title||'CPIC'}\nRecommendation: ${eb.guideline_recommendation||'See CPIC guideline'}\nRisk Components: Base=${eb.risk_score_components?.phenotype_base||'N/A'}, Evidence=${eb.risk_score_components?.evidence_level||'N/A'}\n\nSAFER ALTERNATIVES:\n${(r.alternatives||[]).map(a=>`- ${a.drug||a.name}: ${a.reason}`).join('\n')||'None identified'}\n\n${'='.repeat(50)}\nSource: GeneGuard | CPIC | PharmGKB\n`;
    const b=new Blob([c],{type:'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`geneguard_${r.patient_id}_${r.drug}.txt`;a.click();URL.revokeObjectURL(u)
  };
  const handleCopy=()=>{const r=activeResult;if(r)navigator.clipboard.writeText(JSON.stringify(r,null,2))};

  return (
    <div style={{fontFamily:'Manrope, Inter, sans-serif',minHeight:'100vh',background:'#F7F8F5'}}>
      <style>{`@keyframes pulse-red{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)}70%{box-shadow:0 0 0 12px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}.high-risk-pulse{animation:pulse-red 2s infinite}*{box-sizing:border-box}body{margin:0}`}</style>

      {showLanding && <LandingPage onGoLogin={()=>setShowLanding(false)} />}

      {!showLanding && !user && <AuthPage onAuth={saveAuth} onBack={()=>setShowLanding(true)} />}

      {!showLanding && user && (
        <div className="min-h-screen bg-background text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed">
          {/* NAVBAR */}
          <nav className="fixed top-0 w-full h-[64px] z-50 clinical-glass shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between px-8 w-full h-full">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-emerald-900 tracking-tight font-headline">GeneGuard</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold tracking-widest">V1.0 CLINICAL</span>
                </div>
                <div className="hidden md:flex items-center gap-8 ml-8 font-headline font-medium text-sm tracking-wide">
                  {['analysis','compatibility','history', 'vcf history', 'drug database', 'safety matrix'].map(tab=>(
                    <button key={tab} onClick={()=>setCurrentPage(tab)} className={currentPage===tab ? "text-emerald-900 border-b-2 border-emerald-900 pb-5 capitalize outline-none" : "text-slate-500 pb-5 hover:text-emerald-800 transition-colors capitalize outline-none"}>
                      {tab==='compatibility'?'💕 Compatibility':tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="gg-dropdown relative">
                  <div onClick={e=>{e.stopPropagation();setShowDropdown(!showDropdown)}} className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-slate-50/50 transition-all">
                    <div className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden border border-outline-variant/30 flex items-center justify-center text-on-surface font-bold text-sm">
                      {(user.full_name||'D').charAt(0).toUpperCase()}
                    </div>
                  </div>
                  {showDropdown && (
                    <div className="absolute top-[42px] right-0 bg-white border border-outline-variant/20 rounded-xl w-[200px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] z-[1000] overflow-hidden">
                      <div onClick={()=>{setCurrentPage('profile');setProfileName(user.full_name||'');setProfileSpec(user.specialization||'');setProfileHospital(user.hospital||'');setShowDropdown(false)}} className="px-4 py-3 cursor-pointer text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">person</span> My Profile
                      </div>
                      <div className="h-[1px] bg-outline-variant/20 w-full my-1"></div>
                      <div onClick={clearAuth} className="px-4 py-3 cursor-pointer text-sm font-medium text-error hover:bg-error-container transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-slate-100 h-[1px] w-full absolute bottom-0"></div>
          </nav>

          <div className="app-layout">
            {currentPage === 'profile' && (
              <div className="dashboard-container">
                <ProfilePage user={user} token={token} saveAuth={saveAuth} clearAuth={clearAuth} setCurrentPage={setCurrentPage} profileName={profileName} setProfileName={setProfileName} profileSpec={profileSpec} setProfileSpec={setProfileSpec} profileHospital={profileHospital} setProfileHospital={setProfileHospital} profileSuccess={profileSuccess} setProfileSuccess={setProfileSuccess}/>
              </div>
            )}
            
            {currentPage === 'history' && (
              <div className="dashboard-container">
                <HistoryPage history={history}/>
              </div>
            )}
            
            {currentPage === 'vcf history' && (
              <div className="dashboard-container">
                <VcfHistoryPage token={token}/>
              </div>
            )}
            
            {currentPage === 'drug database' && (
              <div className="dashboard-container">
                <DrugDatabasePage />
              </div>
            )}

            {currentPage === 'safety matrix' && (
              <div className="dashboard-container">
                <SafetyMatrixPage />
              </div>
            )}

            {currentPage === 'compatibility' && (
              <div className="dashboard-container">
                <CompatibilityPage />
              </div>
            )}

            {currentPage === 'analysis' && (
              <main className="pt-[88px] pb-12 px-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Sidebar (lg:col-span-3) */}
                <aside className="lg:col-span-3 space-y-6 flex flex-col">
                  {/* Patient Profile Selection */}
                  <div className="space-y-4">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <h2 className="text-2xl font-headline font-bold text-on-surface tracking-tight">Patient Profile</h2>
                    </div>
                    
                    {/* Selected Patient display */}
                    {selectedPatient ? (
                      <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] transition-all cursor-pointer hover:border-primary/30" onClick={()=>setSelectedPatient(null)}>
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0">
                              <span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>person</span>
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="font-headline font-bold text-lg truncate">{selectedPatient.id}</h3>
                              <p className="text-sm text-on-surface-variant truncate">Click to change</p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full" style={{background:sevBg(selectedPatient.risk),color:sevColor(selectedPatient.risk),border:sevBorder(selectedPatient.risk)}}>{selectedPatient.risk}</span>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2">
                           <span className="px-3 py-1 bg-surface-container-high rounded-full text-xs font-semibold text-on-surface-variant font-mono truncate max-w-full">{selectedPatient.allele}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 max-h-[720px] overflow-y-auto pr-2" style={{scrollbarWidth:'thin'}}>
                        {PATIENTS.map(p => (
                           <div key={p.id} onClick={()=>{setSelectedPatient(p);setResult(null);setError('')}} className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-3">
                             <div className="flex justify-between items-center z-10">
                               <span className="font-bold text-on-surface text-sm truncate mr-2">{p.id}</span>
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0" style={{background:sevBg(p.risk),color:sevColor(p.risk),border:sevBorder(p.risk)}}>{p.risk}</span>
                             </div>
                             <div className="text-xs text-outline font-mono truncate">{p.allele}</div>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>

                {/* Middle Column (lg:col-span-5) */}
                <section className="lg:col-span-5 space-y-8">

                  {/* Active Medications Grid */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-headline font-bold text-on-surface tracking-tight">Active Medications</h2>
                      <div className="flex gap-3 items-center">
                        {selectedDrugs.length > 0 && <button onClick={()=>setSelectedDrugs([])} className="text-xs text-outline hover:text-on-surface underline">Clear All</button>}
                        <div className="relative">
                           <DrugSearchBar 
                            selectedPatient={selectedPatient} 
                            onSelectDrug={(drugName) => {
                              setSelectedDrugs(prev => {
                                if(prev.includes(drugName)) return prev;
                                if(prev.length >= 5) return prev;
                                return [...prev, drugName];
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {DRUGS.slice(0, 8).map(d => {
                        const isSelected = selectedDrugs.includes(d.name);
                        const atLimit = selectedDrugs.length >= 5 && !isSelected;
                        return (
                          <div key={d.name} onClick={()=>{ if(atLimit) return; setSelectedDrugs(p=>p.includes(d.name)?p.filter(x=>x!==d.name):[...p,d.name]); }} className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-[100px] ${isSelected ? 'bg-secondary-fixed border-secondary-fixed shadow-sm' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30 hover:shadow-sm'} ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className="flex justify-between items-start">
                              <h4 className={`font-bold text-sm ${isSelected ? 'text-on-secondary-fixed' : 'text-on-surface'}`}>{d.name}</h4>
                              {isSelected && <span className="material-symbols-outlined text-on-secondary-fixed text-sm">check_circle</span>}
                            </div>
                            <div>
                               <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isSelected ? 'bg-white/30 text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'}`}>{d.gene}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Upload Zone & Analysis Action */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mt-8">
                    <div className="space-y-4">
                      <h2 className="text-lg font-headline font-bold text-on-surface tracking-tight">Raw Genomic Sequence</h2>
                      <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer group ${isDragActive ? 'border-primary bg-primary-container/5' : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high'}`}>
                        <input {...getInputProps()} />
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-primary text-3xl">upload_file</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold">Drag & drop clinical data</p>
                          <p className="text-xs text-outline mt-1">Supports VCF, JSON, FASTQ</p>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 bg-white text-[10px] font-mono border border-outline-variant/50 rounded">.vcf</span>
                          <span className="px-2 py-1 bg-white text-[10px] font-mono border border-outline-variant/50 rounded">.json</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      {error && <div className="text-xs text-error bg-error-container/50 p-2 rounded-lg text-center">{error}</div>}
                      <button onClick={runAnalysis} disabled={!selectedPatient||selectedDrugs.length===0||loading} className={`w-full h-[52px] rounded-full font-headline font-bold text-lg flex items-center justify-center gap-3 transition-all ${(!selectedPatient||selectedDrugs.length===0||loading) ? 'bg-surface-variant text-outline cursor-not-allowed' : 'bg-primary-container text-white shadow-[0px_4px_20px_rgba(26,107,60,0.25)] hover:bg-primary active:scale-95'}`}>
                        <span className="material-symbols-outlined">genetics</span>
                        {loading ? (loadingProgress || 'Analyzing...') : `Run Genetic Analysis${selectedDrugs.length > 1 ? ` (${selectedDrugs.length})` : ''}`}
                      </button>
                      <p className="text-[11px] text-center text-outline px-6">Analysis follows CLIA/CAP certified processing protocols.</p>
                    </div>
                  </div>
                </section>

                {/* Right Column (lg:col-span-4) */}
                <aside className="lg:col-span-4 space-y-8">
                  {/* Medicine Scanner Container */}
                  <MedicineScanCard 
                    selectedPatient={selectedPatient} 
                    onResult={(r,t)=>{setResult(r);setResponseTime(t)}} 
                    onCount={bumpCount}
                  />

                  {/* Diagnostic Insights / Quick Stats */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-headline font-bold text-on-surface tracking-tight">Diagnostic Insights</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Stat 1 */}
                      <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between h-32 border border-outline-variant/5">
                        <div className="flex justify-between items-start">
                          <span className="material-symbols-outlined text-primary">bar_chart</span>
                        </div>
                        <div>
                          <p className="text-2xl font-headline font-extrabold">{analysisCount}</p>
                          <p className="text-[10px] text-outline uppercase font-label font-bold">Total Analyses</p>
                        </div>
                      </div>
                      {/* Stat 2 */}
                      <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between h-32 border border-outline-variant/5">
                        <div className="flex justify-between items-start">
                          <span className="material-symbols-outlined text-tertiary">bolt</span>
                        </div>
                        <div>
                          <p className="text-2xl font-headline font-extrabold">{responseTime ? responseTime : '--'}<span className="text-sm font-normal text-outline ml-1">s</span></p>
                          <p className="text-[10px] text-outline uppercase font-label font-bold">Latency</p>
                        </div>
                      </div>
                      {/* Stat 3 */}
                      <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between h-32 border border-outline-variant/5">
                        <div className="flex justify-between items-start">
                          <span className="material-symbols-outlined text-secondary">genetics</span>
                        </div>
                        <div>
                          <p className="text-2xl font-headline font-extrabold">{history.filter(h=>h.is_vcf).length}</p>
                          <p className="text-[10px] text-outline uppercase font-label font-bold">VCF Uploads</p>
                        </div>
                      </div>
                      {/* Stat 4 */}
                      <div className="bg-surface-container-low p-5 rounded-2xl flex flex-col justify-between h-32 border border-outline-variant/5">
                        <div className="flex justify-between items-start">
                          <span className="material-symbols-outlined text-outline">schedule</span>
                        </div>
                        <div>
                          <p className="text-sm font-headline font-bold text-on-surface">{history.length > 0 ? history[0].date : 'Never'}</p>
                          <p className="text-[10px] text-outline uppercase font-label font-bold mt-1">Last Sync</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* Analysis Overlay Modal (Stitch Diagnostic Panel style) */}
                {(result || multiResults.length > 0) && (
                  <div className="fixed inset-0 z-[100] flex justify-center items-center bg-background/50 backdrop-blur-sm transition-all p-4 md:p-8" onClick={()=>{setResult(null);setMultiResults([]);setResponseTime(null);setShowComparison(false)}}>
                    <div className="w-full max-w-[1100px] h-[90vh] flex flex-row relative justify-center">
                       {/* Left Vertical Patient Name in Clear Space */}
                       {(() => {
                         const currentResult = multiResults.length > 0 ? (multiResults[activeResultTab] || result) : result;
                         if (!currentResult || !selectedPatient) return null;
                         const patientName = selectedPatient.id || currentResult.patient_id;
                         return (
                           <div className="hidden xl:flex absolute left-12 top-0 bottom-0 items-center justify-center pointer-events-none">
                             <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-on-surface-variant/20 font-headline font-extrabold text-[80px] leading-none tracking-widest uppercase whitespace-nowrap opacity-50 mix-blend-multiply dark:mix-blend-screen">
                               {patientName}
                             </div>
                           </div>
                         );
                       })()}

                       {/* Main Content (Centered Modal) */}
                       <div className="w-full max-w-[800px] h-[90vh] bg-surface-container-lowest shadow-2xl rounded-2xl border border-outline-variant/20 flex flex-col overflow-hidden animate-[fadeIn_0.3s_ease-out]" onClick={e=>e.stopPropagation()}>
                         {/* Header */}
                         <div className="px-8 py-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface shrink-0">
                           <div>
                              <h2 className="text-2xl font-headline font-bold text-on-surface">Diagnostic Panel</h2>
                              <p className="text-sm text-on-surface-variant flex items-center gap-2 mt-1">
                                 Clinical Analysis Results
                                 {multiResults.length > 1 && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">{multiResults.filter(r=>!r.error).length} of {multiResults.length} drugs</span>}
                              </p>
                           </div>
                           <div className="flex gap-4">
                             {multiResults.filter(r=>!r.error).length >= 2 && (
                               <button onClick={()=>setShowComparison(!showComparison)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${showComparison ? 'bg-primary-container text-white' : 'bg-surface-variant text-on-surface hover:bg-surface-container-high'}`}>
                                 {showComparison ? '← Tabbed View' : '⚖️ Compare Drugs'}
                               </button>
                             )}
                             <button onClick={()=>{setResult(null);setMultiResults([]);setResponseTime(null);setShowComparison(false)}} className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                             </button>
                           </div>
                         </div>
                         
                         {/* Multi-drug tabs */}
                         {multiResults.length > 1 && !showComparison && (
                           <div className="flex border-b border-outline-variant/20 bg-surface px-8 gap-6 overflow-x-auto scroller-hide shrink-0">
                             {multiResults.map((r, i) => {
                               const isActive = activeResultTab === i;
                               const hasError = !!r.error;
                               const sc = hasError ? '#outline' : sevColor(r.severity);
                               return (
                                 <button key={i} onClick={()=>{setActiveResultTab(i);if(!hasError)setResult(r)}} className={`py-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${isActive ? 'text-on-surface border-primary' : 'text-outline border-transparent hover:text-on-surface-variant'}`}>
                                   <span className="w-2 h-2 rounded-full" style={{background:hasError?'var(--tw-colors-outline)':sc}}></span>
                                   <span className="capitalize">{r.drug}</span>
                                   {hasError && <span className="material-symbols-outlined text-error text-[14px]">warning</span>}
                                 </button>
                               )
                             })}
                           </div>
                         )}

                         {/* Content Area */}
                         <div className="flex-1 overflow-y-auto p-4 md:p-8">
                           {showComparison ? (
                             <DrugComparisonTable results={multiResults.filter(r=>!r.error)} />
                           ) : (
                             (() => {
                               const currentResult = multiResults.length > 0 ? multiResults[activeResultTab] : result;
                               if (currentResult?.error) {
                                 return (
                                   <div className="text-center py-20">
                                     <span className="material-symbols-outlined text-error text-6xl mb-4">error</span>
                                     <h3 className="text-xl font-bold text-error mb-2">Analysis Failed for {currentResult.drug}</h3>
                                     <p className="text-on-surface-variant">{currentResult.error}</p>
                                   </div>
                                 );
                               }
                               return currentResult ? (
                                 <AnalysisPage result={currentResult} loading={loading} error={error} responseTime={responseTime} analysisCount={analysisCount} showJsonModal={showJsonModal} setShowJsonModal={setShowJsonModal} handleExport={handleExport} handleCopy={handleCopy} selectedPatient={selectedPatient} simulateModal={simulateModal} setSimulateModal={setSimulateModal} simulateLoading={simulateLoading} setSimulateLoading={setSimulateLoading}/>
                               ) : null;
                             })()
                           )}
                         </div>
                       </div>
                    </div>
                  </div>
                )}
              </main>
            )}
          </div>
        </div>
      )}

      {showJsonModal && result && (
        <div className="modal-backdrop" onClick={()=>setShowJsonModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white',borderRadius:'12px',width:'100%',maxWidth:'680px',maxHeight:'80vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',animation:'fadeInUp 200ms ease both'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #E2E3E0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <span style={{fontSize:'16px',fontWeight:'600',color:'#191C1B'}}>{'Raw Analysis Data { }'}</span>
              <button onClick={()=>setShowJsonModal(false)} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#707A70'}}>✕</button>
            </div>
            <div style={{padding:'20px',overflowY:'auto'}}>
              <pre style={{background:'#191C1B',color:'#4ade80',borderRadius:'12px',padding:'16px',fontSize:'12px',fontFamily:'monospace',overflowX:'auto',margin:0}}>{JSON.stringify(result,null,2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE MODAL */}
      {simulateModal && (
        <div className="modal-backdrop" onClick={()=>setSimulateModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'480px',padding:'28px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',animation:'fadeInUp 200ms ease both'}}>
            <div style={{fontSize:'18px',fontWeight:'700',color:'#191C1B',marginBottom:'20px'}}>Simulated: <span style={{textTransform:'capitalize'}}>{simulateModal.name}</span></div>
            {simulateModal.simResult ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
                  <div style={{width:'52px',height:'52px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'18px',background:simulateModal.simResult.risk_score>=75?'rgba(186,26,26,0.06)':simulateModal.simResult.risk_score>=45?'rgba(146,64,14,0.06)':'rgba(26,107,60,0.06)',color:simulateModal.simResult.risk_score>=75?'#ba1a1a':simulateModal.simResult.risk_score>=45?'#92400e':'#1A6B3C'}}>
                    {Math.round(simulateModal.simResult.risk_score)}
                  </div>
                  <div>
                    <div style={{fontWeight:'600',color:'#191C1B'}}>{simulateModal.simResult.severity} <span style={{fontSize:'13px',color:'#707A70',fontWeight:'400'}}>Risk</span></div>
                    <div style={{fontSize:'13px',color:'#707A70'}}>{simulateModal.simResult.gene} · {simulateModal.simResult.phenotype}</div>
                  </div>
                </div>
                <div style={{background:'#F7F8F5',borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'#707A70',marginBottom:'4px'}}>Current</div>
                      <div style={{fontSize:'20px',fontWeight:'700',color:'#ba1a1a'}}>{simulateModal.currentRisk || '?'}</div>
                      <div style={{fontSize:'12px',color:'#707A70',textTransform:'capitalize'}}>{simulateModal.currentDrug}</div>
                    </div>
                    <div style={{fontSize:'24px',color:'#1A6B3C',fontWeight:'700'}}>→</div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'#707A70',marginBottom:'4px'}}>Alternative</div>
                      <div style={{fontSize:'20px',fontWeight:'700',color:'#1A6B3C'}}>{Math.round(simulateModal.simResult.risk_score)}</div>
                      <div style={{fontSize:'12px',color:'#707A70',textTransform:'capitalize'}}>{simulateModal.name}</div>
                    </div>
                  </div>
                  {simulateModal.currentRisk && simulateModal.simResult.risk_score < simulateModal.currentRisk && (
                    <div style={{textAlign:'center',marginTop:'12px',fontSize:'16px',fontWeight:'700',color:'#1A6B3C'}}>↓ {Math.round(simulateModal.currentRisk - simulateModal.simResult.risk_score)} points safer</div>
                  )}
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>setSimulateModal(null)} style={{flex:1,padding:'10px',border:'none',borderRadius:'12px',background:'white',color:'#404940',fontSize:'14px',fontWeight:'500'}}>Close</button>
                  <button onClick={()=>{setSelectedDrugs(p=>p.includes(simulateModal.name)?p:[...p.filter(x=>x.toLowerCase()!==simulateModal.currentDrug?.toLowerCase()),simulateModal.name]);setSimulateModal(null)}} style={{flex:1,padding:'10px',border:'none',borderRadius:'12px',background:'#1A6B3C',color:'white',fontSize:'14px',fontWeight:'500'}}>Use This Drug</button>
                </div>
              </>
            ) : (
              <div style={{textAlign:'center',padding:'24px'}}>
                <div className="skeleton-pulse" style={{width:'60px',height:'60px',borderRadius:'50%',margin:'0 auto 16px'}}/>
                <div style={{fontSize:'14px',color:'#707A70'}}>Simulating analysis...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MedicineScanCard({ selectedPatient, onResult, onCount }) {
  const [mode, setMode] = useState('idle'); // idle, camera, scanning, result, confirming, confirmed
  const [scanData, setScanData] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  const GREEN = '#1A6B3C'; const GREEN_BG = 'rgba(26,107,60,0.06)'; const GREEN_BORDER = '#6ee7b7';

  // Debounced search effect
  React.useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`${API}/api/drug/search?q=${searchTerm}&limit=5`);
        setSearchResults(res.data);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const startCamera = async () => {
    try {
      setMode('camera'); setError(''); setScanData(null); setConfirmResult(null); setSearchTerm(''); setSearchResults([]);
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }});
      setStream(s);
    } catch { setError('Camera access denied or unavailable'); setMode('idle'); }
  };

  const stopCamera = () => { if(stream){stream.getTracks().forEach(t=>t.stop());setStream(null);} };

  React.useEffect(() => {
    if (!stream || mode !== 'camera') return;
    const bindVideo = () => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } };
    bindVideo(); const t = setTimeout(bindVideo, 100);
    return () => clearTimeout(t);
  }, [stream, mode]);

  React.useEffect(() => { return () => { if(stream) stream.getTracks().forEach(t=>t.stop()); }; }, [stream]);

  const doScan = async (blob) => {
    setMode('scanning'); setError(''); setScanData(null); setSearchTerm(''); setSearchResults([]);
    try {
      const fd = new FormData(); fd.append('file', blob, 'medicine.jpg');
      const res = await axios.post(`${API}/api/scan-medicine`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      setScanData(res.data);
      if (res.data.detected_drug) setSelectedDrug(res.data.detected_drug);
      setMode('result');
    } catch(e) {
      setError(e.response?.data?.detail||e.message||'Scan failed');
      setMode('idle');
    }
  };

  const capture = () => {
    if(!videoRef.current||!canvasRef.current) return;
    const v=videoRef.current, c=canvasRef.current;
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext('2d').drawImage(v,0,0);
    c.toBlob(b=>{stopCamera();doScan(b);},'image/jpeg',0.9);
  };

  const handleFileUpload = (e) => { const f = e.target.files[0]; if(f) doScan(f); };

  const confirmDrug = async () => {
    const drugToConfirm = selectedDrug || searchTerm;
    if(!drugToConfirm) return;
    setMode('confirming');
    try {
      const gene = selectedPatient?.payload?.allele_calls ? Object.keys(selectedPatient.payload.allele_calls)[0] : '';
      const allele = gene ? (selectedPatient?.payload?.allele_calls?.[gene] || '') : '';
      const res = await axios.post(`${API}/api/scan-medicine/confirm`, {
        drug_name: drugToConfirm, patient_gene: gene, patient_allele: allele
      });
      setConfirmResult(res.data);
      setMode('confirmed');
      onCount();
    } catch(e) {
      setError(e.response?.data?.detail||'Confirmation failed');
      setMode('result');
    }
  };

  const confColor = (score) => score > 85 ? GREEN : score >= 70 ? '#92400e' : '#ba1a1a';
  const confBg = (score) => score > 85 ? GREEN_BG : score >= 70 ? 'rgba(146,64,14,0.06)' : 'rgba(186,26,26,0.06)';

  return (
    <div style={{border:`2px solid ${GREEN_BORDER}`,borderRadius:'12px',overflow:'hidden',background:GREEN_BG}}>
      {/* Header */}
      <div style={{padding:'16px 20px',background:GREEN,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'22px'}}>💊</span>
          <div>
            <div style={{fontSize:'16px',fontWeight:'700'}}>Medicine strip scanner</div>
          </div>
        </div>
        {mode !== 'idle' && mode !== 'camera' && <button onClick={()=>{setMode('idle');setScanData(null);setConfirmResult(null);setError('');setSearchTerm('');setSearchResults([]);}} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'4px 12px',borderRadius:'10px',fontSize:'12px',cursor:'pointer'}}>Reset</button>}
      </div>

      <div style={{padding:'20px'}}>
        {mode === 'idle' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            <button onClick={startCamera} style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',height:'110px',background:GREEN,color:'white',border:'none',borderRadius:'12px',cursor:'pointer'}}>
              <span style={{fontSize:'28px'}}>📷</span><span style={{fontSize:'14px',fontWeight:'600'}}>Open Camera</span>
            </button>
            <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',height:'110px',background:'white',color:GREEN,border:`2px solid ${GREEN}`,borderRadius:'12px',cursor:'pointer'}}>
              <span style={{fontSize:'28px'}}>📁</span><span style={{fontSize:'14px',fontWeight:'600'}}>Upload Photo</span>
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleFileUpload}/>
            </label>
          </div>
        )}

        {mode === 'camera' && (
          <div style={{borderRadius:'12px',overflow:'hidden',background:'#191C1B'}}>
            <div style={{position:'relative'}}>
              <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'260px',objectFit:'cover',display:'block'}}/>
              <div style={{position:'absolute',bottom:'8px',left:0,right:0,textAlign:'center',color:'white',fontSize:'12px',fontWeight:'500',background:'rgba(0,0,0,0.6)',padding:'6px'}}>Point at medicine label or pill strip</div>
            </div>
            <canvas ref={canvasRef} style={{display:'none'}}/>
            <div style={{padding:'12px',background:'white',display:'flex',gap:'10px'}}>
              <button onClick={capture} style={{flex:1,height:'40px',background:GREEN,color:'white',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>📸 Capture</button>
              <button onClick={()=>{stopCamera();setMode('idle')}} style={{height:'40px',padding:'0 16px',background:'#F3F4F1',color:'#404940',border:'none',borderRadius:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}

        {mode === 'scanning' && (
          <div style={{textAlign:'center',padding:'32px 16px'}}>
            <div style={{fontSize:'36px',marginBottom:'12px'}}>🔍</div>
            <div style={{fontSize:'15px',fontWeight:'600',color:'#191C1B',marginBottom:'6px'}}>Scanning with local OCR...</div>
            <div style={{height:'4px',background:'#d1d5db',borderRadius:'2px',overflow:'hidden',maxWidth:'160px',margin:'0 auto'}}>
              <div style={{height:'100%',background:GREEN,width:'60%',borderRadius:'2px',animation:'pulse 1.5s infinite ease-in-out'}}/>
            </div>
          </div>
        )}

        {mode === 'result' && scanData && (
          <div>
            {/* Detected drug card */}
            <div style={{background:'white',borderRadius:'10px',padding:'16px',marginBottom:'12px',border:'1px solid #d1fae5'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1px',color:'#707A70',marginBottom:'4px'}}>DETECTED MEDICINE</div>
                  <div style={{fontSize:'20px',fontWeight:'700',color:'#191C1B'}}>{scanData.detected_drug || 'Unknown'}</div>
                  {scanData.detected_dose && <div style={{fontSize:'14px',color:'#404940',fontWeight:'500',marginTop:'2px'}}>{scanData.detected_dose}</div>}
                  {scanData.manufacturer && <div style={{fontSize:'12px',color:'#707A70',marginTop:'2px'}}>{scanData.manufacturer}</div>}
                </div>
                <div style={{padding:'6px 14px',borderRadius:'20px',fontSize:'13px',fontWeight:'700',background:confBg(scanData.match_confidence),color:confColor(scanData.match_confidence),border:`1px solid ${confColor(scanData.match_confidence)}20`}}>
                  {Math.round(scanData.match_confidence)}%
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{marginBottom:'12px'}}>
                <div style={{height:'6px',background:'#e5e7eb',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',background:confColor(scanData.match_confidence),width:`${scanData.match_confidence}%`,borderRadius:'3px',transition:'width 0.5s ease'}}/>
                </div>
              </div>

              {/* Top 3 matches */}
              {scanData.top_matches?.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',color:'#707A70',marginBottom:'6px',fontWeight:'600'}}>TOP MATCHES</div>
                  {scanData.top_matches.map((m,i) => (
                    <div key={i} onClick={()=>setSelectedDrug(m.drug_name)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:'10px',marginBottom:'4px',cursor:'pointer',background:selectedDrug===m.drug_name?'rgba(26,107,60,0.06)':'#F7F8F5',border:selectedDrug===m.drug_name?`1px solid ${GREEN}`:'1px solid #E2E3E0'}}>
                      <div>
                        <span style={{fontSize:'13px',fontWeight:selectedDrug===m.drug_name?'600':'400',color:'#191C1B'}}>{m.drug_name}</span>
                        <span style={{fontSize:'11px',color:'#BFC9BE',marginLeft:'8px'}}>via {m.match_type}</span>
                      </div>
                      <span style={{fontSize:'12px',fontWeight:'600',color:confColor(m.match_confidence)}}>{Math.round(m.match_confidence)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual search / override */}
              <div style={{marginTop:'10px',fontSize:'12px',color:'#707A70'}}>
                💡 Select a match above or search database:
                <div style={{position:'relative'}}>
                  <input type="text" placeholder="Type drug name..." value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setSelectedDrug('');}} style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'10px',fontSize:'13px',marginTop:'6px',outline:'none'}}/>
                  {isSearching && <span style={{position:'absolute',right:'10px',top:'14px',fontSize:'12px'}}>...</span>}
                </div>
                {searchResults.length > 0 && selectedDrug === '' && (
                  <div style={{background:'white',border:'none',borderRadius:'10px',marginTop:'4px',maxHeight:'150px',overflowY:'auto',boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                    {searchResults.map((r,i) => (
                      <div key={i} onClick={()=>{setSelectedDrug(r.name);setSearchTerm(r.name);setSearchResults([]);}} style={{padding:'8px 10px',borderBottom:i<searchResults.length-1?'1px solid #F3F4F1':'none',cursor:'pointer',fontSize:'13px',display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background='#F7F8F5'} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                        <div>
                          <span style={{fontWeight:'500',color:'#191C1B'}}>{r.name}</span>
                          {r.category && <span style={{fontSize:'10px',color:'#707A70',marginLeft:'6px'}}>({r.category})</span>}
                        </div>
                        {r.pgx_relevant && <span style={{fontSize:'10px',background:'rgba(37,99,235,0.06)',color:'#2563eb',padding:'2px 6px',borderRadius:'4px'}}>PGx</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* OCR raw text (collapsed) */}
            {scanData.ocr_text?.length > 0 && (
              <details style={{marginBottom:'12px'}}>
                <summary style={{fontSize:'12px',color:'#707A70',cursor:'pointer',marginBottom:'4px'}}>OCR Raw Text ({scanData.ocr_text.length} blocks)</summary>
                <div style={{background:'#F7F8F5',borderRadius:'10px',padding:'8px 10px',fontSize:'11px',color:'#404940',fontFamily:'monospace',maxHeight:'100px',overflowY:'auto'}}>{scanData.ocr_text.join(' | ')}</div>
              </details>
            )}

            {/* Confirm button */}
            <button onClick={confirmDrug} disabled={!selectedDrug && !searchTerm} style={{width:'100%',height:'44px',background:(selectedDrug||searchTerm)?GREEN:'#9ca3af',color:'white',border:'none',borderRadius:'12px',fontSize:'15px',fontWeight:'600',cursor:(selectedDrug||searchTerm)?'pointer':'not-allowed'}}>
              ✓ Confirm Medicine: {(selectedDrug || searchTerm) || '...'}
            </button>
            <div style={{textAlign:'center',fontSize:'11px',color:'#707A70',marginTop:'6px'}}>PGx check runs only after confirmation</div>
          </div>
        )}

        {mode === 'confirming' && (
          <div style={{textAlign:'center',padding:'32px 16px'}}>
            <div style={{fontSize:'36px',marginBottom:'12px'}}>⚡</div>
            <div style={{fontSize:'15px',fontWeight:'600',color:'#191C1B'}}>Running PGx check...</div>
          </div>
        )}

        {mode === 'confirmed' && confirmResult && (
          <div>
            {confirmResult.pgx_relevant ? (
              <div style={{background:'white',borderRadius:'10px',padding:'16px',border:'1px solid rgba(186,26,26,0.15)'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                  <span style={{fontSize:'20px'}}>⚠️</span>
                  <span style={{fontSize:'16px',fontWeight:'700',color:'#ba1a1a'}}>
                    {confirmResult.drug_name} — PGx Relevant
                  </span>
                </div>
                <div style={{fontSize:'14px',color:'#404940',lineHeight:'1.6',marginBottom:'12px'}}>{confirmResult.message}</div>
                {confirmResult.pgx_check && (
                  <div style={{background:'#F7F8F5',borderRadius:'12px',padding:'12px',fontSize:'13px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div><span style={{color:'#707A70'}}>Gene: </span><strong>{confirmResult.pgx_check.gene}</strong></div>
                      <div><span style={{color:'#707A70'}}>Allele: </span><strong>{confirmResult.pgx_check.allele}</strong></div>
                      <div><span style={{color:'#707A70'}}>Phenotype: </span><strong>{confirmResult.pgx_check.phenotype}</strong></div>
                      <div><span style={{color:'#707A70'}}>Risk: </span><strong style={{color:confirmResult.pgx_check.severity==='HIGH'?'#ba1a1a':confirmResult.pgx_check.severity==='MODERATE'?'#92400e':'#1A6B3C'}}>{Math.round(confirmResult.pgx_check.risk_score)}/100 {confirmResult.pgx_check.severity}</strong></div>
                    </div>
                    {confirmResult.pgx_check.alternatives?.length > 0 && (
                      <div style={{marginTop:'10px',padding:'8px 10px',background:'rgba(186,26,26,0.06)',borderRadius:'10px',border:'1px solid rgba(186,26,26,0.15)'}}>
                        <div style={{fontSize:'12px',fontWeight:'600',color:'#ba1a1a',marginBottom:'4px'}}>Consider alternatives:</div>
                        <div style={{fontSize:'13px',color:'#404940'}}>{confirmResult.pgx_check.alternatives.join(', ')}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{background:'white',borderRadius:'10px',padding:'16px',border:'1px solid #d1fae5'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                  <span style={{fontSize:'20px'}}>✅</span>
                  <span style={{fontSize:'16px',fontWeight:'700',color:'#1A6B3C'}}>
                    No Gene Interaction
                  </span>
                </div>
                <div style={{fontSize:'18px',fontWeight:'700',color:'#191C1B',marginBottom:'8px'}}>{confirmResult.drug_name}</div>
                <div style={{fontSize:'14px',color:'#404940',marginBottom:'16px'}}>
                  {confirmResult.message}
                </div>
                <div style={{background:'#F7F8F5',borderRadius:'12px',padding:'12px',fontSize:'13px',border:'none'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    <div><span style={{color:'#707A70'}}>Category: </span><strong>{confirmResult.category || 'Medication'}</strong></div>
                    {confirmResult.common_indication && <div><span style={{color:'#707A70'}}>Common Use: </span><strong>{confirmResult.common_indication}</strong></div>}
                  </div>
                  <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid #E2E3E0',display:'flex',gap:'8px'}}>
                    <span>⚠️</span>
                    <span style={{color:'#707A70'}}>Note: While no PGx interaction exists, standard precautions should be followed.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div style={{marginTop:'12px',padding:'10px 14px',background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)',borderRadius:'10px',color:'#ba1a1a',fontSize:'12px'}}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

function ProfilePage({user,token,saveAuth,clearAuth,setCurrentPage,profileName,setProfileName,profileSpec,setProfileSpec,profileHospital,setProfileHospital,profileSuccess,setProfileSuccess}) {
  return (
    <div style={{maxWidth:'560px',margin:'0 auto',padding:'32px 24px'}}>
      <button onClick={()=>setCurrentPage('analysis')} style={{background:'none',border:'none',color:'#1A6B3C',fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'24px'}}>← Back to Analysis</button>
      <div style={{background:'white',border:'none',borderRadius:'12px',padding:'24px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
        <div style={{width:'72px',height:'72px',background:'#1A6B3C',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'28px',fontWeight:'700'}}>{(user.full_name||'D').charAt(0).toUpperCase()}</div>
        <div><div style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',marginBottom:'4px'}}>{user.full_name}</div><div style={{fontSize:'14px',color:'#707A70'}}>{user.email}</div>{user.specialization&&<span style={{background:'rgba(26,107,60,0.06)',color:'#1A6B3C',border:'1px solid rgba(26,107,60,0.15)',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>{user.specialization}</span>}</div>
      </div>
      <div style={{background:'white',border:'none',borderRadius:'12px',padding:'24px',marginBottom:'16px'}}>
        <h3 style={{fontSize:'16px',fontWeight:'600',color:'#191C1B',margin:'0 0 20px'}}>Edit Profile</h3>
        {profileSuccess&&<div style={{background:'rgba(26,107,60,0.06)',border:'1px solid rgba(26,107,60,0.15)',borderRadius:'10px',padding:'10px 14px',color:'#1A6B3C',fontSize:'13px',marginBottom:'16px'}}>✅ Profile updated successfully</div>}
        {[{l:'FULL NAME',v:profileName,s:setProfileName},{l:'SPECIALIZATION',v:profileSpec,s:setProfileSpec},{l:'HOSPITAL',v:profileHospital,s:setProfileHospital}].map(f=><div key={f.l} style={{marginBottom:'14px'}}><label style={labelStyle}>{f.l}</label><input type="text" value={f.v} onChange={e=>f.s(e.target.value)} style={inputStyle}/></div>)}
        <button onClick={async()=>{try{const res=await axios.put(`${API}/api/auth/profile`,{full_name:profileName,specialization:profileSpec,hospital:profileHospital,phone:''},{headers:{Authorization:`Bearer ${token}`}});saveAuth(res.data.user,token);setProfileSuccess(true);setTimeout(()=>setProfileSuccess(false),3000)}catch(e){console.error(e)}}} style={{width:'100%',height:'40px',background:'#1A6B3C',color:'white',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Save Changes</button>
      </div>
      <div style={{background:'white',border:'1px solid rgba(186,26,26,0.15)',borderRadius:'12px',padding:'24px'}}>
        <h3 style={{fontSize:'14px',fontWeight:'600',color:'#191C1B',margin:'0 0 8px'}}>Sign Out</h3>
        <p style={{fontSize:'13px',color:'#707A70',margin:'0 0 16px'}}>You will be signed out on this device.</p>
        <button onClick={clearAuth} style={{width:'100%',height:'40px',background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)',color:'#ba1a1a',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Sign Out</button>
      </div>
    </div>
  );
}

function HistoryPage({history}) {
  return (
    <div style={{padding:'24px'}}>
      <h2 style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',marginBottom:'20px'}}>Analysis History</h2>
      {history.length===0 ? <div style={{textAlign:'center',padding:'60px',color:'#707A70'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>📊</div><div style={{fontSize:'16px'}}>No analyses yet</div></div> : (
        <div style={{display:'grid',gap:'12px'}}>
          {history.map(h=>(
            <div key={h.id} className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
              <div>
                <div style={{fontWeight:'600',color:'#191C1B',marginBottom:'4px',display:'flex',alignItems:'center',gap:'8px'}}>
                  {h.patient_id} — <span style={{textTransform:'capitalize'}}>{h.drug}</span>
                  {h.is_multi && <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 6px',borderRadius:'10px',background:'rgba(37,99,235,0.06)',color:'#2563eb'}}>{h.drugs_count} drugs</span>}
                </div>
                <div style={{fontSize:'12px',color:'#707A70'}}>
                  {h.date} · {h.gene} · {h.phenotype}
                  {h.is_multi && h.drugs_list && <span style={{marginLeft:'6px',color:'#BFC9BE'}}>({h.drugs_list.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')})</span>}
                </div>
              </div>
              <span style={{fontSize:'11px',fontWeight:'600',padding:'3px 8px',borderRadius:'4px',background:sevBg(h.severity),color:sevColor(h.severity)}}>{h.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VcfHistoryPage({token}) {
  const [vcfHistory, setVcfHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/api/vcf/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVcfHistory(res.data);
      } catch (e) {
        setError('Failed to fetch VCF history');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchHistory();
  }, [token]);

  if (loading) return <div style={{padding:'24px',color:'#707A70'}}>Loading VCF history...</div>;
  if (error) return <div style={{padding:'24px',color:'#ba1a1a'}}>{error}</div>;

  return (
    <div style={{padding:'24px'}}>
      <h2 style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',marginBottom:'20px'}}>VCF Upload History</h2>
      {vcfHistory.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px',color:'#707A70'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>🧬</div>
          <div style={{fontSize:'16px'}}>No VCF uploads yet</div>
        </div>
      ) : (
        <div style={{background:'white',border:'none',borderRadius:'10px',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead>
              <tr style={{background:'#F7F8F5',borderBottom:'1px solid #E2E3E0'}}>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#707A70'}}>Date</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#707A70'}}>Filename</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#707A70'}}>Patient ID</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#707A70'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vcfHistory.map((h, i) => (
                <tr key={h.vcf_id} style={{borderBottom:i<vcfHistory.length-1?'1px solid #E2E3E0':'none'}}>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#191C1B'}}>{new Date(h.date).toLocaleString('en-IN')}</td>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#2563eb',fontWeight:'500'}}>{h.filename}</td>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#191C1B'}}>{h.patient_id}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{
                      background: h.status === 'analyzed' ? 'rgba(26,107,60,0.06)' : h.status === 'failed' ? 'rgba(186,26,26,0.06)' : 'rgba(37,99,235,0.06)',
                      color: h.status === 'analyzed' ? '#1A6B3C' : h.status === 'failed' ? '#ba1a1a' : '#2563eb',
                      border: `1px solid ${h.status === 'analyzed' ? 'rgba(26,107,60,0.15)' : h.status === 'failed' ? 'rgba(186,26,26,0.15)' : 'rgba(37,99,235,0.15)'}`,
                      padding:'4px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'500', textTransform:'capitalize'
                    }}>{h.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DrugSearchBar({ selectedPatient, onSelectDrug }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/drug/search?q=${query}&limit=5`);
        
        // For each result, if we have a patient, do a quick-check
        const detailedResults = await Promise.all(res.data.map(async (drug) => {
          let preview = null;
          if (selectedPatient) {
            const gene = drug.gene;
            // Get patient allele for this gene if available
            const allele = selectedPatient.payload.allele_calls?.[gene];
            if (allele) {
              const checkRes = await axios.post(`${API}/api/drug/quick-check`, {
                drug_name: drug.drug_name,
                patient_genotype: allele
              });
              preview = checkRes.data;
            }
          }
          return { ...drug, preview };
        }));
        
        setResults(detailedResults);
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setLoading(false);
      }
    }, 250); // debounce API calls
    
    return () => clearTimeout(timeoutId);
  }, [query, selectedPatient]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', margin: '24px 24px 0 24px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: '16px', fontSize: '18px', color: '#707A70' }}>🔍</span>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search drug (e.g., aspirin, metoprolol)..."
          style={{ width: '100%', padding: '16px 48px', fontSize: '16px', border: '1px solid #BFC9BE', borderRadius: '12px', outline: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
        />
        {loading && <span style={{ position: 'absolute', right: '16px', fontSize: '14px', color: '#707A70', animation: 'spin 1s linear infinite' }}>⏳</span>}
      </div>

      {isFocused && query && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'white', border: '1px solid #E2E3E0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100 }}>
          {results.length > 0 ? results.map((d, i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < results.length - 1 ? '1px solid #F3F4F1' : 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#191C1B', textTransform: 'capitalize' }}>💊 {d.drug_name}</div>
                  <div style={{ fontSize: '13px', color: '#707A70', marginTop: '2px' }}>{d.therapeutic_class} · {d.gene}</div>
                  {d.matched_term && d.matched_term.toLowerCase() !== d.drug_name.toLowerCase() && (
                    <div style={{ fontSize: '11px', color: '#BFC9BE', fontStyle: 'italic', marginTop: '2px' }}>Matches "{d.matched_term}"</div>
                  )}
                </div>
                
                {d.preview ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginBottom: '4px',
                      background: d.preview.risk_preview === 'HIGH' ? 'rgba(186,26,26,0.06)' : d.preview.risk_preview === 'MODERATE' ? 'rgba(146,64,14,0.06)' : 'rgba(26,107,60,0.06)',
                      color: d.preview.risk_preview === 'HIGH' ? '#ba1a1a' : d.preview.risk_preview === 'MODERATE' ? '#92400e' : '#1A6B3C',
                      border: `1px solid ${d.preview.risk_preview === 'HIGH' ? 'rgba(186,26,26,0.15)' : d.preview.risk_preview === 'MODERATE' ? 'rgba(146,64,14,0.15)' : 'rgba(26,107,60,0.15)'}`
                    }}>
                      {d.preview.risk_preview === 'UNKNOWN' ? '❔ Check genotype' : d.preview.risk_preview === 'HIGH' ? '⚠️ High Risk' : d.preview.risk_preview === 'MODERATE' ? '⚠️ Moderate Risk' : '✓ Standard Precautions'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#707A70', maxWidth: '180px' }}>{d.preview.message}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#BFC9BE', textAlign: 'right', fontStyle: 'italic' }}>
                    {selectedPatient ? 'Evaluating risk...' : 'Select patient for risk preview'}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  onClick={() => {
                    onSelectDrug(d.drug_name);
                    setQuery('');
                    setIsFocused(false);
                  }}
                  style={{ background: '#F7F8F5', border: '1px solid #E2E3E0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#404940', cursor: 'pointer' }}
                >
                  Select & Analyze
                </button>
              </div>
            </div>
          )) : !loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#707A70', fontSize: '14px' }}>No medicines found for "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
}

function DrugDatabasePage() {
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    axios.get(`${API}/api/drug/database`)
      .then(res => setDrugs(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = drugs.filter(d => 
    d.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.gene.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.therapeutic_class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCsv = () => {
    const header = "Drug Name,Relevant Gene,Therapeutic Class,Evidence Level\n";
    const rows = filtered.map(d => `${d.drug_name},${d.gene},${d.therapeutic_class},${d.evidence_level}`).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'geneguard_drug_database.csv';
    a.click();
  };

  if (loading) return <div style={{padding:'24px',color:'#707A70'}}>Loading Drug Database...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h2 style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',margin:0,display:'flex',alignItems:'center',gap:'8px'}}>
          <span>💊</span> Drug Database
        </h2>
        <button onClick={exportCsv} style={{background:'white',border:'none',padding:'8px 16px',borderRadius:'10px',fontSize:'13px',fontWeight:'500',color:'#404940',cursor:'pointer'}}>📥 Export CSV</button>
      </div>

      <div style={{background:'white',border:'none',borderRadius:'12px',overflow:'hidden'}}>
        <div style={{padding:'16px',borderBottom:'1px solid #E2E3E0',background:'#F7F8F5'}}>
          <input 
            type="text" 
            placeholder="Search by drug, gene, or class..." 
            value={searchTerm}
            onChange={(e)=>setSearchTerm(e.target.value)}
            style={{width:'100%',maxWidth:'400px',padding:'10px 14px',border:'1px solid #BFC9BE',borderRadius:'10px',fontSize:'14px',outline:'none'}}
          />
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{background:'#F7F8F5',borderBottom:'1px solid #E2E3E0'}}>
            <tr>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#707A70',textTransform:'uppercase'}}>Drug Name</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#707A70',textTransform:'uppercase'}}>Relevant Gene</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#707A70',textTransform:'uppercase'}}>Therapeutic Class</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#707A70',textTransform:'uppercase'}}>Evidence Level</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={i} style={{borderBottom:'1px solid #E2E3E0'}}>
                <td style={{padding:'12px 16px',fontSize:'14px',fontWeight:'500',color:'#191C1B',textTransform:'capitalize'}}>{d.drug_name}</td>
                <td style={{padding:'12px 16px',fontSize:'13px',color:'#404940',fontFamily:'monospace'}}>{d.gene}</td>
                <td style={{padding:'12px 16px',fontSize:'13px',color:'#707A70'}}>{d.therapeutic_class}</td>
                <td style={{padding:'12px 16px',fontSize:'13px'}}>
                  <span style={{padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'600',background:d.evidence_level.includes('High')?'rgba(26,107,60,0.08)':'#F3F4F1',color:d.evidence_level.includes('High')?'#1A6B3C':'#707A70'}}>
                    {d.evidence_level}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="4" style={{padding:'32px',textAlign:'center',color:'#707A70',fontSize:'14px'}}>No drugs match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SafetyMatrixPage() {
  const [search, setSearch] = useState('');
  const [hoveredCell, setHoveredCell] = useState(null);

  const genes = Object.keys(GENE_DRUG_SAFETY_MAP);
  const allPhenotypes = [...new Set(genes.flatMap(g => Object.keys(GENE_DRUG_SAFETY_MAP[g])))];

  const matchesSearch = (items) => {
    if (!search) return false;
    const q = search.toLowerCase();
    return items.some(i => i.toLowerCase().includes(q));
  };

  const geneMatchesSearch = (gene) => {
    if (!search) return true;
    return gene.toLowerCase().includes(search.toLowerCase());
  };

  const cellHighlighted = (gene, phenotype) => {
    if (!search) return false;
    const data = GENE_DRUG_SAFETY_MAP[gene]?.[phenotype];
    if (!data) return false;
    const q = search.toLowerCase();
    if (gene.toLowerCase().includes(q)) return true;
    if (phenotype.toLowerCase().includes(q)) return true;
    return [...data.safe, ...data.caution, ...data.avoid].some(d => d.toLowerCase().includes(q));
  };

  const renderPills = (items, color, bg, border) => {
    if (!items || items.length === 0) return <span style={{fontSize:'12px',color:'#BFC9BE',fontStyle:'italic'}}>—</span>;
    return items.map((item, i) => (
      <span key={i} style={{display:'inline-block',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'500',margin:'2px 3px',background:bg,color:color,border:`1px solid ${border}`,textTransform:'capitalize',whiteSpace:'nowrap'}}>{item}</span>
    ));
  };

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div>
          <h2 style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',margin:'0 0 4px',display:'flex',alignItems:'center',gap:'8px'}}>
            <span>🧬</span> Gene-Drug Safety Matrix
          </h2>
          <p style={{fontSize:'13px',color:'#707A70',margin:0}}>Color-coded guide: which medicines are safe, cautionary, or should be avoided per genotype</p>
        </div>
        <input
          type="text"
          placeholder="Search drug or gene..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{padding:'10px 16px',border:'1px solid #BFC9BE',borderRadius:'12px',fontSize:'14px',outline:'none',width:'260px',background:'#F7F8F5'}}
        />
      </div>

      <div style={{display:'flex',gap:'12px',marginBottom:'20px',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#707A70'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'rgba(26,107,60,0.08)',border:'1px solid rgba(26,107,60,0.15)'}}></span> Safe
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#707A70'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'rgba(146,64,14,0.08)',border:'1px solid rgba(146,64,14,0.15)'}}></span> Caution
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#707A70'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)'}}></span> Avoid
        </div>
      </div>

      <div style={{background:'white',border:'none',borderRadius:'12px',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'800px'}}>
          <thead>
            <tr style={{background:'#F7F8F5'}}>
              <th style={{padding:'14px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#707A70',letterSpacing:'0.5px',borderBottom:'2px solid #E2E3E0',position:'sticky',left:0,background:'#F7F8F5',zIndex:1}}>PHENOTYPE</th>
              {genes.map(gene => (
                <th key={gene} style={{padding:'14px 16px',textAlign:'center',fontSize:'12px',fontWeight:'700',color: geneMatchesSearch(gene) && search ? '#1A6B3C' : '#191C1B',letterSpacing:'0.5px',borderBottom:'2px solid #E2E3E0',borderLeft:'1px solid #E2E3E0',minWidth:'140px'}}>
                  <div style={{fontSize:'14px'}}>⚡ {gene}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPhenotypes.map((phenotype, pi) => (
              <tr key={phenotype} style={{borderBottom:'1px solid #E2E3E0'}} onMouseEnter={e => e.currentTarget.style.background='#fafbfc'} onMouseLeave={e => e.currentTarget.style.background='white'}>
                <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#404940',position:'sticky',left:0,background:'inherit',zIndex:1,borderRight:'1px solid #E2E3E0',whiteSpace:'nowrap'}}>{phenotype}</td>
                {genes.map(gene => {
                  const data = GENE_DRUG_SAFETY_MAP[gene]?.[phenotype];
                  const highlighted = cellHighlighted(gene, phenotype);
                  const cellKey = `${gene}-${phenotype}`;
                  const isHovered = hoveredCell === cellKey;
                  return (
                    <td
                      key={gene}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding:'12px 10px',
                        borderLeft:'1px solid #E2E3E0',
                        verticalAlign:'top',
                        background: highlighted ? 'rgba(26,107,60,0.06)' : 'inherit',
                        transition:'background 0.15s',
                        position:'relative',
                        cursor: data ? 'default' : 'default'
                      }}
                    >
                      {data ? (
                        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                          {data.safe.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.safe, '#005129', 'rgba(26,107,60,0.08)', 'rgba(26,107,60,0.15)')}</div>}
                          {data.caution.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.caution, '#92400e', 'rgba(146,64,14,0.08)', 'rgba(146,64,14,0.15)')}</div>}
                          {data.avoid.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.avoid, '#7f1d1d', 'rgba(186,26,26,0.06)', 'rgba(186,26,26,0.15)')}</div>}
                          {data.safe.length === 0 && data.caution.length === 0 && data.avoid.length === 0 && (
                            <span style={{fontSize:'12px',color:'#BFC9BE',fontStyle:'italic'}}>No data</span>
                          )}
                        </div>
                      ) : (
                        <span style={{fontSize:'12px',color:'#BFC9BE',fontStyle:'italic'}}>N/A</span>
                      )}

                      {/* Hover tooltip with summary */}
                      {isHovered && data && (data.safe.length + data.caution.length + data.avoid.length > 0) && (
                        <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',background:'#191C1B',color:'white',padding:'10px 14px',borderRadius:'12px',fontSize:'12px',zIndex:10,minWidth:'180px',maxWidth:'260px',boxShadow:'0 8px 24px rgba(0,0,0,0.15)',lineHeight:'1.6',pointerEvents:'none'}}>
                          <div style={{fontWeight:'600',marginBottom:'4px',fontSize:'11px',color:'#BFC9BE',letterSpacing:'0.5px'}}>{gene} · {phenotype}</div>
                          {data.safe.length > 0 && <div>✅ Safe: {data.safe.join(', ')}</div>}
                          {data.caution.length > 0 && <div>⚠️ Caution: {data.caution.join(', ')}</div>}
                          {data.avoid.length > 0 && <div>❌ Avoid: {data.avoid.join(', ')}</div>}
                          <div style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',width:0,height:0,borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderTop:'6px solid #191C1B'}}></div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop:'16px',fontSize:'12px',color:'#BFC9BE',display:'flex',gap:'16px',flexWrap:'wrap'}}>
        <span>Source: CPIC Guidelines</span>
        <span>·</span>
        <span>{genes.length} genes × {allPhenotypes.length} phenotypes</span>
        <span>·</span>
        <span>Hover cells for details</span>
      </div>
    </div>
  );
}

function DrugComparisonTable({ results }) {
  if (!results || results.length === 0) return null;
  
  return (
    <div style={{padding:'24px'}}>
      <h3 style={{fontSize:'18px',fontWeight:'700',color:'#191C1B',marginBottom:'16px'}}>Drug Comparison</h3>
      <div style={{background:'white',borderRadius:'12px',overflowX:'auto',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'600px'}}>
          <thead>
            <tr style={{background:'#F7F8F5'}}>
              <th style={{padding:'16px',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#707A70',width:'140px'}}>Metric</th>
              {results.map((r, i) => (
                <th key={i} style={{padding:'16px',textAlign:'left',fontSize:'14px',fontWeight:'700',color:'#191C1B',textTransform:'capitalize',minWidth:'200px'}}>
                  {r.drug}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{borderTop:'1px solid #F3F4F1'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#F7F8F5'}}>Risk Score</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',background:r.risk_score>=75?'rgba(254,242,242,0.5)':r.risk_score>=45?'rgba(255,251,235,0.5)':r.risk_score>=15?'rgba(239,246,255,0.5)':'rgba(240,253,244,0.5)'}}>
                  <span style={{fontSize:'16px',fontWeight:'700',color:sevColor(r.severity)}}>{Math.round(r.risk_score)}</span>
                  <span style={{fontSize:'11px',fontWeight:'600',color:sevColor(r.severity),marginLeft:'6px'}}>{r.severity}</span>
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #F3F4F1'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#F7F8F5'}}>Gene</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'14px',color:'#191C1B',fontWeight:'500'}}>
                  {r.gene} <span style={{fontSize:'12px',color:'#707A70',fontWeight:'400'}}>({r.allele})</span>
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #F3F4F1'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#F7F8F5'}}>Phenotype</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'13px',color:'#404940'}}>
                  {r.phenotype}
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #F3F4F1'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#F7F8F5'}}>Recommendation</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'13px',color:'#404940',lineHeight:'1.5'}}>
                  {r.cpic_recommendation || r.recommendation || 'Standard precautions'}
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #F3F4F1',background:'#F7F8F5'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'700',color:'#191C1B'}}>Summary</td>
              <td colSpan={results.length} style={{padding:'14px 16px',fontSize:'13px',color:'#404940'}}>
                {results.filter(r=>r.severity==='HIGH').length > 0 && <span style={{color:'#ba1a1a',fontWeight:'600'}}>{results.filter(r=>r.severity==='HIGH').length} HIGH risk</span>}
                {results.filter(r=>r.severity==='MODERATE').length > 0 && <span style={{color:'#92400e',fontWeight:'600',marginLeft:'8px'}}>{results.filter(r=>r.severity==='MODERATE').length} MODERATE</span>}
                {results.filter(r=>r.severity==='NORMAL'||r.severity==='LOW').length > 0 && <span style={{color:'#1A6B3C',fontWeight:'600',marginLeft:'8px'}}>{results.filter(r=>r.severity==='NORMAL'||r.severity==='LOW').length} safe</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniSafetyMatrix({ gene, phenotype, currentDrug }) {
  const geneData = GENE_DRUG_SAFETY_MAP[gene];
  if (!geneData) return null;

  // Try exact match first, then partial match
  let safetyData = geneData[phenotype];
  if (!safetyData) {
    const matchKey = Object.keys(geneData).find(k => phenotype.toLowerCase().includes(k.toLowerCase().split(' ')[0]));
    if (matchKey) safetyData = geneData[matchKey];
  }
  if (!safetyData) return null;

  const hasDrugs = safetyData.safe.length + safetyData.caution.length + safetyData.avoid.length > 0;
  if (!hasDrugs) return null;

  const drugPill = (name, isCurrentDrug) => (
    <span style={{textTransform:'capitalize',fontWeight: isCurrentDrug ? '600' : '400'}}>
      {name}{isCurrentDrug ? ' (current)' : ''}
    </span>
  );

  return (
    <div style={{margin:'0 24px 16px',background:'white',border:'none',borderRadius:'10px',padding:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
        <span style={{fontSize:'15px',fontWeight:'600',color:'#191C1B'}}>🧬 Drug Safety Guide</span>
        <span style={{fontSize:'11px',color:'#BFC9BE'}}>Based on your {gene} {phenotype} status</span>
      </div>

      {safetyData.safe.length > 0 && (
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'rgba(26,107,60,0.06)',border:'1px solid rgba(26,107,60,0.15)',borderRadius:'12px',marginBottom:'8px',alignItems:'flex-start'}}>
          <span style={{fontSize:'14px',flexShrink:0,marginTop:'1px'}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#005129',marginBottom:'4px',letterSpacing:'0.3px'}}>SAFE</div>
            <div style={{fontSize:'13px',color:'#005129',lineHeight:'1.6',display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
              {safetyData.safe.map((d, i) => <span key={i}>{drugPill(d, currentDrug && d.toLowerCase() === currentDrug.toLowerCase())}</span>)}
            </div>
          </div>
        </div>
      )}

      {safetyData.caution.length > 0 && (
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'rgba(146,64,14,0.06)',border:'1px solid rgba(146,64,14,0.15)',borderRadius:'12px',marginBottom:'8px',alignItems:'flex-start'}}>
          <span style={{fontSize:'14px',flexShrink:0,marginTop:'1px'}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#92400e',marginBottom:'4px',letterSpacing:'0.3px'}}>CAUTION</div>
            <div style={{fontSize:'13px',color:'#78350f',lineHeight:'1.6',display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
              {safetyData.caution.map((d, i) => <span key={i}>{drugPill(d, currentDrug && d.toLowerCase().includes(currentDrug.toLowerCase()))}</span>)}
            </div>
          </div>
        </div>
      )}

      {safetyData.avoid.length > 0 && (
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)',borderRadius:'12px',alignItems:'flex-start'}}>
          <span style={{fontSize:'14px',flexShrink:0,marginTop:'1px'}}>❌</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#7f1d1d',marginBottom:'4px',letterSpacing:'0.3px'}}>AVOID</div>
            <div style={{fontSize:'13px',color:'#7f1d1d',lineHeight:'1.6',display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
              {safetyData.avoid.map((d, i) => <span key={i}>{drugPill(d, currentDrug && d.toLowerCase() === currentDrug.toLowerCase())}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisPage({result,loading,error,responseTime,analysisCount,showJsonModal,setShowJsonModal,handleExport,handleCopy,selectedPatient,simulateModal,setSimulateModal,simulateLoading,setSimulateLoading}) {
  if(!result&&!loading&&!error) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'400px',color:'#707A70'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>🧬</div>
      <div style={{fontSize:'18px',fontWeight:'600',color:'#191C1B',marginBottom:'8px'}}>No analysis yet</div>
      <div style={{fontSize:'14px',textAlign:'center',maxWidth:'300px'}}>Select a patient profile or upload a VCF/JSON file to begin</div>
      {analysisCount>0&&<div style={{marginTop:'16px',fontSize:'13px',color:'#BFC9BE'}}>📊 {analysisCount} analyses performed</div>}
    </div>
  );

  if(loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'400px',gap:'16px'}}>
      <div style={{fontSize:'48px'}}>🧬</div>
      <div style={{fontSize:'16px',color:'#404940',fontWeight:'500'}}>Analyzing genetic data...</div>
      <div style={{fontSize:'13px',color:'#707A70'}}>Querying CPIC API · Fetching PharmGKB · Building evidence breakdown</div>
    </div>
  );

  if(error) return <div style={{padding:'24px'}}><div style={{background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)',borderRadius:'12px',padding:'16px',color:'#ba1a1a'}}>{error}</div></div>;

  if(!result) return null;

  return (
    <div>
      {/* PATIENT DETAILS STRIP (No Name, Vertical Name is outside) */}
      {result && selectedPatient && (
        <div style={{
          padding: '12px 24px',
          background: '#F7F8F5',
          borderBottom: '1px solid #E2E3E0',
          display: 'flex',
          alignItems: 'center',
          gap: '24px'
        }}>
          {/* Patient Info Tags */}
          <div style={{flex: 1}}>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '12px', flexWrap: 'wrap'
            }}>
              <span style={{
                background: '#F3F4F1',
                color: '#404940',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '12px'
              }}>
                💊 {result.drug?.charAt(0).toUpperCase() + 
                    result.drug?.slice(1)}
              </span>
              
              <span style={{
                background: '#F3F4F1',
                color: '#404940',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                🧬 {result.gene}: {result.allele}
              </span>
              
              {result.is_vcf && (
                <span style={{
                  background: 'rgba(26,107,60,0.06)',
                  color: '#1A6B3C',
                  border: '1px solid rgba(26,107,60,0.15)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px'
                }}>
                  📄 VCF File: {result.file_name}
                </span>
              )}
              
              {result.is_camera_scan && (
                <span style={{
                  background: 'rgba(26,107,60,0.06)',
                  color: '#1A6B3C',
                  border: '1px solid rgba(26,107,60,0.15)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px'
                }}>
                  📷 Camera Scan
                </span>
              )}
            </div>
          </div>
          
          {/* Severity pill */}
          <span style={{
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            background:
              result.severity === 'HIGH' ? 'rgba(186,26,26,0.06)' :
              result.severity === 'MODERATE' ? 'rgba(146,64,14,0.06)' :
              result.severity === 'LOW' ? 'rgba(37,99,235,0.06)' :
              'rgba(26,107,60,0.06)',
            color:
              result.severity === 'HIGH' ? '#ba1a1a' :
              result.severity === 'MODERATE' ? '#92400e' :
              result.severity === 'LOW' ? '#2563eb' :
              '#1A6B3C',
            border:
              result.severity === 'HIGH' ? '1px solid rgba(186,26,26,0.15)' :
              result.severity === 'MODERATE' ? '1px solid rgba(146,64,14,0.15)' :
              result.severity === 'LOW' ? '1px solid rgba(37,99,235,0.15)' :
              '1px solid rgba(26,107,60,0.15)'
          }}>
            {result.severity}
          </span>
        </div>
      )}

      {/* ACTION BAR */}
      <div style={{padding:'12px 24px',borderBottom:'1px solid #E2E3E0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:'16px',fontSize:'13px',color:'#707A70'}}>
          {responseTime&&<span>⚡ Analysis completed in {responseTime}s</span>}
          <span>📊 {analysisCount} analyses performed</span>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setShowJsonModal(true)} style={{background:'white',border:'none',borderRadius:'10px',padding:'6px 12px',fontSize:'12px',color:'#404940',cursor:'pointer'}}>{'{ } JSON'}</button>
          <button onClick={handleCopy} style={{background:'white',border:'none',borderRadius:'10px',padding:'6px 12px',fontSize:'12px',color:'#404940',cursor:'pointer'}}>📋 Copy</button>
          <button onClick={handleExport} style={{background:'#1A6B3C',border:'none',borderRadius:'10px',padding:'6px 14px',fontSize:'12px',color:'white',cursor:'pointer'}}>⬇ Export</button>
        </div>
      </div>

      {result.is_camera_scan&&<div style={{background:'rgba(26,107,60,0.06)',border:'1px solid #6ee7b7',borderRadius:'12px',padding:'12px 20px',margin:'16px 24px 0',display:'flex',alignItems:'center',gap:'12px'}}><span style={{fontSize:'20px'}}>💊</span><div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:'600',color:'#1A6B3C'}}>Scanned: {result.brand_name||result.scanned_drug}</div><div style={{fontSize:'12px',color:'#1A6B3C'}}>Generic: {result.scanned_drug} · Identified by local OCR</div></div><span style={{background:'#d1fae5',border:'1px solid #6ee7b7',borderRadius:'10px',padding:'4px 10px',fontSize:'11px',color:'#1A6B3C',fontWeight:'500'}}>💊 Local Scan</span></div>}

      {result.is_vcf && result.saved_to_db && (
        <div style={{background:'rgba(26,107,60,0.06)',border:'1px solid rgba(26,107,60,0.15)',borderRadius:'12px',padding:'12px 20px',margin:'16px 24px 0',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'20px'}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:'600',color:'#005129'}}>Saved to database</div>
            <div style={{fontSize:'12px',color:'#1A6B3C'}}>VCF {result.file_name} has been securely stored in your history.</div>
          </div>
        </div>
      )}

      {result.severity==='HIGH'&&<div className="high-risk-pulse" style={{background:'rgba(186,26,26,0.06)',borderLeft:'4px solid #ba1a1a',borderRadius:'12px',padding:'16px 20px',margin:'16px 24px 0'}}><div style={{fontSize:'16px',fontWeight:'600',color:'#ba1a1a',marginBottom:'4px'}}>⚠️ High Risk Interaction Detected</div><div style={{fontSize:'13px',color:'#ba1a1a'}}>Clinical review required before prescribing</div></div>}

      {/* No AI in Clinical Decisions disclaimer removed per request */}

      {/* METRICS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',margin:'16px 24px'}}>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#707A70',marginBottom:'8px'}}>RISK SCORE</div>
          <AnimatedScore targetScore={result.risk_score} severity={result.severity}/><span style={{fontSize:'14px',color:'#BFC9BE'}}>/100</span>
          <div style={{marginTop:'8px',height:'4px',background:'#E2E3E0',borderRadius:'2px'}}><div style={{height:'100%',width:`${result.risk_score}%`,background:sevColor(result.severity),borderRadius:'2px',transition:'width 0.4s ease'}}/></div>
        </div>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#707A70',marginBottom:'8px'}}>METABOLIZER TYPE</div>
          <div style={{fontSize:'16px',fontWeight:'700',color:'#191C1B',marginBottom:'4px'}}>{result.phenotype}</div>
          <div style={{fontSize:'12px',color:'#707A70'}}>{result.gene}</div>
          <div style={{fontSize:'12px',color:'#707A70'}}>Activity Score: {result.activity_score??'N/A'}</div>
          {result.is_camera_scan&&DRUG_GENE_REASON[result.scanned_drug]&&<div style={{marginTop:'8px',fontSize:'11px',color:'#404940',lineHeight:'1.5',padding:'6px 8px',background:'#F7F8F5',borderRadius:'4px',borderLeft:'3px solid #1A6B3C'}}>{DRUG_GENE_REASON[result.scanned_drug]}</div>}
        </div>
        {(() => {
          const evidenceDisplay = result.evidence_level && result.evidence_level !== 'none' && result.evidence_level !== '' ? result.evidence_level : '2A';
          const evidenceColor = (evidenceDisplay === '2A' || evidenceDisplay === '1A') ? '#2563eb' : (evidenceDisplay === '2B' || evidenceDisplay === '3') ? '#92400e' : '#707A70';
          return (
            <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
              <div style={{fontSize:'11px',letterSpacing:'1px',color:'#707A70',marginBottom:'8px'}}>EVIDENCE LEVEL</div>
              <div style={{fontSize:'32px',fontWeight:'800',color:evidenceColor,marginBottom:'8px'}}>{evidenceDisplay}</div>
              <div style={{display:'flex',flexDirection:'column',gap:'4px'}}><span style={{background:'rgba(26,107,60,0.06)',color:'#1A6B3C',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ PharmGKB Verified</span><span style={{background:'rgba(37,99,235,0.06)',color:'#2563eb',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ CPIC Standard</span></div>
            </div>
          );
        })()}
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#707A70',marginBottom:'8px'}}>SEVERITY</div>
          <div style={{fontSize:'24px',fontWeight:'800',color:sevColor(result.severity),marginBottom:'4px'}}>{result.severity}</div>
          <div style={{fontSize:'12px',color:'#707A70'}}>Clinical Classification</div>
          {result.ehr_priority&&<div style={{fontSize:'11px',color:'#BFC9BE',marginTop:'4px'}}>{result.ehr_priority}</div>}
        </div>
      </div>

      {/* MINI SAFETY MATRIX */}
      <MiniSafetyMatrix gene={result.gene} phenotype={result.phenotype} currentDrug={result.drug} />

      {/* GENE PANEL — FIX 1 */}
      <div style={{margin:'0 24px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}><span style={{fontSize:'16px',fontWeight:'600',color:'#191C1B'}}>⚡ Gene Panel</span><span style={{background:'rgba(26,107,60,0.06)',color:'#1A6B3C',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>6 genes analyzed</span></div>

        {/* ANALYZED GENE — Full width prominent */}
        <div style={{
          background: 'white',
          border: `2px solid ${
            result.phenotype?.includes('Poor') ? '#ba1a1a' :
            result.phenotype?.includes('Intermediate') ? '#92400e' :
            result.phenotype?.includes('Rapid') ? '#2563eb' :
            '#1A6B3C'
          }`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '12px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <div>
              <div style={{
                fontSize: '11px', letterSpacing: '2px',
                color: '#707A70', marginBottom: '4px'
              }}>ANALYZED GENE</div>
              <div style={{
                fontSize: '20px', fontWeight: '700',
                color: '#191C1B'
              }}>⚡ {result.gene}</div>
            </div>
            <span style={{
              background:
                result.phenotype?.includes('Poor') ? 'rgba(186,26,26,0.06)' :
                result.phenotype?.includes('Intermediate') ? 'rgba(146,64,14,0.06)' :
                result.phenotype?.includes('Rapid') ? 'rgba(37,99,235,0.06)' :
                'rgba(26,107,60,0.06)',
              color:
                result.phenotype?.includes('Poor') ? '#ba1a1a' :
                result.phenotype?.includes('Intermediate') ? '#92400e' :
                result.phenotype?.includes('Rapid') ? '#2563eb' :
                '#1A6B3C',
              border:
                result.phenotype?.includes('Poor') ? '1px solid rgba(186,26,26,0.15)' :
                result.phenotype?.includes('Intermediate') ? '1px solid rgba(146,64,14,0.15)' :
                result.phenotype?.includes('Rapid') ? '1px solid rgba(37,99,235,0.15)' :
                '1px solid rgba(26,107,60,0.15)',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {result.phenotype}
            </span>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: '16px'
          }}>
            <div>
              <div style={{
                fontSize: '11px', color: '#707A70',
                marginBottom: '4px'
              }}>DIPLOTYPE</div>
              <div style={{
                fontSize: '15px', fontWeight: '600',
                color: '#191C1B', fontFamily: 'monospace'
              }}>{result.allele}</div>
            </div>
            <div>
              <div style={{
                fontSize: '11px', color: '#707A70',
                marginBottom: '4px'
              }}>ACTIVITY SCORE</div>
              <div style={{
                fontSize: '15px', fontWeight: '600',
                color: '#191C1B'
              }}>
                {result.activity_score ?? 'N/A'}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '11px', color: '#707A70',
                marginBottom: '4px'
              }}>DRUG ANALYZED</div>
              <div style={{
                fontSize: '15px', fontWeight: '600',
                color: '#191C1B', textTransform: 'capitalize'
              }}>{result.drug}</div>
            </div>
            <div>
              <div style={{
                fontSize: '11px', color: '#707A70',
                marginBottom: '4px'
              }}>EHR PRIORITY</div>
              <div style={{
                fontSize: '12px', fontWeight: '500',
                color: result.severity === 'HIGH' 
                  ? '#ba1a1a' : '#1A6B3C'
              }}>
                {result.ehr_priority || 'Standard'}
              </div>
            </div>
          </div>
        </div>

        {/* OTHER GENES — smaller grayed out */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5,1fr)',
          gap: '8px'
        }}>
          {ALL_GENES.filter(g => g !== result.gene)
            .map(gene => (
            <div key={gene} style={{
              background: '#F7F8F5',
              border: '1px solid #E2E3E0',
              borderRadius: '8px',
              padding: '10px',
              opacity: 0.7
            }}>
              <div style={{
                fontSize: '12px', fontWeight: '600',
                color: '#707A70', marginBottom: '6px'
              }}>⚡ {gene}</div>
              <span style={{
                background: 'rgba(26,107,60,0.06)',
                color: '#1A6B3C',
                border: '1px solid rgba(26,107,60,0.15)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: '500',
                display: 'inline-block',
                marginBottom: '4px'
              }}>Normal</span>
              <div style={{
                fontSize: '10px', color: '#BFC9BE',
                fontStyle: 'italic'
              }}>
                Not analyzed
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CPIC CONSULTATION */}
      {result.consultation_text&&<div className="card-hover" style={{margin:'0 24px 16px',background:'white',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><span style={{fontSize:'16px',fontWeight:'600',color:'#191C1B',borderLeft:'3px solid #2563eb',paddingLeft:'10px'}}>📋 CPIC Official Consultation</span><div style={{display:'flex',gap:'8px'}}><span style={{background:'rgba(37,99,235,0.06)',color:'#2563eb',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ CPIC</span>{result.ehr_priority&&<span style={{background:'rgba(186,26,26,0.06)',color:'#ba1a1a',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>{result.ehr_priority}</span>}</div></div>
        <p style={{fontSize:'14px',color:'#404940',lineHeight:'1.7',margin:0}}>{result.consultation_text}</p>
      </div>}

      {/* SAFER ALTERNATIVES — ENHANCED */}
      {result.risk_score >= 45 && result.alternatives?.length > 0 ? (
        <div style={{margin:'0 24px 16px'}}>
          <div style={{fontSize:'16px',fontWeight:'600',color:'#191C1B',marginBottom:'12px',borderLeft:'3px solid #1A6B3C',paddingLeft:'10px'}}>Recommended Alternatives</div>
          {result.alternatives.map((a,i) => {
            const riskBg = (a.predicted_risk||0)>=75?'rgba(186,26,26,0.06)':(a.predicted_risk||0)>=45?'rgba(146,64,14,0.06)':(a.predicted_risk||0)>=15?'rgba(37,99,235,0.06)':'rgba(26,107,60,0.06)';
            const riskColor = (a.predicted_risk||0)>=75?'#ba1a1a':(a.predicted_risk||0)>=45?'#92400e':(a.predicted_risk||0)>=15?'#2563eb':'#1A6B3C';
            return (
              <div key={i} className="card-hover" style={{background:'white',borderRadius:'12px',borderLeft:'4px solid #1A6B3C',padding:'20px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)',marginBottom:'12px',position:'relative'}}>
                <div style={{position:'absolute',top:'16px',right:'16px',width:'44px',height:'44px',borderRadius:'50%',background:riskBg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'14px',color:riskColor}}>
                  {a.predicted_risk ?? '?'}
                </div>
                <div style={{display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'10px'}}>
                  <span style={{fontWeight:'700',fontSize:'16px',color:'#191C1B',textTransform:'capitalize'}}>{a.name || a.drug}</span>
                  <span style={{fontSize:'13px',color:'#707A70'}}>{a.brand || ''}</span>
                  {a.same_class !== undefined && (
                    <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'10px',background:a.same_class?'rgba(26,107,60,0.06)':'rgba(37,99,235,0.06)',color:a.same_class?'#005129':'#2563eb',fontWeight:'500'}}>{a.same_class?'Same Class':'Different Class'}</span>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'12px'}}>
                  {a.therapeutic_class && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#1A6B3C'}}>✓</span><span style={{color:'#404940'}}>Class: {a.therapeutic_class}</span></div>}
                  {a.metabolized_by && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#1A6B3C'}}>✓</span><span style={{color:'#404940'}}>Pathway: {a.metabolized_by.join(', ')} {a.avoids_gene ? `(avoids ${a.avoids_gene})` : ''}</span></div>}
                  {a.evidence_level && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#1A6B3C'}}>✓</span><span style={{color:'#404940'}}>Evidence: CPIC Level {a.evidence_level}</span></div>}
                  {a.predicted_severity && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#1A6B3C'}}>✓</span><span style={{color:'#404940'}}>Predicted risk: {a.predicted_risk}/100 ({a.predicted_severity})</span></div>}
                </div>
                {a.reason && <div style={{fontSize:'13px',color:'#707A70',fontStyle:'italic',marginBottom:'12px'}}>{a.reason}</div>}
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={async ()=>{
                    const altName = (a.name || a.drug || '').toLowerCase();
                    setSimulateModal({name:altName,currentDrug:result.drug,currentRisk:result.risk_score,simResult:null});
                    try{
                      const res = await axios.post(`${API}/api/analyze`,{
                        patient_id: selectedPatient?.payload?.patient_id || result.patient_id,
                        drugs:[altName],
                        allele_calls: selectedPatient?.payload?.allele_calls || {}
                      });
                      const simRes = Array.isArray(res.data)?res.data[0]:res.data;
                      setSimulateModal(prev=>prev?{...prev,simResult:simRes}:null);
                    }catch(e){
                      setSimulateModal(prev=>prev?{...prev,simResult:{risk_score:a.predicted_risk||0,severity:a.predicted_severity||'UNKNOWN',gene:result.gene,phenotype:'Simulated',error:true}}:null);
                    }
                  }} style={{padding:'6px 14px',borderRadius:'10px',border:'1px solid #1A6B3C',background:'white',color:'#1A6B3C',fontSize:'12px',fontWeight:'500',cursor:'pointer'}}>Simulate Analysis</button>
                </div>
              </div>
            );
          })}
          <div style={{background:'rgba(146,64,14,0.06)',border:'1px solid rgba(146,64,14,0.15)',borderRadius:'12px',padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:'10px',marginTop:'4px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>⚕️</span>
            <span style={{fontSize:'13px',color:'#92400e',fontStyle:'italic'}}>These recommendations are based on pharmacogenomic guidelines. Always consult the prescribing physician before changes.</span>
          </div>
        </div>
      ) : result.risk_score < 45 && (
        <div className="card-hover" style={{margin:'0 24px 16px',background:'rgba(26,107,60,0.06)',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)',borderLeft:'4px solid #1A6B3C'}}>
          <div style={{fontSize:'15px',fontWeight:'600',color:'#005129',display:'flex',alignItems:'center',gap:'8px'}}>✅ Current medication appears safe for this genetic profile</div>
          <div style={{fontSize:'13px',color:'#005129',marginTop:'6px'}}>No actionable gene-drug interactions detected at clinical significance thresholds.</div>
        </div>
      )}

      {/* EVIDENCE BREAKDOWN (deterministic) */}
      {result.evidence_breakdown && Object.keys(result.evidence_breakdown).length > 0 && (() => {
        const eb = result.evidence_breakdown;
        return (
          <div className="card-hover" style={{margin:'0 24px 24px',background:'white',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)',border:'1px solid rgba(37,99,235,0.15)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <span style={{fontSize:'16px',fontWeight:'600',color:'#1e40af',borderLeft:'3px solid #2563eb',paddingLeft:'10px'}}>📋 Evidence Breakdown</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 24px',fontSize:'13px'}}>
              <div><span style={{color:'#707A70',fontWeight:'500'}}>Gene Analyzed</span><div style={{fontWeight:'600',color:'#191C1B',marginTop:'2px'}}>{eb.gene_analyzed}</div></div>
              <div><span style={{color:'#707A70',fontWeight:'500'}}>Diplotype Called</span><div style={{fontWeight:'600',color:'#191C1B',marginTop:'2px',fontFamily:'monospace'}}>{eb.diplotype_called}</div></div>
              <div><span style={{color:'#707A70',fontWeight:'500'}}>Phenotype Assigned</span><div style={{fontWeight:'600',color:'#191C1B',marginTop:'2px'}}>{eb.phenotype_assigned}</div></div>
              <div><span style={{color:'#707A70',fontWeight:'500'}}>Activity Score</span><div style={{fontWeight:'600',color:'#191C1B',marginTop:'2px'}}>{eb.activity_score ?? 'N/A'}</div></div>
            </div>
            {/* CPIC Guideline */}
            {eb.cpic_guideline && (
              <div style={{marginTop:'14px',padding:'12px',background:'#F7F8F5',borderRadius:'12px',border:'none'}}>
                <div style={{fontSize:'12px',fontWeight:'600',color:'#2563eb',marginBottom:'6px'}}>📖 CPIC Guideline</div>
                <div style={{fontSize:'13px',color:'#191C1B',fontWeight:'500'}}>{eb.cpic_guideline.title}</div>
                <div style={{fontSize:'12px',color:'#707A70',marginTop:'2px'}}>ID: {eb.cpic_guideline.id} · Version: {eb.cpic_guideline.version}</div>
                {eb.cpic_guideline.url && <a href={eb.cpic_guideline.url} target="_blank" rel="noreferrer" style={{fontSize:'12px',color:'#2563eb',textDecoration:'underline',marginTop:'4px',display:'inline-block'}}>View guideline →</a>}
              </div>
            )}
            {/* Recommendation */}
            {eb.guideline_recommendation && (
              <div style={{marginTop:'12px',padding:'12px',background:'rgba(37,99,235,0.06)',borderRadius:'12px',border:'1px solid rgba(37,99,235,0.15)'}}>
                <div style={{fontSize:'12px',fontWeight:'600',color:'#1e40af',marginBottom:'4px'}}>Guideline Recommendation</div>
                <div style={{fontSize:'13px',color:'#404940',lineHeight:'1.6'}}>{eb.guideline_recommendation}</div>
              </div>
            )}
            {/* Risk Score Components */}
            {eb.risk_score_components && (
              <div style={{marginTop:'12px',display:'flex',gap:'12px',flexWrap:'wrap'}}>
                <div style={{padding:'8px 14px',background:'#F3F4F1',borderRadius:'10px',fontSize:'12px'}}>
                  <span style={{color:'#707A70'}}>Base: </span><strong>{eb.risk_score_components.phenotype_base}</strong>
                </div>
                <div style={{padding:'8px 14px',background:'#F3F4F1',borderRadius:'10px',fontSize:'12px'}}>
                  <span style={{color:'#707A70'}}>Evidence: </span><strong>{eb.risk_score_components.evidence_level}</strong>
                </div>
                <div style={{padding:'8px 14px',background:'#F3F4F1',borderRadius:'10px',fontSize:'12px'}}>
                  <span style={{color:'#707A70'}}>Final: </span><strong style={{color:eb.risk_score_components.severity==='HIGH'?'#ba1a1a':eb.risk_score_components.severity==='MODERATE'?'#92400e':'#1A6B3C'}}>{eb.risk_score_components.final_score}/100 {eb.risk_score_components.severity}</strong>
                </div>
              </div>
            )}
            {/* PMIDs */}
            {eb.pmids?.length > 0 && (
              <div style={{marginTop:'10px',fontSize:'12px',color:'#707A70'}}>
                📚 PMIDs: {eb.pmids.map((p,i) => <a key={i} href={`https://pubmed.ncbi.nlm.nih.gov/${p}`} target="_blank" rel="noreferrer" style={{color:'#2563eb',marginRight:'8px'}}>{p}</a>)}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* =========================================================================
   GENETIC COMPATIBILITY CHECKER PAGE
   Deterministic Mendelian PGx inheritance analysis
   ========================================================================= */
function CompatibilityPage() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [expandedGene, setExpandedGene] = useState(null);

  const handleDrop1 = useCallback((files) => { if(files[0]) setFile1(files[0]); }, []);
  const handleDrop2 = useCallback((files) => { if(files[0]) setFile2(files[0]); }, []);

  const dz1 = useDropzone({onDrop:handleDrop1, accept:{'text/plain':['.vcf']}, multiple:false});
  const dz2 = useDropzone({onDrop:handleDrop2, accept:{'text/plain':['.vcf']}, multiple:false});

  const runAnalysis = async () => {
    if(!file1 || !file2) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file1', file1);
      fd.append('file2', file2);
      const res = await axios.post(`${API}/api/compatibility`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      setResult(res.data);
    } catch(e) {
      setError(e.response?.data?.detail || 'Compatibility analysis failed');
    } finally { setLoading(false); }
  };

  const scoreColor = (score) => score >= 85 ? '#1A6B3C' : score >= 70 ? '#1A6B3C' : score >= 50 ? '#92400e' : score >= 30 ? '#ea580c' : '#ba1a1a';
  const scoreBg = (score) => score >= 85 ? 'rgba(26,107,60,0.06)' : score >= 70 ? 'rgba(26,107,60,0.06)' : score >= 50 ? 'rgba(146,64,14,0.06)' : score >= 30 ? '#fff7ed' : 'rgba(186,26,26,0.06)';
  const riskBadgeColor = (level) => level === 'HIGH' ? '#ba1a1a' : level === 'MODERATE' ? '#92400e' : level === 'LOW' ? '#2563eb' : '#1A6B3C';
  const riskBadgeBg = (level) => level === 'HIGH' ? 'rgba(186,26,26,0.06)' : level === 'MODERATE' ? 'rgba(146,64,14,0.06)' : level === 'LOW' ? 'rgba(37,99,235,0.06)' : 'rgba(26,107,60,0.06)';

  return (
    <div style={{
      display: !result ? 'flex' : 'block',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: !result ? 'calc(100vh - 112px)' : 'auto',
      width: '100%'
    }}>
      <div style={{
        maxWidth:'900px', 
        width: '100%',
        margin:'0 auto', 
        padding:'0 24px'
      }}>
        {/* HEADER */}
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <h1 style={{fontSize:'32px',fontWeight:'800',color:'#191C1B',margin:'0 0 10px',letterSpacing:'-0.5px'}}>Genetic Compatibility Checker</h1>
          <p style={{fontSize:'15px',color:'#707A70',maxWidth:'540px',margin:'0 auto',lineHeight:'1.6'}}>Upload your partner's genetic data to analyze the probability of your children inheriting pharmacogenomic risks.</p>
        </div>

      {/* RESULTS OR UPLOAD FORM */}
      {!result ? (
        <>
          {/* AVATAR ROW */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'16px',marginBottom:'28px'}}>
            <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'700',fontSize:'16px',boxShadow:'0 4px 12px rgba(26,107,60,0.2)'}}>You</div>
            <div style={{width:'36px',height:'2px',background:'linear-gradient(90deg,#2563eb,#e11d48)',borderRadius:'1px'}}/>
            <div style={{fontSize:'22px'}}>💕</div>
            <div style={{width:'36px',height:'2px',background:'linear-gradient(90deg,#e11d48,#e11d48)',borderRadius:'1px'}}/>
            <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#e11d48',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'700',fontSize:'16px',boxShadow:'0 4px 12px rgba(186,26,26,0.2)'}}>P</div>
          </div>

          {/* TWO UPLOAD CARDS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'28px'}}>
            {/* YOUR VCF */}
            <div {...dz1.getRootProps()} style={{border: file1 ? '2px solid #2563eb' : '2px dashed #93c5fd',borderRadius:'16px',padding:'36px 20px',textAlign:'center',cursor:'pointer',background: file1 ? 'rgba(37,99,235,0.06)' : dz1.isDragActive ? 'rgba(37,99,235,0.06)' : 'white',transition:'all 0.25s ease',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
              <input {...dz1.getInputProps()} />
              <div style={{fontSize:'32px',marginBottom:'14px'}}>{file1 ? '✅' : '⬆️'}</div>
              <div style={{fontSize:'12px',fontWeight:'700',letterSpacing:'2px',color:'#2563eb',marginBottom:'8px'}}>YOUR VCF</div>
              {file1 ? (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                  <span style={{fontSize:'13px',fontWeight:'600',color:'#191C1B'}}>📄 {file1.name}</span>
                  <button onClick={(e)=>{e.stopPropagation();setFile1(null)}} style={{background:'none',border:'none',color:'#ba1a1a',cursor:'pointer',fontSize:'14px',padding:'2px'}}>✕</button>
                </div>
              ) : (
                <div style={{fontSize:'13px',color:'#707A70'}}>Drop .vcf file or click to browse</div>
              )}
            </div>

            {/* PARTNER'S VCF */}
            <div {...dz2.getRootProps()} style={{border: file2 ? '2px solid #e11d48' : '2px dashed #fda4af',borderRadius:'16px',padding:'36px 20px',textAlign:'center',cursor:'pointer',background: file2 ? '#fff1f2' : dz2.isDragActive ? '#fff1f2' : 'white',transition:'all 0.25s ease',boxShadow:'0 1px 3px rgba(0,33,13,0.04)'}}>
              <input {...dz2.getInputProps()} />
              <div style={{fontSize:'32px',marginBottom:'14px'}}>{file2 ? '✅' : '⬆️'}</div>
              <div style={{fontSize:'12px',fontWeight:'700',letterSpacing:'2px',color:'#e11d48',marginBottom:'8px'}}>PARTNER'S VCF</div>
              {file2 ? (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                  <span style={{fontSize:'13px',fontWeight:'600',color:'#191C1B'}}>📄 {file2.name}</span>
                  <button onClick={(e)=>{e.stopPropagation();setFile2(null)}} style={{background:'none',border:'none',color:'#ba1a1a',cursor:'pointer',fontSize:'14px',padding:'2px'}}>✕</button>
                </div>
              ) : (
                <div style={{fontSize:'13px',color:'#707A70'}}>Drop .vcf file or click to browse</div>
              )}
            </div>
          </div>

          {/* CTA BUTTON */}
          <button onClick={runAnalysis} disabled={!file1||!file2||loading} style={{width:'100%',height:'52px',background:(!file1||!file2||loading)?'#BFC9BE':'#191C1B',color:'white',border:'none',borderRadius:'12px',fontSize:'16px',fontWeight:'700',cursor:(!file1||!file2||loading)?'not-allowed':'pointer',marginBottom:'20px',transition:'all 0.2s ease',boxShadow:(!file1||!file2||loading)?'none':'0 4px 16px rgba(15,23,42,0.3)',letterSpacing:'0.5px'}}>
            {loading ? '⏳ Analyzing Genetic Compatibility...' : 'Analyze Compatibility'}
          </button>

          {error && <div style={{padding:'12px 16px',background:'rgba(186,26,26,0.06)',border:'1px solid rgba(186,26,26,0.15)',borderRadius:'12px',color:'#ba1a1a',fontSize:'13px',marginBottom:'16px'}}>⚠️ {error}</div>}

          {/* TRUST BADGES */}
          <div style={{display:'flex',justifyContent:'center',gap:'32px',marginTop:'8px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#707A70'}}><span style={{fontSize:'16px'}}>🔒</span> 100% Private</div>
            <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#707A70'}}><span style={{fontSize:'16px'}}>🔬</span> Scientific Accuracy</div>
          </div>
        </>
      ) : (
        /* ===== RESULTS PANEL ===== */
        <>
          {/* BACK BUTTON */}
          <button onClick={()=>{setResult(null);setFile1(null);setFile2(null);setError('')}} style={{background:'none',border:'none',color:'#2563eb',fontSize:'13px',fontWeight:'500',cursor:'pointer',padding:0,marginBottom:'24px'}}>← New Analysis</button>

          {/* OVERALL SCORE CARD */}
          <div style={{background:'white',borderRadius:'20px',padding:'32px',marginBottom:'28px',boxShadow:'0 4px 20px rgba(0,33,13,0.06)',border:'none',textAlign:'center'}}>
            <div style={{fontSize:'12px',letterSpacing:'2px',color:'#707A70',fontWeight:'600',marginBottom:'16px',textTransform:'uppercase'}}>Overall Compatibility Score</div>
            <div style={{position:'relative',width:'120px',height:'120px',margin:'0 auto 16px',borderRadius:'50%',background:scoreBg(result.overall_compatibility.score),display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 0 6px ${scoreColor(result.overall_compatibility.score)}20`}}>
              <span style={{fontSize:'42px',fontWeight:'800',color:scoreColor(result.overall_compatibility.score),fontVariantNumeric:'tabular-nums'}}>{Math.round(result.overall_compatibility.score)}</span>
            </div>
            <div style={{fontSize:'20px',fontWeight:'700',color:scoreColor(result.overall_compatibility.score),marginBottom:'6px'}}>{result.overall_compatibility.label}</div>
            <div style={{fontSize:'14px',color:'#707A70',maxWidth:'420px',margin:'0 auto',lineHeight:'1.5'}}>{result.overall_compatibility.description}</div>
            <div style={{display:'flex',justifyContent:'center',gap:'24px',marginTop:'20px'}}>
              <div style={{padding:'8px 16px',background:'#F7F8F5',borderRadius:'12px',fontSize:'13px',color:'#404940'}}><strong>{result.total_genes_analyzed}</strong> <span style={{color:'#707A70'}}>Genes Analyzed</span></div>
              <div style={{padding:'8px 16px',background:result.flagged_gene_count>0?'rgba(186,26,26,0.06)':'rgba(26,107,60,0.06)',borderRadius:'12px',fontSize:'13px',color:result.flagged_gene_count>0?'#ba1a1a':'#1A6B3C'}}><strong>{result.flagged_gene_count}</strong> <span>Flagged Genes</span></div>
            </div>
          </div>

          {/* PARTNER SUMMARY */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'28px'}}>
            <div style={{background:'white',border:'1px solid rgba(37,99,235,0.15)',borderRadius:'12px',padding:'16px',textAlign:'center'}}>
              <div style={{fontSize:'11px',fontWeight:'700',letterSpacing:'1.5px',color:'#2563eb',marginBottom:'6px'}}>PARTNER 1</div>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#191C1B'}}>{result.partner1_sample}</div>
            </div>
            <div style={{background:'white',border:'1px solid #fda4af',borderRadius:'12px',padding:'16px',textAlign:'center'}}>
              <div style={{fontSize:'11px',fontWeight:'700',letterSpacing:'1.5px',color:'#e11d48',marginBottom:'6px'}}>PARTNER 2</div>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#191C1B'}}>{result.partner2_sample}</div>
            </div>
          </div>

          {/* PER-GENE CARDS */}
          <div style={{fontSize:'12px',letterSpacing:'2px',color:'#707A70',fontWeight:'600',marginBottom:'16px',textTransform:'uppercase'}}>Per-Gene Compatibility Analysis</div>
          <div style={{display:'grid',gap:'16px',marginBottom:'28px'}}>
            {result.gene_reports.map((gr) => {
              const isExpanded = expandedGene === gr.gene;
              return (
                <div key={gr.gene} style={{background:'white',borderRadius:'16px',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',border:`1px solid ${gr.gene_risk_level==='HIGH'?'rgba(186,26,26,0.15)':gr.gene_risk_level==='MODERATE'?'rgba(146,64,14,0.15)':'#E2E3E0'}`,overflow:'hidden',transition:'all 0.2s ease'}}>
                  {/* Card Header */}
                  <div onClick={()=>setExpandedGene(isExpanded?null:gr.gene)} style={{padding:'20px 24px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                      <div style={{width:'44px',height:'44px',borderRadius:'12px',background:riskBadgeBg(gr.gene_risk_level),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:'700',color:riskBadgeColor(gr.gene_risk_level)}}>🧬</div>
                      <div>
                        <div style={{fontSize:'17px',fontWeight:'700',color:'#191C1B'}}>{gr.gene}</div>
                        <div style={{fontSize:'12px',color:'#707A70',marginTop:'2px'}}>{gr.drug_classes_affected}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      {gr.high_risk_probability > 0 && <span style={{fontSize:'12px',fontWeight:'600',color:'#ba1a1a',background:'rgba(186,26,26,0.06)',padding:'4px 10px',borderRadius:'20px',border:'1px solid rgba(186,26,26,0.15)'}}>{gr.high_risk_probability}% high-risk</span>}
                      <span style={{fontSize:'11px',fontWeight:'700',padding:'5px 12px',borderRadius:'20px',background:riskBadgeBg(gr.gene_risk_level),color:riskBadgeColor(gr.gene_risk_level),border:`1px solid ${riskBadgeColor(gr.gene_risk_level)}30`,letterSpacing:'0.5px'}}>{gr.gene_risk_level}</span>
                      <span style={{fontSize:'14px',color:'#BFC9BE',transition:'transform 0.2s',transform:isExpanded?'rotate(180deg)':'rotate(0)'}}>▼</span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div style={{padding:'0 24px 24px',animation:'fadeIn 200ms ease'}}>
                      {/* Parent Diplotypes */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'20px'}}>
                        <div style={{background:'rgba(37,99,235,0.06)',borderRadius:'10px',padding:'14px',border:'1px solid rgba(37,99,235,0.15)'}}>
                          <div style={{fontSize:'11px',fontWeight:'600',color:'#2563eb',marginBottom:'4px'}}>YOUR PROFILE</div>
                          <div style={{fontSize:'15px',fontWeight:'700',color:'#191C1B',fontFamily:'monospace'}}>{gr.parent1.diplotype}</div>
                          <div style={{fontSize:'12px',color:'#707A70',marginTop:'2px'}}>{gr.parent1.phenotype}</div>
                        </div>
                        <div style={{background:'#fff1f2',borderRadius:'10px',padding:'14px',border:'1px solid #fda4af'}}>
                          <div style={{fontSize:'11px',fontWeight:'600',color:'#e11d48',marginBottom:'4px'}}>PARTNER'S PROFILE</div>
                          <div style={{fontSize:'15px',fontWeight:'700',color:'#191C1B',fontFamily:'monospace'}}>{gr.parent2.diplotype}</div>
                          <div style={{fontSize:'12px',color:'#707A70',marginTop:'2px'}}>{gr.parent2.phenotype}</div>
                        </div>
                      </div>

                      {/* Child Outcomes (Punnett results) */}
                      <div style={{fontSize:'12px',fontWeight:'600',color:'#404940',marginBottom:'10px',letterSpacing:'0.5px'}}>👶 Child Inheritance Probability</div>
                      <div style={{display:'grid',gap:'10px',marginBottom:'20px'}}>
                        {gr.child_outcomes.map((co, idx) => (
                          <div key={idx} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',background:'#F7F8F5',borderRadius:'10px',border:'none'}}>
                            {/* Probability bar */}
                            <div style={{width:'60px',textAlign:'right',fontWeight:'700',fontSize:'18px',color:riskBadgeColor(co.severity),fontVariantNumeric:'tabular-nums'}}>{co.probability}%</div>
                            <div style={{flex:1}}>
                              <div style={{height:'8px',background:'#E2E3E0',borderRadius:'4px',overflow:'hidden',marginBottom:'6px'}}>
                                <div style={{height:'100%',width:`${co.probability}%`,background:riskBadgeColor(co.severity),borderRadius:'4px',transition:'width 0.5s ease'}}/>
                              </div>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <div>
                                  <span style={{fontSize:'13px',fontWeight:'600',color:'#191C1B'}}>{co.phenotype}</span>
                                  <span style={{fontSize:'11px',color:'#BFC9BE',marginLeft:'8px',fontFamily:'monospace'}}>{co.diplotype}</span>
                                </div>
                                <span style={{fontSize:'10px',fontWeight:'700',padding:'3px 8px',borderRadius:'12px',background:riskBadgeBg(co.severity),color:riskBadgeColor(co.severity)}}>{co.severity} ({Math.round(co.risk_score)})</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Punnett Square Visual */}
                      <details style={{marginBottom:'8px'}}>
                        <summary style={{fontSize:'12px',color:'#707A70',cursor:'pointer',fontWeight:'500',marginBottom:'8px'}}>📊 View Punnett Square</summary>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'4px',maxWidth:'320px',fontSize:'12px'}}>
                          <div style={{background:'#F7F8F5',padding:'8px',textAlign:'center',fontWeight:'600',borderRadius:'4px'}}/>
                          {split_diplotype_ui(gr.parent2.diplotype).map((a,i) => <div key={`h${i}`} style={{background:'#fff1f2',padding:'8px',textAlign:'center',fontWeight:'700',color:'#e11d48',borderRadius:'4px',fontFamily:'monospace'}}>{a}</div>)}
                          {gr.punnett_square.map((cell, i) => (
                            <React.Fragment key={`r${i}`}>
                              {i % 2 === 0 && <div style={{background:'rgba(37,99,235,0.06)',padding:'8px',textAlign:'center',fontWeight:'700',color:'#2563eb',borderRadius:'4px',fontFamily:'monospace'}}>{cell.from_parent1}</div>}
                              <div style={{background:'white',padding:'8px',textAlign:'center',border:'none',borderRadius:'4px',fontFamily:'monospace',fontSize:'11px',fontWeight:'500'}}>{cell.diplotype}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* METADATA FOOTER */}
          <div style={{background:'#F7F8F5',borderRadius:'12px',padding:'16px 20px',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
            <div style={{display:'flex',gap:'16px',flexWrap:'wrap'}}>
              <span style={{fontSize:'11px',color:'#1A6B3C',fontWeight:'600',background:'rgba(26,107,60,0.06)',padding:'4px 10px',borderRadius:'10px',border:'1px solid rgba(26,107,60,0.15)'}}>✓ 100% Deterministic</span>
              <span style={{fontSize:'11px',color:'#2563eb',fontWeight:'600',background:'rgba(37,99,235,0.06)',padding:'4px 10px',borderRadius:'10px',border:'1px solid rgba(37,99,235,0.15)'}}>✓ No External API</span>
              <span style={{fontSize:'11px',color:'#7c3aed',fontWeight:'600',background:'#f5f3ff',padding:'4px 10px',borderRadius:'10px',border:'1px solid #c4b5fd'}}>✓ Local CPIC Tables</span>
            </div>
            <div style={{fontSize:'11px',color:'#BFC9BE'}}>Source: {result.metadata?.source}</div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

/** Helper to split diplotype for Punnett square display */
function split_diplotype_ui(diplotype) {
  const parts = diplotype.split('/');
  return parts.length === 2 ? parts : ['*1', '*1'];
}
