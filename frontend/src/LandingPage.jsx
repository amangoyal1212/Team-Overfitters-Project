import React from "react";

export function LandingPage({ onGoLogin }) {
  return (
    <div>
      <nav style={{position:'fixed',top:0,left:0,right:0,height:'64px',background:'white',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 80px',zIndex:100}}>
        <div style={{fontSize:'20px',fontWeight:'700',color:'#0f172a'}}>🧬 GeneGuard</div>
        <div style={{display:'flex',gap:'32px'}}>
          {['How It Works','Gene Panel','Drug Checker','About'].map(l=>(
            <span key={l} style={{fontSize:'14px',color:'#374151',cursor:'pointer'}} onMouseEnter={e=>e.target.style.color='#16a34a'} onMouseLeave={e=>e.target.style.color='#374151'}>{l}</span>
          ))}
        </div>
        <button onClick={onGoLogin} style={{background:'#16a34a',color:'white',border:'none',borderRadius:'8px',padding:'8px 20px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>Login</button>
      </nav>

      <section style={{minHeight:'100vh',display:'flex',alignItems:'center',padding:'80px 80px 40px',paddingTop:'120px'}}>
        <div style={{flex:1,paddingRight:'60px'}}>
          <div style={{fontSize:'11px',letterSpacing:'3px',color:'#64748b',marginBottom:'20px'}}>PHARMACOGENOMICS · DRUG SAFETY</div>
          <div style={{marginBottom:'24px'}}>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#16a34a',lineHeight:1.05}}>Predict precise</div>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#0f172a',lineHeight:1.05}}>Medication</div>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#0f172a',lineHeight:1.05}}>Decisions</div>
          </div>
          <p style={{fontSize:'16px',color:'#374151',maxWidth:'460px',lineHeight:'1.6',marginBottom:'36px'}}>
            Upload your VCF file and instantly assess drug safety, dosage adjustments, and toxicity risks using CPIC-aligned pharmacogenomic analysis — tailored to your patient's unique genetic profile.
          </p>
          <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
            <button onClick={onGoLogin} style={{background:'#16a34a',color:'white',border:'none',borderRadius:'8px',padding:'14px 28px',fontSize:'15px',fontWeight:'500',cursor:'pointer'}}>Explore GeneGuard →</button>
            <button onClick={()=>document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})} style={{background:'none',border:'none',fontSize:'15px',color:'#374151',cursor:'pointer',textDecoration:'underline'}}>How it works</button>
          </div>
        </div>
        <div style={{flex:1,background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderRadius:'24px',height:'480px',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="300" height="400" viewBox="0 0 300 400">
            <path d="M 80 20 C 140 60, 160 100, 80 140 C 20 180, 40 220, 80 260 C 140 300, 160 340, 80 380" stroke="#16a34a" strokeWidth="4" fill="none" opacity="0.8"/>
            <path d="M 220 20 C 160 60, 140 100, 220 140 C 280 180, 260 220, 220 260 C 160 300, 140 340, 220 380" stroke="#15803d" strokeWidth="4" fill="none" opacity="0.8"/>
            {[40,80,120,160,200,240,280,320,360].map((y,i)=>{const lx=80+Math.sin(i*0.8)*40;const rx=220-Math.sin(i*0.8)*40;return(<g key={y}><line x1={lx} y1={y} x2={rx} y2={y} stroke="#86efac" strokeWidth="2" opacity="0.6"/><circle cx={lx} cy={y} r="5" fill="#16a34a" opacity="0.8"/><circle cx={rx} cy={y} r="5" fill="#16a34a" opacity="0.8"/></g>)})}
            <text x="10" y="50" fontSize="10" fill="#64748b">CYP2D6</text>
            <text x="10" y="130" fontSize="10" fill="#64748b">CYP2C19</text>
            <text x="10" y="210" fontSize="10" fill="#64748b">CYP2C9</text>
            <text x="10" y="290" fontSize="10" fill="#64748b">TPMT</text>
          </svg>
        </div>
      </section>

      <section id="how-it-works" style={{padding:'80px',background:'white',textAlign:'center'}}>
        <h2 style={{fontSize:'32px',fontWeight:'700',color:'#0f172a',marginBottom:'8px'}}>How GeneGuard Works</h2>
        <p style={{fontSize:'16px',color:'#64748b',marginBottom:'56px'}}>Three steps to safer prescriptions</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'32px',maxWidth:'900px',margin:'0 auto'}}>
          {[{n:'01',i:'📁',t:'Upload Genetic File',d:'Upload patient VCF genome file or JSON patient data in seconds'},{n:'02',i:'💊',t:'Select Medications',d:'Choose from 8 drugs across 6 major pharmacogenomic pathways'},{n:'03',i:'🧬',t:'Get Clinical Insights',d:'Receive CPIC-aligned risk scores with Gemini AI explanations in under 3 seconds'}].map(s=>(
            <div key={s.n} style={{padding:'32px 24px',border:'1px solid #e2e8f0',borderRadius:'12px'}}>
              <div style={{width:'48px',height:'48px',background:'#f0fdf4',border:'2px solid #16a34a',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#16a34a',fontWeight:'700',fontSize:'16px',margin:'0 auto 16px'}}>{s.n}</div>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>{s.i}</div>
              <h3 style={{fontSize:'18px',fontWeight:'600',color:'#0f172a',marginBottom:'8px'}}>{s.t}</h3>
              <p style={{fontSize:'14px',color:'#64748b',lineHeight:'1.5',margin:0}}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{background:'#0f172a',padding:'56px 80px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'32px'}}>
        {[{n:'6',c:'#4ade80',l:'Genes Analyzed',s:'CYP2D6, CYP2C19, CYP2C9...'},{n:'400K+',c:'#f87171',l:'ADR Deaths/yr India',s:'Preventable with PGx testing'},{n:'29%',c:'#fbbf24',l:'Indians at CYP2C19 risk',s:'vs 15% global average'},{n:'<3s',c:'#4ade80',l:'Analysis Time',s:'From upload to clinical insight'}].map(st=>(
          <div key={st.l} style={{textAlign:'center'}}>
            <div style={{fontSize:'48px',fontWeight:'800',color:st.c,marginBottom:'8px'}}>{st.n}</div>
            <div style={{fontSize:'14px',color:'#94a3b8',marginBottom:'4px'}}>{st.l}</div>
            <div style={{fontSize:'12px',color:'#64748b'}}>{st.s}</div>
          </div>
        ))}
      </section>

      <section style={{background:'#f0fdf4',padding:'80px',textAlign:'center',borderTop:'1px solid #bbf7d0'}}>
        <h2 style={{fontSize:'32px',fontWeight:'700',color:'#0f172a',marginBottom:'8px'}}>Ready to make safer prescriptions?</h2>
        <p style={{fontSize:'16px',color:'#64748b',marginBottom:'32px'}}>Join doctors using evidence-based pharmacogenomics at the point of care.</p>
        <button onClick={onGoLogin} style={{background:'#16a34a',color:'white',border:'none',borderRadius:'8px',padding:'16px 36px',fontSize:'16px',fontWeight:'500',cursor:'pointer'}}>Start Free Analysis →</button>
      </section>

      <footer style={{background:'#0f172a',padding:'32px 80px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{color:'white',fontSize:'16px',fontWeight:'600',marginBottom:'4px'}}>🧬 GeneGuard</div>
          <div style={{color:'#64748b',fontSize:'12px'}}>© 2025 Team X — Hackathon Project</div>
        </div>
        <div style={{color:'#64748b',fontSize:'12px'}}>Powered by CPIC · PharmGKB · Gemini AI</div>
      </footer>
    </div>
  );
}
