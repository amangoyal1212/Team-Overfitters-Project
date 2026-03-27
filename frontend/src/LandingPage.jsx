import React from "react";

export function LandingPage({ onGoLogin }) {
  return (
    <div style={{background:'#F7F8F5'}}>
      <nav style={{position:'fixed',top:0,left:0,right:0,height:'64px',background:'rgba(255,255,255,0.72)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 80px',zIndex:100}}>
        <div style={{fontSize:'20px',fontWeight:'800',color:'#1A6B3C',fontFamily:'Manrope, Inter, sans-serif'}}>🧬 GeneGuard</div>
        <div style={{display:'flex',gap:'32px'}}>
          {['How It Works','Gene Panel','Drug Checker','About'].map(l=>(
            <span key={l} style={{fontSize:'14px',color:'#404940',cursor:'pointer',fontWeight:'500'}} onMouseEnter={e=>e.target.style.color='#1A6B3C'} onMouseLeave={e=>e.target.style.color='#404940'}>{l}</span>
          ))}
        </div>
        <button onClick={onGoLogin} style={{background:'linear-gradient(135deg,#1A6B3C,#005129)',color:'white',border:'none',borderRadius:'100px',padding:'10px 24px',fontSize:'14px',fontWeight:'600',cursor:'pointer',boxShadow:'0 4px 20px rgba(26,107,60,0.2)'}}>Login</button>
      </nav>

      <section style={{minHeight:'100vh',display:'flex',alignItems:'center',padding:'80px 80px 40px',paddingTop:'120px'}}>
        <div style={{flex:1,paddingRight:'60px'}}>
          <div style={{fontSize:'11px',letterSpacing:'3px',color:'#707A70',marginBottom:'20px',fontWeight:'600'}}>PHARMACOGENOMICS · DRUG SAFETY</div>
          <div style={{marginBottom:'24px'}}>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#1A6B3C',lineHeight:1.05,fontFamily:'Manrope, Inter, sans-serif'}}>Predict precise</div>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#191C1B',lineHeight:1.05,fontFamily:'Manrope, Inter, sans-serif'}}>Medication</div>
            <div style={{fontSize:'56px',fontWeight:'800',color:'#191C1B',lineHeight:1.05,fontFamily:'Manrope, Inter, sans-serif'}}>Decisions</div>
          </div>
          <p style={{fontSize:'16px',color:'#404940',maxWidth:'460px',lineHeight:'1.7',marginBottom:'36px'}}>
            Upload your VCF file and instantly assess drug safety, dosage adjustments, and toxicity risks using CPIC-aligned pharmacogenomic analysis — tailored to your patient's unique genetic profile.
          </p>
          <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
            <button onClick={onGoLogin} style={{background:'linear-gradient(135deg,#1A6B3C,#005129)',color:'white',border:'none',borderRadius:'100px',padding:'16px 32px',fontSize:'15px',fontWeight:'600',cursor:'pointer',boxShadow:'0 4px 20px rgba(26,107,60,0.2)'}}>Explore GeneGuard →</button>
            <button onClick={()=>document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})} style={{background:'none',border:'none',fontSize:'15px',color:'#404940',cursor:'pointer',textDecoration:'underline',fontWeight:'500'}}>How it works</button>
          </div>
        </div>
        <div style={{flex:1,background:'linear-gradient(135deg,rgba(26,107,60,0.06),rgba(26,107,60,0.12))',borderRadius:'24px',height:'480px',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="300" height="400" viewBox="0 0 300 400">
            <path d="M 80 20 C 140 60, 160 100, 80 140 C 20 180, 40 220, 80 260 C 140 300, 160 340, 80 380" stroke="#1A6B3C" strokeWidth="4" fill="none" opacity="0.8"/>
            <path d="M 220 20 C 160 60, 140 100, 220 140 C 280 180, 260 220, 220 260 C 160 300, 140 340, 220 380" stroke="#005129" strokeWidth="4" fill="none" opacity="0.8"/>
            {[40,80,120,160,200,240,280,320,360].map((y,i)=>{const lx=80+Math.sin(i*0.8)*40;const rx=220-Math.sin(i*0.8)*40;return(<g key={y}><line x1={lx} y1={y} x2={rx} y2={y} stroke="#89D89E" strokeWidth="2" opacity="0.6"/><circle cx={lx} cy={y} r="5" fill="#1A6B3C" opacity="0.8"/><circle cx={rx} cy={y} r="5" fill="#1A6B3C" opacity="0.8"/></g>)})}
            <text x="10" y="50" fontSize="10" fill="#707A70">CYP2D6</text>
            <text x="10" y="130" fontSize="10" fill="#707A70">CYP2C19</text>
            <text x="10" y="210" fontSize="10" fill="#707A70">CYP2C9</text>
            <text x="10" y="290" fontSize="10" fill="#707A70">TPMT</text>
          </svg>
        </div>
      </section>

      <section id="how-it-works" style={{padding:'80px',background:'white',textAlign:'center'}}>
        <h2 style={{fontSize:'32px',fontWeight:'800',color:'#191C1B',marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>How GeneGuard Works</h2>
        <p style={{fontSize:'16px',color:'#707A70',marginBottom:'56px'}}>Three steps to safer prescriptions</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'32px',maxWidth:'900px',margin:'0 auto'}}>
          {[{n:'01',i:'📁',t:'Upload Genetic File',d:'Upload patient VCF genome file or JSON patient data in seconds'},{n:'02',i:'💊',t:'Select Medications',d:'Choose from 8+ drugs across 6 major pharmacogenomic pathways'},{n:'03',i:'🧬',t:'Get Evidence Breakdown',d:'Receive CPIC-aligned risk scores with full evidence breakdown and guideline citations'}].map(s=>(
            <div key={s.n} style={{padding:'32px 24px',background:'#F7F8F5',borderRadius:'16px'}}>
              <div style={{width:'48px',height:'48px',background:'rgba(26,107,60,0.06)',border:'2px solid #1A6B3C',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#1A6B3C',fontWeight:'700',fontSize:'16px',margin:'0 auto 16px'}}>{s.n}</div>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>{s.i}</div>
              <h3 style={{fontSize:'18px',fontWeight:'700',color:'#191C1B',marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>{s.t}</h3>
              <p style={{fontSize:'14px',color:'#707A70',lineHeight:'1.5',margin:0}}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{background:'#00210D',padding:'56px 80px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'32px'}}>
        {[{n:'6',c:'#89D89E',l:'Genes Analyzed',s:'CYP2D6, CYP2C19, CYP2C9...'},{n:'400K+',c:'#FFB4AB',l:'ADR Deaths/yr India',s:'Preventable with PGx testing'},{n:'29%',c:'#fbbf24',l:'Indians at CYP2C19 risk',s:'vs 15% global average'},{n:'<3s',c:'#89D89E',l:'Analysis Time',s:'From upload to evidence breakdown'}].map(st=>(
          <div key={st.l} style={{textAlign:'center'}}>
            <div style={{fontSize:'48px',fontWeight:'800',color:st.c,marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>{st.n}</div>
            <div style={{fontSize:'14px',color:'#BFC9BE',marginBottom:'4px'}}>{st.l}</div>
            <div style={{fontSize:'12px',color:'#707A70'}}>{st.s}</div>
          </div>
        ))}
      </section>

      <section style={{background:'rgba(26,107,60,0.06)',padding:'80px',textAlign:'center'}}>
        <h2 style={{fontSize:'32px',fontWeight:'800',color:'#191C1B',marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>Ready to make safer prescriptions?</h2>
        <p style={{fontSize:'16px',color:'#707A70',marginBottom:'32px'}}>Join doctors using evidence-based pharmacogenomics at the point of care.</p>
        <button onClick={onGoLogin} style={{background:'linear-gradient(135deg,#1A6B3C,#005129)',color:'white',border:'none',borderRadius:'100px',padding:'16px 36px',fontSize:'16px',fontWeight:'600',cursor:'pointer',boxShadow:'0 4px 20px rgba(26,107,60,0.2)'}}>Start Free Analysis →</button>
      </section>

      <footer style={{background:'#00210D',padding:'32px 80px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{color:'white',fontSize:'16px',fontWeight:'700',marginBottom:'4px',fontFamily:'Manrope, Inter, sans-serif'}}>🧬 GeneGuard</div>
          <div style={{color:'#707A70',fontSize:'12px'}}>© 2025 Team X — Hackathon Project</div>
        </div>
        <div style={{color:'#707A70',fontSize:'12px'}}>Powered by CPIC · PharmGKB · Deterministic PGx Engine</div>
      </footer>
    </div>
  );
}
