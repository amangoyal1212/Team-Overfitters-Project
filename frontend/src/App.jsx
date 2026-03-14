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

  const runAnalysis = async () => {
    if(!selectedPatient)return;
    const drugs = selectedDrugs.length > 0 ? selectedDrugs.map(d=>d.toLowerCase()) : [selectedPatient.payload.prescribed_drug];
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
    const c=`GENEGUARD CLINICAL REPORT\nGenerated: ${new Date().toLocaleString('en-IN')}\n${'='.repeat(50)}\nPATIENT: ${r.patient_id}\nDRUG: ${r.drug}\nGENE: ${r.gene}\nALLELE: ${r.allele}\nPHENOTYPE: ${r.phenotype}\nRISK SCORE: ${r.risk_score}/100\nSEVERITY: ${r.severity}\n\nCPIC RECOMMENDATION:\n${r.cpic_recommendation||'See consultation text'}\n\nAI CLINICAL EXPLANATION:\n${r.llm_explanation||'Not available'}\n\nSAFER ALTERNATIVES:\n${(r.alternatives||[]).map(a=>`- ${a.drug}: ${a.reason}`).join('\n')||'None identified'}\n\n${'='.repeat(50)}\nSource: GeneGuard | CPIC 2023 | PharmGKB\n`;
    const b=new Blob([c],{type:'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`geneguard_${r.patient_id}_${r.drug}.txt`;a.click();URL.revokeObjectURL(u)
  };
  const handleCopy=()=>{const r=activeResult;if(r)navigator.clipboard.writeText(JSON.stringify(r,null,2))};

  return (
    <div style={{fontFamily:'Inter, system-ui, sans-serif',minHeight:'100vh',background:'#f8fafc'}}>
      <style>{`@keyframes pulse-red{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)}70%{box-shadow:0 0 0 12px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}.high-risk-pulse{animation:pulse-red 2s infinite}*{box-sizing:border-box}body{margin:0}`}</style>

      {showLanding && <LandingPage onGoLogin={()=>setShowLanding(false)} />}

      {!showLanding && !user && <AuthPage onAuth={saveAuth} onBack={()=>setShowLanding(true)} />}

      {!showLanding && user && (
        <div style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
          {/* NAVBAR */}
          <nav style={{height:'56px',background:'white',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',flexShrink:0}}>
            <div style={{fontSize:'18px',fontWeight:'700',color:'#0f172a'}}>🧬 GeneGuard</div>
            <div style={{display:'flex'}}>
              {['analysis','history', 'vcf history', 'drug database', 'safety matrix'].map(tab=>(
                <button key={tab} onClick={()=>setCurrentPage(tab)} style={{background:'none',border:'none',padding:'0 20px',height:'56px',fontSize:'14px',cursor:'pointer',color:currentPage===tab?'#16a34a':'#64748b',borderBottom:currentPage===tab?'2px solid #16a34a':'none',fontWeight:currentPage===tab?'500':'400',textTransform:'capitalize'}}>{tab}</button>
              ))}
            </div>
            <div className="gg-dropdown" style={{position:'relative'}}>
              <div onClick={e=>{e.stopPropagation();setShowDropdown(!showDropdown)}} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',padding:'4px 8px',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{width:'8px',height:'8px',background:'#16a34a',borderRadius:'50%'}}/><span style={{fontSize:'13px',color:'#0f172a',fontWeight:'500'}}>{user.full_name||'Doctor'}</span>
                <div style={{width:'28px',height:'28px',background:'#16a34a',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'600',fontSize:'13px'}}>{(user.full_name||'D').charAt(0).toUpperCase()}</div>
                <span style={{fontSize:'10px',color:'#64748b'}}>▼</span>
              </div>
              {showDropdown && (
                <div style={{position:'absolute',top:'42px',right:0,background:'white',border:'1px solid #e2e8f0',borderRadius:'8px',width:'200px',boxShadow:'0 4px 16px rgba(0,0,0,0.1)',zIndex:1000,overflow:'hidden'}}>
                  <div onClick={()=>{setCurrentPage('profile');setProfileName(user.full_name||'');setProfileSpec(user.specialization||'');setProfileHospital(user.hospital||'');setShowDropdown(false)}} style={{padding:'10px 16px',cursor:'pointer',fontSize:'13px',color:'#0f172a'}} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>👤 My Profile</div>
                  <div onClick={()=>{setCurrentPage('history');setShowDropdown(false)}} style={{padding:'10px 16px',cursor:'pointer',fontSize:'13px',color:'#0f172a'}} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>📊 History</div>
                  <div onClick={()=>{setCurrentPage('vcf history');setShowDropdown(false)}} style={{padding:'10px 16px',cursor:'pointer',fontSize:'13px',color:'#0f172a'}} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>🧬 VCF History</div>
                  <hr style={{margin:'4px 0',border:'none',borderTop:'1px solid #e2e8f0'}}/>
                  <div onClick={clearAuth} style={{padding:'10px 16px',cursor:'pointer',fontSize:'13px',color:'#dc2626'}} onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='white'}>🚪 Sign Out</div>
                </div>
              )}
            </div>
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

            {currentPage === 'analysis' && (
              <>
                <div style={{maxWidth: '1000px', margin: '0 auto'}}>
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
                <div className="dashboard-container">
                  <div className="dashboard-grid">
                    {/* LEFT COLUMN */}
                    <div className="dashboard-column">
                    {/* SECTION 1: Patient Selection & Drug Cards */}
                    <div className="dashboard-section">
                      <div style={{fontSize:'12px',letterSpacing:'2px',color:'#64748b',marginBottom:'16px',fontWeight:'600',textTransform:'uppercase'}}>SECTION 1: Patient & Medication</div>
                      <div style={{fontSize:'13px',fontWeight:'600',color:'#0f172a',marginBottom:'12px'}}>Select Patient Profile</div>
                      <div className="patient-cards">
                        {PATIENTS.map(p=>(
                          <div key={p.id} onClick={()=>{setSelectedPatient(p);setResult(null);setError('')}} style={{padding:'12px',border:selectedPatient?.id===p.id?'1px solid #16a34a':'1px solid #e2e8f0',borderRadius:'8px',cursor:'pointer',background:selectedPatient?.id===p.id?'#f0fdf4':'white',borderLeft:`4px solid ${stripeColor(p.stripe)}`}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                              <span style={{fontWeight:'600',fontSize:'13px',color:'#0f172a'}}>{p.id}</span>
                              <span style={{fontSize:'10px',fontWeight:'600',padding:'2px 6px',borderRadius:'4px',background:sevBg(p.risk),color:sevColor(p.risk),border:sevBorder(p.risk)}}>{p.risk}</span>
                            </div>
                            <div style={{fontSize:'12px',color:'#64748b'}}>💊 {p.drug}</div>
                            <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>{p.allele}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',margin:'20px 0 12px'}}>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'#0f172a'}}>Select Medication(s)</div>
                        {selectedDrugs.length > 0 && (
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{fontSize:'11px',fontWeight:'600',padding:'3px 8px',borderRadius:'12px',background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0'}}>{selectedDrugs.length} drug{selectedDrugs.length>1?'s':''} selected</span>
                            {selectedDrugs.length > 0 && <button onClick={()=>setSelectedDrugs([])} style={{fontSize:'11px',color:'#64748b',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Clear</button>}
                          </div>
                        )}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                        {DRUGS.map(d=>{
                          const isSelected = selectedDrugs.includes(d.name);
                          const atLimit = selectedDrugs.length >= 5 && !isSelected;
                          return (
                            <button key={d.name} onClick={()=>{ if(atLimit) return; setSelectedDrugs(p=>p.includes(d.name)?p.filter(x=>x!==d.name):[...p,d.name]); }} style={{padding:'10px 12px',borderRadius:'8px',fontSize:'12px',border:isSelected?'2px solid #16a34a':'1px solid #e5e7eb',background:isSelected?'#f0fdf4':'white',color:atLimit?'#cbd5e1':'#374151',cursor:atLimit?'not-allowed':'pointer',textAlign:'left',opacity:atLimit?0.5:1,position:'relative',boxShadow:isSelected?'0 2px 8px rgba(22,163,74,0.12)':'0 1px 3px rgba(0,0,0,0.04)',transition:'all 0.2s ease',transform:'translateY(0)'}}
                              onMouseEnter={e=>{if(!atLimit&&!isSelected){e.currentTarget.style.borderColor='#16a34a';e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-1px)'}}}
                              onMouseLeave={e=>{if(!isSelected){e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.transform='translateY(0)'}}}
                            >
                              {isSelected && <div style={{position:'absolute',top:'-6px',right:'-6px',width:'22px',height:'22px',borderRadius:'50%',background:'#16a34a',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',boxShadow:'0 2px 4px rgba(0,0,0,0.15)'}}>✓</div>}
                              <div style={{fontWeight:'600',color:isSelected?'#0f172a':'#1e293b',marginBottom:'2px'}}>{d.name}</div>
                              <div style={{fontSize:'11px',color:isSelected?'#16a34a':'#94a3b8',marginBottom:'4px'}}>{d.category || d.gene}</div>
                              <span style={{fontSize:'10px',padding:'2px 6px',borderRadius:'10px',background:isSelected?'#dcfce7':'#f1f5f9',color:isSelected?'#15803d':'#64748b'}}>{d.gene}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedDrugs.length > 3 && (
                        <div style={{marginTop:'8px',padding:'8px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'6px',color:'#92400e',fontSize:'12px',display:'flex',alignItems:'center',gap:'6px'}}>
                          <span>⚠️</span> Analyzing multiple drugs may take longer
                        </div>
                      )}

                      <button onClick={runAnalysis} disabled={!selectedPatient||loading} style={{width:'100%',height:'44px',marginTop:'20px',background:(!selectedPatient||loading)?'#86efac':'#16a34a',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:(!selectedPatient||loading)?'not-allowed':'pointer'}}>
                        {loading ? (loadingProgress || 'Analyzing...') : `Run Genetic Analysis${selectedDrugs.length > 1 ? ` (${selectedDrugs.length} drugs)` : ''}`}
                      </button>
                      {error && <div style={{marginTop:'12px',padding:'10px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'6px',color:'#dc2626',fontSize:'13px'}}>{error}</div>}
                    </div>

                    {/* SECTION 2: VCF Upload Dropzone */}
                    <div className="dashboard-section">
                      <div style={{fontSize:'12px',letterSpacing:'2px',color:'#64748b',marginBottom:'16px',fontWeight:'600',textTransform:'uppercase'}}>SECTION 2: Upload Files</div>
                      <div {...getRootProps()} style={{border:isDragActive?'2px dashed #16a34a':'2px dashed #d1d5db',borderRadius:'10px',padding:'32px 20px',textAlign:'center',cursor:'pointer',background:isDragActive?'#f0fdf4':'#f8fafc'}}>
                        <input {...getInputProps()} />
                        <div style={{fontSize:'32px',marginBottom:'12px'}}>⬆️</div>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0f172a',marginBottom:'4px'}}>Drop JSON or VCF file here</div>
                        <div style={{fontSize:'13px',color:'#64748b',marginBottom:'12px'}}>or click to browse from your computer</div>
                        <div style={{display:'flex',gap:'8px',justifyContent:'center'}}>{['.json','.vcf'].map(e=><span key={e} style={{background:'white',border:'1px solid #e2e8f0',color:'#374151',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>{e}</span>)}</div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="dashboard-column">
                    {/* SECTION 3: Camera Scan */}
                    <div className="dashboard-section">
                      <div style={{fontSize:'12px',letterSpacing:'2px',color:'#64748b',marginBottom:'16px',fontWeight:'600',textTransform:'uppercase'}}>SECTION 3: Camera Scan</div>
                      <InlineCameraScan 
                        selectedPatient={selectedPatient} 
                        onResult={(r,t)=>{setResult(r);setResponseTime(t)}} 
                        onCount={bumpCount}
                      />
                    </div>

                    {/* SECTION 4: Quick Stats */}
                    <div className="dashboard-section">
                      <div style={{fontSize:'12px',letterSpacing:'2px',color:'#64748b',marginBottom:'16px',fontWeight:'600',textTransform:'uppercase'}}>SECTION 4: Quick Stats</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                        <div style={{padding:'16px',background:'white',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'box-shadow 0.3s ease'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
                          <div style={{fontSize:'24px',marginBottom:'8px'}}>📊</div>
                          <div style={{fontSize:'24px',fontWeight:'700',color:'#16a34a'}}>{analysisCount}</div>
                          <div style={{fontSize:'13px',color:'#64748b',fontWeight:'500'}}>Total Analyses</div>
                        </div>
                        <div style={{padding:'16px',background:'white',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'box-shadow 0.3s ease'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
                          <div style={{fontSize:'24px',marginBottom:'8px'}}>⚡</div>
                          <div style={{fontSize:'24px',fontWeight:'700',color:'#0f172a'}}>{responseTime ? `${responseTime}s` : '--'}</div>
                          <div style={{fontSize:'13px',color:'#64748b',fontWeight:'500'}}>Avg Answer Time</div>
                        </div>
                        <div style={{padding:'16px',background:'white',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'box-shadow 0.3s ease'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
                          <div style={{fontSize:'24px',marginBottom:'8px'}}>🧬</div>
                          <div style={{fontSize:'24px',fontWeight:'700',color:'#0f172a'}}>{history.filter(h=>h.is_vcf).length}</div>
                          <div style={{fontSize:'13px',color:'#64748b',fontWeight:'500'}}>VCF Uploads</div>
                        </div>
                        <div style={{padding:'16px',background:'white',borderRadius:'12px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'box-shadow 0.3s ease'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
                          <div style={{fontSize:'24px',marginBottom:'8px'}}>🕒</div>
                          <div style={{fontSize:'15px',fontWeight:'600',color:'#0f172a',marginTop:'8px'}}>{history.length > 0 ? history[0].date : 'Never'}</div>
                          <div style={{fontSize:'13px',color:'#64748b',fontWeight:'500'}}>Last Analysis</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis Overlay Modal */}
                {(result || multiResults.length > 0) && (
                  <div className="modal-backdrop" style={{zIndex:50,padding:'24px',animation:'fadeIn 200ms ease both'}}>
                    <div style={{position:'absolute',inset:0}} onClick={()=>{setResult(null);setMultiResults([]);setResponseTime(null);setShowComparison(false)}}/>
                    <div style={{position:'relative',background:'white',width:'100%',maxWidth:'1080px',maxHeight:'90vh',borderRadius:'16px',boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04)',display:'flex',flexDirection:'column',overflow:'hidden',animation:'fadeInUp 200ms ease both'}}>
                      <div style={{padding:'16px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8fafc'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                          <span style={{fontSize:'18px',fontWeight:'700',color:'#0f172a'}}>Analysis Results</span>
                          {multiResults.length > 1 && <span style={{fontSize:'12px',fontWeight:'500',padding:'3px 8px',borderRadius:'12px',background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe'}}>{multiResults.filter(r=>!r.error).length} of {multiResults.length} drugs</span>}
                          {responseTime&&<span style={{fontSize:'13px',color:'#16a34a',fontWeight:'500',background:'#f0fdf4',padding:'4px 10px',borderRadius:'12px',border:'1px solid #bbf7d0'}}>⚡ {responseTime}s</span>}
                        </div>
                        <div style={{display:'flex',gap:'8px'}}>
                          {multiResults.filter(r=>!r.error).length >= 2 && (
                            <button onClick={()=>setShowComparison(!showComparison)} style={{background:showComparison?'#16a34a':'white',color:showComparison?'white':'#374151',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px 12px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>
                              {showComparison ? '← Tabbed View' : '⚖️ Compare Drugs'}
                            </button>
                          )}
                          <button onClick={()=>{setResult(null);setMultiResults([]);setResponseTime(null);setShowComparison(false)}} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px 12px',fontSize:'13px',fontWeight:'500',color:'#64748b',cursor:'pointer'}}>Close</button>
                        </div>
                      </div>

                      {/* Multi-drug tab bar */}
                      {multiResults.length > 1 && !showComparison && (
                        <div style={{display:'flex',borderBottom:'1px solid #e2e8f0',background:'white',overflowX:'auto',flexShrink:0}}>
                          {multiResults.map((r, i) => {
                            const isActive = activeResultTab === i;
                            const hasError = !!r.error;
                            const sc = hasError ? '#94a3b8' : sevColor(r.severity);
                            return (
                              <button key={i} onClick={()=>{setActiveResultTab(i);if(!hasError)setResult(r)}} style={{padding:'10px 18px',fontSize:'13px',fontWeight:isActive?'600':'400',color:isActive?sc:'#64748b',background:isActive?'white':'#f8fafc',border:'none',borderBottom:isActive?`2px solid ${sc}`:'2px solid transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',whiteSpace:'nowrap',textTransform:'capitalize',flexShrink:0}}>
                                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:hasError?'#94a3b8':sc,display:'inline-block',flexShrink:0}}></span>
                                {r.drug}
                                {!hasError && <span style={{fontSize:'11px',fontWeight:'600',color:sc}}>({Math.round(r.risk_score)})</span>}
                                {hasError && <span style={{fontSize:'11px',color:'#dc2626'}}>⚠️</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div style={{flex:1,overflowY:'auto',paddingBottom:'24px'}}>
                        {showComparison ? (
                          <DrugComparisonTable results={multiResults.filter(r=>!r.error)} />
                        ) : (
                          (() => {
                            const currentResult = multiResults.length > 0 ? multiResults[activeResultTab] : result;
                            if (currentResult?.error) {
                              return (
                                <div className="tab-fade-in" style={{padding:'40px 24px',textAlign:'center'}}>
                                  <div style={{fontSize:'40px',marginBottom:'16px'}}>⚠️</div>
                                  <div style={{fontSize:'16px',fontWeight:'600',color:'#dc2626',marginBottom:'8px'}}>Analysis Failed for {currentResult.drug}</div>
                                  <div style={{fontSize:'14px',color:'#64748b'}}>{currentResult.error}</div>
                                </div>
                              );
                            }
                            return currentResult ? (
                              <div className="tab-fade-in" key={activeResultTab}>
                                <AnalysisPage result={currentResult} loading={loading} error={error} responseTime={responseTime} analysisCount={analysisCount} showJsonModal={showJsonModal} setShowJsonModal={setShowJsonModal} handleExport={handleExport} handleCopy={handleCopy} selectedPatient={selectedPatient} simulateModal={simulateModal} setSimulateModal={setSimulateModal} simulateLoading={simulateLoading} setSimulateLoading={setSimulateLoading}/>
                              </div>
                            ) : null;
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {showJsonModal && result && (
        <div className="modal-backdrop" onClick={()=>setShowJsonModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white',borderRadius:'12px',width:'100%',maxWidth:'680px',maxHeight:'80vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',animation:'fadeInUp 200ms ease both'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <span style={{fontSize:'16px',fontWeight:'600',color:'#0f172a'}}>{'Raw Analysis Data { }'}</span>
              <button onClick={()=>setShowJsonModal(false)} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#64748b'}}>✕</button>
            </div>
            <div style={{padding:'20px',overflowY:'auto'}}>
              <pre style={{background:'#0f172a',color:'#4ade80',borderRadius:'8px',padding:'16px',fontSize:'12px',fontFamily:'monospace',overflowX:'auto',margin:0}}>{JSON.stringify(result,null,2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE MODAL */}
      {simulateModal && (
        <div className="modal-backdrop" onClick={()=>setSimulateModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'480px',padding:'28px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',animation:'fadeInUp 200ms ease both'}}>
            <div style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'20px'}}>Simulated: <span style={{textTransform:'capitalize'}}>{simulateModal.name}</span></div>
            {simulateModal.simResult ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
                  <div style={{width:'52px',height:'52px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'18px',background:simulateModal.simResult.risk_score>=75?'#fef2f2':simulateModal.simResult.risk_score>=45?'#fffbeb':'#f0fdf4',color:simulateModal.simResult.risk_score>=75?'#dc2626':simulateModal.simResult.risk_score>=45?'#d97706':'#16a34a'}}>
                    {Math.round(simulateModal.simResult.risk_score)}
                  </div>
                  <div>
                    <div style={{fontWeight:'600',color:'#0f172a'}}>{simulateModal.simResult.severity} <span style={{fontSize:'13px',color:'#64748b',fontWeight:'400'}}>Risk</span></div>
                    <div style={{fontSize:'13px',color:'#64748b'}}>{simulateModal.simResult.gene} · {simulateModal.simResult.phenotype}</div>
                  </div>
                </div>
                <div style={{background:'#f8fafc',borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>Current</div>
                      <div style={{fontSize:'20px',fontWeight:'700',color:'#dc2626'}}>{simulateModal.currentRisk || '?'}</div>
                      <div style={{fontSize:'12px',color:'#64748b',textTransform:'capitalize'}}>{simulateModal.currentDrug}</div>
                    </div>
                    <div style={{fontSize:'24px',color:'#16a34a',fontWeight:'700'}}>→</div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>Alternative</div>
                      <div style={{fontSize:'20px',fontWeight:'700',color:'#16a34a'}}>{Math.round(simulateModal.simResult.risk_score)}</div>
                      <div style={{fontSize:'12px',color:'#64748b',textTransform:'capitalize'}}>{simulateModal.name}</div>
                    </div>
                  </div>
                  {simulateModal.currentRisk && simulateModal.simResult.risk_score < simulateModal.currentRisk && (
                    <div style={{textAlign:'center',marginTop:'12px',fontSize:'16px',fontWeight:'700',color:'#16a34a'}}>↓ {Math.round(simulateModal.currentRisk - simulateModal.simResult.risk_score)} points safer</div>
                  )}
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>setSimulateModal(null)} style={{flex:1,padding:'10px',border:'1px solid #e2e8f0',borderRadius:'8px',background:'white',color:'#374151',fontSize:'14px',fontWeight:'500'}}>Close</button>
                  <button onClick={()=>{setSelectedDrugs(p=>p.includes(simulateModal.name)?p:[...p.filter(x=>x.toLowerCase()!==simulateModal.currentDrug?.toLowerCase()),simulateModal.name]);setSimulateModal(null)}} style={{flex:1,padding:'10px',border:'none',borderRadius:'8px',background:'#16a34a',color:'white',fontSize:'14px',fontWeight:'500'}}>Use This Drug</button>
                </div>
              </>
            ) : (
              <div style={{textAlign:'center',padding:'24px'}}>
                <div className="skeleton-pulse" style={{width:'60px',height:'60px',borderRadius:'50%',margin:'0 auto 16px'}}/>
                <div style={{fontSize:'14px',color:'#64748b'}}>Simulating analysis...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InlineCameraScan({ selectedPatient, onResult, onCount }) {
  const [mode, setMode] = useState('idle'); // idle, camera, analyzing
  const [scanResult, setScanResult] = useState('');
  const [error, setError] = useState('');
  const [stream, setStream] = useState(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  const startCamera = async () => {
    try {
      setMode('camera');
      setError(''); setScanResult('');
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }});
      setStream(s);
    } catch { setError('Camera access denied or unavailable'); setMode('idle'); }
  };

  const stopCamera = () => { if(stream){stream.getTracks().forEach(t=>t.stop());setStream(null);} };

  // Bind stream to video element when stream or mode changes
  React.useEffect(() => {
    if (!stream || mode !== 'camera') return;
    const bindVideo = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    };
    // Try immediately, then retry after a short delay in case ref isn't ready
    bindVideo();
    const t = setTimeout(bindVideo, 100);
    return () => clearTimeout(t);
  }, [stream, mode]);

  // Cleanup on unmount
  React.useEffect(() => { return () => { if(stream) stream.getTracks().forEach(t=>t.stop()); }; }, [stream]);

  const analyze = async (blob) => {
    setMode('analyzing'); setError(''); setScanResult('');
    try {
      const fd = new FormData(); fd.append('file', blob, 'medicine.jpg');
      const gene = selectedPatient?.payload?.allele_calls ? Object.keys(selectedPatient.payload.allele_calls)[0] : 'CYP2D6';
      const allele = selectedPatient?.payload?.allele_calls?.[gene] || '*4/*4';
      const start = performance.now();
      const res = await axios.post(`${API}/api/analyze/image?patient_gene=${gene}&patient_allele=${allele}`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      const elapsed = ((performance.now()-start)/1000).toFixed(1);
      
      if (!res.data.success) throw new Error(res.data.error||'Scan failed');
      
      setScanResult(`✓ Drug detected: ${res.data.mapped_drug} (Analyzing with ${gene} ${allele}...)`);
      
      setTimeout(() => {
        onResult({
          patient_id: selectedPatient?.id||'SCAN', drug:res.data.mapped_drug, gene:res.data.gene,
          allele:res.data.allele, phenotype:res.data.phenotype, risk_score:res.data.risk_score,
          severity:res.data.severity, recommendation:res.data.recommendation,
          llm_explanation:res.data.llm_explanation, alternatives:res.data.alternatives||[],
          cpic_recommendation:res.data.cpic_recommendation, consultation_text:res.data.consultation_text,
          ehr_priority:res.data.ehr_priority, activity_score:res.data.activity_score,
          is_camera_scan:true, scanned_drug:res.data.scanned_drug, brand_name:res.data.brand_name
        }, elapsed);
        onCount();
        setMode('idle');
      }, 1500);

    } catch(e) { 
      setError(e.response?.data?.detail||e.message||'Scan failed'); 
      setMode('idle');
    }
  };

  const capture = () => {
    if(!videoRef.current||!canvasRef.current)return;
    const v=videoRef.current, c=canvasRef.current;
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext('2d').drawImage(v,0,0);
    c.toBlob(b=>{stopCamera();analyze(b);},'image/jpeg',0.9);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) analyze(file);
  };

  return (
    <div>
      <div style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',display:'flex',alignItems:'center',gap:'12px'}}>
        📷 Quick Medicine Scan
      </div>
      <div style={{fontSize:'14px',color:'#64748b',margin:'8px 0 20px'}}>
        Scan prescription or medicine strip using your camera or upload a photo to auto-detect drugs.
      </div>

      {mode === 'idle' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
          <button onClick={startCamera} style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',height:'120px',background:'#16a34a',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',transition:'opacity 0.2s'}}>
            <span style={{fontSize:'32px'}}>📷</span>
            <span style={{fontSize:'15px',fontWeight:'600'}}>Open Camera</span>
          </button>
          
          <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',height:'120px',background:'white',color:'#16a34a',border:'2px solid #16a34a',borderRadius:'8px',cursor:'pointer',transition:'background 0.2s'}}>
            <span style={{fontSize:'32px'}}>📁</span>
            <span style={{fontSize:'15px',fontWeight:'600'}}>Upload Photo</span>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={handleFileUpload}/>
          </label>
        </div>
      )}

      {mode === 'camera' && (
        <div style={{border:'1px solid #e2e8f0',borderRadius:'8px',overflow:'hidden',background:'#0f172a'}}>
          <div style={{position:'relative'}}>
            <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'300px',objectFit:'cover',display:'block'}}/>
            <div style={{position:'absolute',bottom:'12px',left:0,right:0,textAlign:'center',color:'white',fontSize:'13px',fontWeight:'500',background:'rgba(0,0,0,0.6)',padding:'8px',backdropFilter:'blur(4px)'}}>Point at medicine label or pill strip</div>
          </div>
          <canvas ref={canvasRef} style={{display:'none'}}/>
          <div style={{padding:'16px',background:'white',display:'flex',gap:'12px'}}>
            <button onClick={capture} style={{flex:1,height:'44px',background:'#16a34a',color:'white',border:'none',borderRadius:'6px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>📸 Capture Photo</button>
            <button onClick={()=>{stopCamera();setMode('idle')}} style={{height:'44px',padding:'0 20px',background:'#f1f5f9',color:'#374151',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'analyzing' && (
        <div style={{border:'1px solid #e2e8f0',borderRadius:'8px',background:'#f8fafc',padding:'40px 24px',textAlign:'center'}}>
          <div style={{fontSize:'40px',marginBottom:'16px'}}>🧬</div>
          <div style={{fontSize:'16px',fontWeight:'600',color:'#0f172a',marginBottom:'8px'}}>Analyzing with Gemini Vision...</div>
          <div style={{fontSize:'13px',color:'#64748b',marginBottom:'24px'}}>Extracting text and identifying medication</div>
          
          {scanResult ? (
            <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#15803d',padding:'12px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:'500'}}>
              {scanResult}
            </div>
          ) : (
            <div style={{height:'6px',background:'#e2e8f0',borderRadius:'3px',overflow:'hidden',maxWidth:'200px',margin:'0 auto'}}>
              <div style={{height:'100%',background:'#16a34a',width:'70%',borderRadius:'3px',animation:'pulse 1.5s infinite ease-in-out'}}/>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{marginTop:'16px',padding:'12px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#dc2626',fontSize:'13px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span>⚠️</span> {error}
        </div>
      )}
    </div>
  );
}

function ProfilePage({user,token,saveAuth,clearAuth,setCurrentPage,profileName,setProfileName,profileSpec,setProfileSpec,profileHospital,setProfileHospital,profileSuccess,setProfileSuccess}) {
  return (
    <div style={{maxWidth:'560px',margin:'0 auto',padding:'32px 24px'}}>
      <button onClick={()=>setCurrentPage('analysis')} style={{background:'none',border:'none',color:'#16a34a',fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'24px'}}>← Back to Analysis</button>
      <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'24px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'16px'}}>
        <div style={{width:'72px',height:'72px',background:'#16a34a',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'28px',fontWeight:'700'}}>{(user.full_name||'D').charAt(0).toUpperCase()}</div>
        <div><div style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',marginBottom:'4px'}}>{user.full_name}</div><div style={{fontSize:'14px',color:'#64748b'}}>{user.email}</div>{user.specialization&&<span style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>{user.specialization}</span>}</div>
      </div>
      <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'24px',marginBottom:'16px'}}>
        <h3 style={{fontSize:'16px',fontWeight:'600',color:'#0f172a',margin:'0 0 20px'}}>Edit Profile</h3>
        {profileSuccess&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'6px',padding:'10px 14px',color:'#16a34a',fontSize:'13px',marginBottom:'16px'}}>✅ Profile updated successfully</div>}
        {[{l:'FULL NAME',v:profileName,s:setProfileName},{l:'SPECIALIZATION',v:profileSpec,s:setProfileSpec},{l:'HOSPITAL',v:profileHospital,s:setProfileHospital}].map(f=><div key={f.l} style={{marginBottom:'14px'}}><label style={labelStyle}>{f.l}</label><input type="text" value={f.v} onChange={e=>f.s(e.target.value)} style={inputStyle}/></div>)}
        <button onClick={async()=>{try{const res=await axios.put(`${API}/api/auth/profile`,{full_name:profileName,specialization:profileSpec,hospital:profileHospital,phone:''},{headers:{Authorization:`Bearer ${token}`}});saveAuth(res.data.user,token);setProfileSuccess(true);setTimeout(()=>setProfileSuccess(false),3000)}catch(e){console.error(e)}}} style={{width:'100%',height:'40px',background:'#16a34a',color:'white',border:'none',borderRadius:'6px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Save Changes</button>
      </div>
      <div style={{background:'white',border:'1px solid #fecaca',borderRadius:'12px',padding:'24px'}}>
        <h3 style={{fontSize:'14px',fontWeight:'600',color:'#0f172a',margin:'0 0 8px'}}>Sign Out</h3>
        <p style={{fontSize:'13px',color:'#64748b',margin:'0 0 16px'}}>You will be signed out on this device.</p>
        <button onClick={clearAuth} style={{width:'100%',height:'40px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:'6px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Sign Out</button>
      </div>
    </div>
  );
}

function HistoryPage({history}) {
  return (
    <div style={{padding:'24px'}}>
      <h2 style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',marginBottom:'20px'}}>Analysis History</h2>
      {history.length===0 ? <div style={{textAlign:'center',padding:'60px',color:'#64748b'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>📊</div><div style={{fontSize:'16px'}}>No analyses yet</div></div> : (
        <div style={{display:'grid',gap:'12px'}}>
          {history.map(h=>(
            <div key={h.id} className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div>
                <div style={{fontWeight:'600',color:'#0f172a',marginBottom:'4px',display:'flex',alignItems:'center',gap:'8px'}}>
                  {h.patient_id} — <span style={{textTransform:'capitalize'}}>{h.drug}</span>
                  {h.is_multi && <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 6px',borderRadius:'10px',background:'#eff6ff',color:'#2563eb'}}>{h.drugs_count} drugs</span>}
                </div>
                <div style={{fontSize:'12px',color:'#64748b'}}>
                  {h.date} · {h.gene} · {h.phenotype}
                  {h.is_multi && h.drugs_list && <span style={{marginLeft:'6px',color:'#94a3b8'}}>({h.drugs_list.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')})</span>}
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

  if (loading) return <div style={{padding:'24px',color:'#64748b'}}>Loading VCF history...</div>;
  if (error) return <div style={{padding:'24px',color:'#dc2626'}}>{error}</div>;

  return (
    <div style={{padding:'24px'}}>
      <h2 style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',marginBottom:'20px'}}>VCF Upload History</h2>
      {vcfHistory.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px',color:'#64748b'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>🧬</div>
          <div style={{fontSize:'16px'}}>No VCF uploads yet</div>
        </div>
      ) : (
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead>
              <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#64748b'}}>Date</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#64748b'}}>Filename</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#64748b'}}>Patient ID</th>
                <th style={{padding:'12px 16px',fontSize:'13px',fontWeight:'600',color:'#64748b'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vcfHistory.map((h, i) => (
                <tr key={h.vcf_id} style={{borderBottom:i<vcfHistory.length-1?'1px solid #e2e8f0':'none'}}>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#0f172a'}}>{new Date(h.date).toLocaleString('en-IN')}</td>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#2563eb',fontWeight:'500'}}>{h.filename}</td>
                  <td style={{padding:'12px 16px',fontSize:'14px',color:'#0f172a'}}>{h.patient_id}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{
                      background: h.status === 'analyzed' ? '#f0fdf4' : h.status === 'failed' ? '#fef2f2' : '#eff6ff',
                      color: h.status === 'analyzed' ? '#16a34a' : h.status === 'failed' ? '#dc2626' : '#2563eb',
                      border: `1px solid ${h.status === 'analyzed' ? '#bbf7d0' : h.status === 'failed' ? '#fecaca' : '#bfdbfe'}`,
                      padding:'4px 8px', borderRadius:'6px', fontSize:'12px', fontWeight:'500', textTransform:'capitalize'
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
        <span style={{ position: 'absolute', left: '16px', fontSize: '18px', color: '#64748b' }}>🔍</span>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search drug (e.g., aspirin, metoprolol)..."
          style={{ width: '100%', padding: '16px 48px', fontSize: '16px', border: '1px solid #cbd5e1', borderRadius: '12px', outline: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
        />
        {loading && <span style={{ position: 'absolute', right: '16px', fontSize: '14px', color: '#64748b', animation: 'spin 1s linear infinite' }}>⏳</span>}
      </div>

      {isFocused && query && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100 }}>
          {results.length > 0 ? results.map((d, i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', textTransform: 'capitalize' }}>💊 {d.drug_name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{d.therapeutic_class} · {d.gene}</div>
                  {d.matched_term && d.matched_term.toLowerCase() !== d.drug_name.toLowerCase() && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>Matches "{d.matched_term}"</div>
                  )}
                </div>
                
                {d.preview ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginBottom: '4px',
                      background: d.preview.risk_preview === 'HIGH' ? '#fef2f2' : d.preview.risk_preview === 'MODERATE' ? '#fffbeb' : '#f0fdf4',
                      color: d.preview.risk_preview === 'HIGH' ? '#dc2626' : d.preview.risk_preview === 'MODERATE' ? '#d97706' : '#16a34a',
                      border: `1px solid ${d.preview.risk_preview === 'HIGH' ? '#fecaca' : d.preview.risk_preview === 'MODERATE' ? '#fde68a' : '#bbf7d0'}`
                    }}>
                      {d.preview.risk_preview === 'UNKNOWN' ? '❔ Check genotype' : d.preview.risk_preview === 'HIGH' ? '⚠️ High Risk' : d.preview.risk_preview === 'MODERATE' ? '⚠️ Moderate Risk' : '✓ Standard Precautions'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '180px' }}>{d.preview.message}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'right', fontStyle: 'italic' }}>
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
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}
                >
                  Select & Analyze
                </button>
              </div>
            </div>
          )) : !loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>No medicines found for "{query}"</div>
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

  if (loading) return <div style={{padding:'24px',color:'#64748b'}}>Loading Drug Database...</div>;

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <h2 style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',margin:0,display:'flex',alignItems:'center',gap:'8px'}}>
          <span>💊</span> Drug Database
        </h2>
        <button onClick={exportCsv} style={{background:'white',border:'1px solid #e2e8f0',padding:'8px 16px',borderRadius:'6px',fontSize:'13px',fontWeight:'500',color:'#374151',cursor:'pointer'}}>📥 Export CSV</button>
      </div>

      <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'8px',overflow:'hidden'}}>
        <div style={{padding:'16px',borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
          <input 
            type="text" 
            placeholder="Search by drug, gene, or class..." 
            value={searchTerm}
            onChange={(e)=>setSearchTerm(e.target.value)}
            style={{width:'100%',maxWidth:'400px',padding:'10px 14px',border:'1px solid #cbd5e1',borderRadius:'6px',fontSize:'14px',outline:'none'}}
          />
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            <tr>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#64748b',textTransform:'uppercase'}}>Drug Name</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#64748b',textTransform:'uppercase'}}>Relevant Gene</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#64748b',textTransform:'uppercase'}}>Therapeutic Class</th>
              <th style={{padding:'12px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#64748b',textTransform:'uppercase'}}>Evidence Level</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={i} style={{borderBottom:'1px solid #e2e8f0'}}>
                <td style={{padding:'12px 16px',fontSize:'14px',fontWeight:'500',color:'#0f172a',textTransform:'capitalize'}}>{d.drug_name}</td>
                <td style={{padding:'12px 16px',fontSize:'13px',color:'#374151',fontFamily:'monospace'}}>{d.gene}</td>
                <td style={{padding:'12px 16px',fontSize:'13px',color:'#64748b'}}>{d.therapeutic_class}</td>
                <td style={{padding:'12px 16px',fontSize:'13px'}}>
                  <span style={{padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'600',background:d.evidence_level.includes('High')?'#dcfce7':'#f1f5f9',color:d.evidence_level.includes('High')?'#16a34a':'#64748b'}}>
                    {d.evidence_level}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="4" style={{padding:'32px',textAlign:'center',color:'#64748b',fontSize:'14px'}}>No drugs match your search.</td></tr>
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
    if (!items || items.length === 0) return <span style={{fontSize:'12px',color:'#94a3b8',fontStyle:'italic'}}>—</span>;
    return items.map((item, i) => (
      <span key={i} style={{display:'inline-block',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'500',margin:'2px 3px',background:bg,color:color,border:`1px solid ${border}`,textTransform:'capitalize',whiteSpace:'nowrap'}}>{item}</span>
    ));
  };

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div>
          <h2 style={{fontSize:'20px',fontWeight:'700',color:'#0f172a',margin:'0 0 4px',display:'flex',alignItems:'center',gap:'8px'}}>
            <span>🧬</span> Gene-Drug Safety Matrix
          </h2>
          <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Color-coded guide: which medicines are safe, cautionary, or should be avoided per genotype</p>
        </div>
        <input
          type="text"
          placeholder="Search drug or gene..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{padding:'10px 16px',border:'1px solid #cbd5e1',borderRadius:'8px',fontSize:'14px',outline:'none',width:'260px',background:'#f8fafc'}}
        />
      </div>

      <div style={{display:'flex',gap:'12px',marginBottom:'20px',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#64748b'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#dcfce7',border:'1px solid #bbf7d0'}}></span> Safe
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#64748b'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#fef3c7',border:'1px solid #fde68a'}}></span> Caution
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#64748b'}}>
          <span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',background:'#fef2f2',border:'1px solid #fecaca'}}></span> Avoid
        </div>
      </div>

      <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'800px'}}>
          <thead>
            <tr style={{background:'#f8fafc'}}>
              <th style={{padding:'14px 16px',textAlign:'left',fontSize:'12px',fontWeight:'600',color:'#64748b',letterSpacing:'0.5px',borderBottom:'2px solid #e2e8f0',position:'sticky',left:0,background:'#f8fafc',zIndex:1}}>PHENOTYPE</th>
              {genes.map(gene => (
                <th key={gene} style={{padding:'14px 16px',textAlign:'center',fontSize:'12px',fontWeight:'700',color: geneMatchesSearch(gene) && search ? '#16a34a' : '#0f172a',letterSpacing:'0.5px',borderBottom:'2px solid #e2e8f0',borderLeft:'1px solid #e2e8f0',minWidth:'140px'}}>
                  <div style={{fontSize:'14px'}}>⚡ {gene}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPhenotypes.map((phenotype, pi) => (
              <tr key={phenotype} style={{borderBottom:'1px solid #e2e8f0'}} onMouseEnter={e => e.currentTarget.style.background='#fafbfc'} onMouseLeave={e => e.currentTarget.style.background='white'}>
                <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#374151',position:'sticky',left:0,background:'inherit',zIndex:1,borderRight:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{phenotype}</td>
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
                        borderLeft:'1px solid #e2e8f0',
                        verticalAlign:'top',
                        background: highlighted ? '#f0fdf4' : 'inherit',
                        transition:'background 0.15s',
                        position:'relative',
                        cursor: data ? 'default' : 'default'
                      }}
                    >
                      {data ? (
                        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                          {data.safe.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.safe, '#15803d', '#dcfce7', '#bbf7d0')}</div>}
                          {data.caution.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.caution, '#92400e', '#fef3c7', '#fde68a')}</div>}
                          {data.avoid.length > 0 && <div style={{display:'flex',flexWrap:'wrap',gap:'2px'}}>{renderPills(data.avoid, '#991b1b', '#fef2f2', '#fecaca')}</div>}
                          {data.safe.length === 0 && data.caution.length === 0 && data.avoid.length === 0 && (
                            <span style={{fontSize:'12px',color:'#94a3b8',fontStyle:'italic'}}>No data</span>
                          )}
                        </div>
                      ) : (
                        <span style={{fontSize:'12px',color:'#cbd5e1',fontStyle:'italic'}}>N/A</span>
                      )}

                      {/* Hover tooltip with summary */}
                      {isHovered && data && (data.safe.length + data.caution.length + data.avoid.length > 0) && (
                        <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',background:'#0f172a',color:'white',padding:'10px 14px',borderRadius:'8px',fontSize:'12px',zIndex:10,minWidth:'180px',maxWidth:'260px',boxShadow:'0 8px 24px rgba(0,0,0,0.15)',lineHeight:'1.6',pointerEvents:'none'}}>
                          <div style={{fontWeight:'600',marginBottom:'4px',fontSize:'11px',color:'#94a3b8',letterSpacing:'0.5px'}}>{gene} · {phenotype}</div>
                          {data.safe.length > 0 && <div>✅ Safe: {data.safe.join(', ')}</div>}
                          {data.caution.length > 0 && <div>⚠️ Caution: {data.caution.join(', ')}</div>}
                          {data.avoid.length > 0 && <div>❌ Avoid: {data.avoid.join(', ')}</div>}
                          <div style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',width:0,height:0,borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderTop:'6px solid #0f172a'}}></div>
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

      <div style={{marginTop:'16px',fontSize:'12px',color:'#94a3b8',display:'flex',gap:'16px',flexWrap:'wrap'}}>
        <span>Source: CPIC Guidelines 2023</span>
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
      <h3 style={{fontSize:'18px',fontWeight:'700',color:'#0f172a',marginBottom:'16px'}}>Drug Comparison</h3>
      <div style={{background:'white',borderRadius:'12px',overflowX:'auto',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'600px'}}>
          <thead>
            <tr style={{background:'#f8fafc'}}>
              <th style={{padding:'16px',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#64748b',width:'140px'}}>Metric</th>
              {results.map((r, i) => (
                <th key={i} style={{padding:'16px',textAlign:'left',fontSize:'14px',fontWeight:'700',color:'#0f172a',textTransform:'capitalize',minWidth:'200px'}}>
                  {r.drug}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{borderTop:'1px solid #f1f5f9'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#f8fafc'}}>Risk Score</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',background:r.risk_score>=75?'rgba(254,242,242,0.5)':r.risk_score>=45?'rgba(255,251,235,0.5)':r.risk_score>=15?'rgba(239,246,255,0.5)':'rgba(240,253,244,0.5)'}}>
                  <span style={{fontSize:'16px',fontWeight:'700',color:sevColor(r.severity)}}>{Math.round(r.risk_score)}</span>
                  <span style={{fontSize:'11px',fontWeight:'600',color:sevColor(r.severity),marginLeft:'6px'}}>{r.severity}</span>
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #f1f5f9'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#f8fafc'}}>Gene</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'14px',color:'#0f172a',fontWeight:'500'}}>
                  {r.gene} <span style={{fontSize:'12px',color:'#64748b',fontWeight:'400'}}>({r.allele})</span>
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #f1f5f9'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#f8fafc'}}>Phenotype</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'13px',color:'#374151'}}>
                  {r.phenotype}
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #f1f5f9'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'600',color:'#475569',background:'#f8fafc'}}>Recommendation</td>
              {results.map((r, i) => (
                <td key={i} style={{padding:'14px 16px',fontSize:'13px',color:'#374151',lineHeight:'1.5'}}>
                  {r.cpic_recommendation || r.recommendation || 'Standard precautions'}
                </td>
              ))}
            </tr>
            <tr style={{borderTop:'1px solid #f1f5f9',background:'#f8fafc'}}>
              <td style={{padding:'14px 16px',fontSize:'13px',fontWeight:'700',color:'#0f172a'}}>Summary</td>
              <td colSpan={results.length} style={{padding:'14px 16px',fontSize:'13px',color:'#374151'}}>
                {results.filter(r=>r.severity==='HIGH').length > 0 && <span style={{color:'#dc2626',fontWeight:'600'}}>{results.filter(r=>r.severity==='HIGH').length} HIGH risk</span>}
                {results.filter(r=>r.severity==='MODERATE').length > 0 && <span style={{color:'#d97706',fontWeight:'600',marginLeft:'8px'}}>{results.filter(r=>r.severity==='MODERATE').length} MODERATE</span>}
                {results.filter(r=>r.severity==='NORMAL'||r.severity==='LOW').length > 0 && <span style={{color:'#16a34a',fontWeight:'600',marginLeft:'8px'}}>{results.filter(r=>r.severity==='NORMAL'||r.severity==='LOW').length} safe</span>}
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
    <div style={{margin:'0 24px 16px',background:'white',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
        <span style={{fontSize:'15px',fontWeight:'600',color:'#0f172a'}}>🧬 Drug Safety Guide</span>
        <span style={{fontSize:'11px',color:'#94a3b8'}}>Based on your {gene} {phenotype} status</span>
      </div>

      {safetyData.safe.length > 0 && (
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',marginBottom:'8px',alignItems:'flex-start'}}>
          <span style={{fontSize:'14px',flexShrink:0,marginTop:'1px'}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#15803d',marginBottom:'4px',letterSpacing:'0.3px'}}>SAFE</div>
            <div style={{fontSize:'13px',color:'#166534',lineHeight:'1.6',display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
              {safetyData.safe.map((d, i) => <span key={i}>{drugPill(d, currentDrug && d.toLowerCase() === currentDrug.toLowerCase())}</span>)}
            </div>
          </div>
        </div>
      )}

      {safetyData.caution.length > 0 && (
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',marginBottom:'8px',alignItems:'flex-start'}}>
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
        <div style={{display:'flex',gap:'8px',padding:'10px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',alignItems:'flex-start'}}>
          <span style={{fontSize:'14px',flexShrink:0,marginTop:'1px'}}>❌</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#991b1b',marginBottom:'4px',letterSpacing:'0.3px'}}>AVOID</div>
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
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'400px',color:'#64748b'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>🧬</div>
      <div style={{fontSize:'18px',fontWeight:'600',color:'#0f172a',marginBottom:'8px'}}>No analysis yet</div>
      <div style={{fontSize:'14px',textAlign:'center',maxWidth:'300px'}}>Select a patient profile or upload a VCF/JSON file to begin</div>
      {analysisCount>0&&<div style={{marginTop:'16px',fontSize:'13px',color:'#94a3b8'}}>📊 {analysisCount} analyses performed</div>}
    </div>
  );

  if(loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'400px',gap:'16px'}}>
      <div style={{fontSize:'48px'}}>🧬</div>
      <div style={{fontSize:'16px',color:'#374151',fontWeight:'500'}}>Analyzing genetic data...</div>
      <div style={{fontSize:'13px',color:'#64748b'}}>Querying CPIC API · Fetching PharmGKB · Generating AI explanation</div>
    </div>
  );

  if(error) return <div style={{padding:'24px'}}><div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',padding:'16px',color:'#dc2626'}}>{error}</div></div>;

  if(!result) return null;

  return (
    <div>
      {/* ACTION BAR */}
      <div style={{padding:'12px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:'16px',fontSize:'13px',color:'#64748b'}}>
          {responseTime&&<span>⚡ Analysis completed in {responseTime}s</span>}
          <span>📊 {analysisCount} analyses performed</span>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setShowJsonModal(true)} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',color:'#374151',cursor:'pointer'}}>{'{ } JSON'}</button>
          <button onClick={handleCopy} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',color:'#374151',cursor:'pointer'}}>📋 Copy</button>
          <button onClick={handleExport} style={{background:'#16a34a',border:'none',borderRadius:'6px',padding:'6px 14px',fontSize:'12px',color:'white',cursor:'pointer'}}>⬇ Export</button>
        </div>
      </div>

      {result.is_camera_scan&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',padding:'12px 20px',margin:'16px 24px 0',display:'flex',alignItems:'center',gap:'12px'}}><span style={{fontSize:'20px'}}>📷</span><div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:'600',color:'#15803d'}}>Scanned: {result.brand_name||result.scanned_drug}</div><div style={{fontSize:'12px',color:'#16a34a'}}>Generic: {result.scanned_drug} · Identified by Gemini Vision</div></div><span style={{background:'#dcfce7',border:'1px solid #bbf7d0',borderRadius:'6px',padding:'4px 10px',fontSize:'11px',color:'#15803d',fontWeight:'500'}}>📷 Camera Scan</span></div>}

      {result.is_vcf && result.saved_to_db && (
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',padding:'12px 20px',margin:'16px 24px 0',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'20px'}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:'600',color:'#15803d'}}>Saved to database</div>
            <div style={{fontSize:'12px',color:'#16a34a'}}>VCF {result.file_name} has been securely stored in your history.</div>
          </div>
        </div>
      )}

      {result.severity==='HIGH'&&<div className="high-risk-pulse" style={{background:'#fef2f2',borderLeft:'4px solid #dc2626',borderRadius:'8px',padding:'16px 20px',margin:'16px 24px 0'}}><div style={{fontSize:'16px',fontWeight:'600',color:'#dc2626',marginBottom:'4px'}}>⚠️ High Risk Interaction Detected</div><div style={{fontSize:'13px',color:'#ef4444'}}>Clinical review required before prescribing</div></div>}

      {/* METRICS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',margin:'16px 24px'}}>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#64748b',marginBottom:'8px'}}>RISK SCORE</div>
          <AnimatedScore targetScore={result.risk_score} severity={result.severity}/><span style={{fontSize:'14px',color:'#94a3b8'}}>/100</span>
          <div style={{marginTop:'8px',height:'4px',background:'#e2e8f0',borderRadius:'2px'}}><div style={{height:'100%',width:`${result.risk_score}%`,background:sevColor(result.severity),borderRadius:'2px',transition:'width 0.4s ease'}}/></div>
        </div>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#64748b',marginBottom:'8px'}}>METABOLIZER TYPE</div>
          <div style={{fontSize:'16px',fontWeight:'700',color:'#0f172a',marginBottom:'4px'}}>{result.phenotype}</div>
          <div style={{fontSize:'12px',color:'#64748b'}}>{result.gene}</div>
          <div style={{fontSize:'12px',color:'#64748b'}}>Activity Score: {result.activity_score??'N/A'}</div>
          {result.is_camera_scan&&DRUG_GENE_REASON[result.scanned_drug]&&<div style={{marginTop:'8px',fontSize:'11px',color:'#374151',lineHeight:'1.5',padding:'6px 8px',background:'#f8fafc',borderRadius:'4px',borderLeft:'3px solid #16a34a'}}>{DRUG_GENE_REASON[result.scanned_drug]}</div>}
        </div>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#64748b',marginBottom:'8px'}}>EVIDENCE LEVEL</div>
          <div style={{fontSize:'32px',fontWeight:'800',color:'#2563eb',marginBottom:'8px'}}>{result.evidence_level||'N/A'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}><span style={{background:'#f0fdf4',color:'#16a34a',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ PharmGKB Verified</span><span style={{background:'#eff6ff',color:'#2563eb',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ CPIC 2023 Standard</span></div>
        </div>
        <div className="card-hover" style={{background:'white',borderRadius:'12px',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',color:'#64748b',marginBottom:'8px'}}>SEVERITY</div>
          <div style={{fontSize:'24px',fontWeight:'800',color:sevColor(result.severity),marginBottom:'4px'}}>{result.severity}</div>
          <div style={{fontSize:'12px',color:'#64748b'}}>Clinical Classification</div>
          {result.ehr_priority&&<div style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>{result.ehr_priority}</div>}
        </div>
      </div>

      {/* MINI SAFETY MATRIX */}
      <MiniSafetyMatrix gene={result.gene} phenotype={result.phenotype} currentDrug={result.drug} />

      {/* GENE PANEL */}
      <div style={{margin:'0 24px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}><span style={{fontSize:'16px',fontWeight:'600',color:'#0f172a'}}>⚡ Gene Panel</span><span style={{background:'#f0fdf4',color:'#16a34a',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>6 genes analyzed</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
          {ALL_GENES.map(gene=>{
            const isA=result.gene===gene;
            const bs=isA?{background:result.phenotype.includes('Poor')?'#fef2f2':result.phenotype.includes('Intermediate')?'#fffbeb':'#f0fdf4',color:result.phenotype.includes('Poor')?'#dc2626':result.phenotype.includes('Intermediate')?'#d97706':'#16a34a'}:{background:'#f0fdf4',color:'#16a34a'};
            return(
              <div key={gene} className="card-hover" style={{background:'white',borderRadius:'12px',padding:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',fontWeight:'600',color:'#0f172a'}}>⚡ {gene}</span></div>
                <span style={{...bs,borderRadius:'4px',padding:'3px 10px',fontSize:'11px',fontWeight:'500',display:'inline-block',marginBottom:'6px'}}>{isA?result.phenotype:'Normal Metabolizer'}</span>
                {!isA&&<div style={{fontSize:'11px',color:'#94a3b8',fontStyle:'italic'}}>No actionable variants detected — assumed wild-type (*1/*1)</div>}
                {isA&&result.allele&&<div style={{fontSize:'11px',color:'#64748b',marginTop:'4px'}}>{result.allele}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* CPIC CONSULTATION */}
      {result.consultation_text&&<div className="card-hover" style={{margin:'0 24px 16px',background:'white',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><span style={{fontSize:'16px',fontWeight:'600',color:'#0f172a',borderLeft:'3px solid #2563eb',paddingLeft:'10px'}}>📋 CPIC Official Consultation</span><div style={{display:'flex',gap:'8px'}}><span style={{background:'#eff6ff',color:'#2563eb',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>✓ CPIC 2023</span>{result.ehr_priority&&<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:'4px',padding:'2px 8px',fontSize:'11px'}}>{result.ehr_priority}</span>}</div></div>
        <p style={{fontSize:'14px',color:'#374151',lineHeight:'1.7',margin:0}}>{result.consultation_text}</p>
      </div>}

      {/* SAFER ALTERNATIVES — ENHANCED */}
      {result.risk_score >= 45 && result.alternatives?.length > 0 ? (
        <div style={{margin:'0 24px 16px'}}>
          <div style={{fontSize:'16px',fontWeight:'600',color:'#0f172a',marginBottom:'12px',borderLeft:'3px solid #16a34a',paddingLeft:'10px'}}>Recommended Alternatives</div>
          {result.alternatives.map((a,i) => {
            const riskBg = (a.predicted_risk||0)>=75?'#fef2f2':(a.predicted_risk||0)>=45?'#fffbeb':(a.predicted_risk||0)>=15?'#eff6ff':'#f0fdf4';
            const riskColor = (a.predicted_risk||0)>=75?'#dc2626':(a.predicted_risk||0)>=45?'#d97706':(a.predicted_risk||0)>=15?'#2563eb':'#16a34a';
            return (
              <div key={i} className="card-hover" style={{background:'white',borderRadius:'12px',borderLeft:'4px solid #16a34a',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',marginBottom:'12px',position:'relative'}}>
                <div style={{position:'absolute',top:'16px',right:'16px',width:'44px',height:'44px',borderRadius:'50%',background:riskBg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'14px',color:riskColor}}>
                  {a.predicted_risk ?? '?'}
                </div>
                <div style={{display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'10px'}}>
                  <span style={{fontWeight:'700',fontSize:'16px',color:'#0f172a',textTransform:'capitalize'}}>{a.name || a.drug}</span>
                  <span style={{fontSize:'13px',color:'#64748b'}}>{a.brand || ''}</span>
                  {a.same_class !== undefined && (
                    <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'10px',background:a.same_class?'#f0fdf4':'#eff6ff',color:a.same_class?'#15803d':'#2563eb',fontWeight:'500'}}>{a.same_class?'Same Class':'Different Class'}</span>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'12px'}}>
                  {a.therapeutic_class && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#16a34a'}}>✓</span><span style={{color:'#374151'}}>Class: {a.therapeutic_class}</span></div>}
                  {a.metabolized_by && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#16a34a'}}>✓</span><span style={{color:'#374151'}}>Pathway: {a.metabolized_by.join(', ')} {a.avoids_gene ? `(avoids ${a.avoids_gene})` : ''}</span></div>}
                  {a.evidence_level && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#16a34a'}}>✓</span><span style={{color:'#374151'}}>Evidence: CPIC Level {a.evidence_level}</span></div>}
                  {a.predicted_severity && <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}><span style={{color:'#16a34a'}}>✓</span><span style={{color:'#374151'}}>Predicted risk: {a.predicted_risk}/100 ({a.predicted_severity})</span></div>}
                </div>
                {a.reason && <div style={{fontSize:'13px',color:'#64748b',fontStyle:'italic',marginBottom:'12px'}}>{a.reason}</div>}
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
                  }} style={{padding:'6px 14px',borderRadius:'6px',border:'1px solid #16a34a',background:'white',color:'#16a34a',fontSize:'12px',fontWeight:'500',cursor:'pointer'}}>Simulate Analysis</button>
                </div>
              </div>
            );
          })}
          <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:'10px',marginTop:'4px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>⚕️</span>
            <span style={{fontSize:'13px',color:'#92400e',fontStyle:'italic'}}>These recommendations are based on pharmacogenomic guidelines. Always consult the prescribing physician before changes.</span>
          </div>
        </div>
      ) : result.risk_score < 45 && (
        <div className="card-hover" style={{margin:'0 24px 16px',background:'#f0fdf4',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderLeft:'4px solid #16a34a'}}>
          <div style={{fontSize:'15px',fontWeight:'600',color:'#15803d',display:'flex',alignItems:'center',gap:'8px'}}>✅ Current medication appears safe for this genetic profile</div>
          <div style={{fontSize:'13px',color:'#166534',marginTop:'6px'}}>No actionable gene-drug interactions detected at clinical significance thresholds.</div>
        </div>
      )}

      {/* AI EXPLANATION */}
      {result.llm_explanation&&<div className="card-hover" style={{margin:'0 24px 24px',background:'white',borderRadius:'12px',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><span style={{fontSize:'16px',fontWeight:'600',color:'#0f172a',borderLeft:'3px solid #0f172a',paddingLeft:'10px'}}>🤖 AI Clinical Analysis</span><span style={{fontSize:'11px',color:'#94a3b8'}}>Powered by Gemini</span></div>
        <p style={{fontSize:'14px',color:'#374151',lineHeight:'1.7',margin:0}}>{result.llm_explanation}</p>
      </div>}
    </div>
  );
}
