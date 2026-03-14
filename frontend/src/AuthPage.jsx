import React, { useState } from "react";
import axios from "axios";
import { API, inputStyle, labelStyle } from "./styles";

export function AuthPage({ onAuth, onBack }) {
  const [showRoleCard, setShowRoleCard] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupSpec, setSignupSpec] = useState('');
  const [signupHospital, setSignupHospital] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async () => {
    setAuthError('');
    if (!loginEmail || !loginPassword) { setAuthError('Please enter email and password'); return; }
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/login`, { email: loginEmail, password: loginPassword });
      onAuth(res.data.user, res.data.access_token);
    } catch(e) { setAuthError(e.response?.data?.detail || 'Login failed'); }
    finally { setAuthLoading(false); }
  };

  const handleSignup = async () => {
    setAuthError('');
    if (!signupName || !signupEmail || !signupPassword) { setAuthError('Name, email and password required'); return; }
    if (signupPassword.length < 6) { setAuthError('Password must be 6+ characters'); return; }
    if (signupPassword !== signupConfirm) { setAuthError('Passwords do not match'); return; }
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/signup`, {
        full_name: signupName, email: signupEmail, password: signupPassword,
        specialization: signupSpec, hospital: signupHospital
      });
      onAuth(res.data.user, res.data.access_token);
    } catch(e) { setAuthError(e.response?.data?.detail || 'Signup failed'); }
    finally { setAuthLoading(false); }
  };

  const features = ['✓ CPIC 2023 Official Guidelines','✓ Live PharmGKB Annotations','✓ Gemini AI Clinical Explanations','✓ VCF Genome File Analysis','✓ 6-Gene Pharmacogenomic Panel'];

  return (
    <div style={{minHeight:'100vh',display:'flex'}}>
      <div style={{width:'40%',background:'#0f172a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>🧬</div>
        <div style={{fontSize:'28px',fontWeight:'700',color:'white',marginBottom:'8px'}}>GeneGuard</div>
        <div style={{fontSize:'14px',color:'#94a3b8',marginBottom:'40px',textAlign:'center'}}>Clinical Pharmacogenomics Platform</div>
        {features.map(item=>(
          <div key={item} style={{display:'flex',gap:'10px',marginBottom:'12px',alignSelf:'flex-start'}}>
            <span style={{color:'#4ade80',fontWeight:'700'}}>{item.split(' ')[0]}</span>
            <span style={{color:'#cbd5e1',fontSize:'14px'}}>{item.split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
        <div style={{marginTop:'40px',background:'rgba(22,163,74,0.2)',border:'1px solid rgba(22,163,74,0.4)',borderRadius:'20px',padding:'6px 16px',color:'#4ade80',fontSize:'12px'}}>For Healthcare Professionals Only</div>
      </div>

      <div style={{width:'60%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',padding:'60px'}}>
        <div style={{width:'100%',maxWidth:'400px'}}>
          {showRoleCard ? (
            <div>
              <h2 style={{fontSize:'24px',fontWeight:'700',color:'#0f172a',marginBottom:'8px'}}>Welcome back</h2>
              <p style={{fontSize:'14px',color:'#64748b',marginBottom:'32px'}}>Sign in to access GeneGuard</p>
              <div onClick={()=>setShowRoleCard(false)} style={{border:'1px solid #e2e8f0',borderRadius:'12px',padding:'24px',marginBottom:'16px',cursor:'pointer',display:'flex',alignItems:'flex-start',gap:'16px'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='#16a34a';e.currentTarget.style.background='#f0fdf4'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='white'}}>
                <div style={{width:'48px',height:'48px',background:'#f0fdf4',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>👨‍⚕️</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'18px',fontWeight:'600',color:'#0f172a'}}>Doctor</div>
                  <div style={{fontSize:'13px',color:'#64748b',marginBottom:'8px'}}>Healthcare Professional</div>
                  <div style={{fontSize:'13px',color:'#374151',marginBottom:'12px'}}>Access clinical dashboards, patient PGx reports, and CPIC-guided prescribing tools.</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {['Patient PGx Reports','Drug Interaction Alerts','CPIC Guidelines'].map(t=>(
                      <span key={t} style={{background:'#f1f5f9',color:'#374151',borderRadius:'4px',padding:'3px 8px',fontSize:'11px'}}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:'20px',color:'#64748b',alignSelf:'center'}}>→</div>
              </div>
              <button onClick={onBack} style={{background:'none',border:'none',color:'#64748b',fontSize:'13px',cursor:'pointer',padding:0}}>← Back to home</button>
            </div>
          ) : (
            <div>
              <h2 style={{fontSize:'20px',fontWeight:'600',color:'#0f172a',marginBottom:'4px'}}>{authMode==='login'?'Welcome back, Doctor':'Create Doctor Account'}</h2>
              <p style={{fontSize:'13px',color:'#64748b',marginBottom:'24px'}}>{authMode==='login'?'Sign in to your GeneGuard account':'Join GeneGuard Precision Medicine Platform'}</p>
              {authError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'6px',padding:'10px 14px',color:'#dc2626',fontSize:'13px',marginBottom:'16px'}}>{authError}</div>}

              {authMode === 'login' ? (
                <div>
                  <div style={{marginBottom:'16px'}}><label style={labelStyle}>EMAIL ADDRESS</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="doctor@hospital.com" style={inputStyle}/></div>
                  <div style={{marginBottom:'20px'}}><label style={labelStyle}>PASSWORD</label><input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="Enter your password" style={inputStyle}/></div>
                  <button onClick={handleLogin} disabled={authLoading} style={{width:'100%',height:'42px',background:authLoading?'#86efac':'#16a34a',color:'white',border:'none',borderRadius:'6px',fontSize:'14px',fontWeight:'500',cursor:authLoading?'not-allowed':'pointer',marginBottom:'16px'}}>{authLoading?'Signing in...':'Sign In'}</button>
                  <p style={{textAlign:'center',fontSize:'13px',color:'#64748b',margin:'0 0 8px'}}>Don't have an account? <span onClick={()=>{setAuthMode('signup');setAuthError('')}} style={{color:'#16a34a',cursor:'pointer',fontWeight:'500'}}>Sign Up</span></p>
                  <p style={{textAlign:'center',margin:0}}><span style={{fontSize:'12px',color:'#94a3b8'}}>Demo: doctor@geneguard.ai / demo123</span></p>
                </div>
              ) : (
                <div>
                  {[{l:'FULL NAME *',v:signupName,s:setSignupName,t:'text',p:'Dr. John Sharma'},{l:'EMAIL *',v:signupEmail,s:setSignupEmail,t:'email',p:'doctor@hospital.com'},{l:'PASSWORD *',v:signupPassword,s:setSignupPassword,t:'password',p:'Minimum 6 characters'},{l:'CONFIRM PASSWORD *',v:signupConfirm,s:setSignupConfirm,t:'password',p:'Re-enter password'},{l:'SPECIALIZATION',v:signupSpec,s:setSignupSpec,t:'text',p:'e.g. Psychiatry'},{l:'HOSPITAL',v:signupHospital,s:setSignupHospital,t:'text',p:'e.g. AIIMS Delhi'}].map(f=>(
                    <div key={f.l} style={{marginBottom:'14px'}}><label style={labelStyle}>{f.l}</label><input type={f.t} value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={inputStyle}/></div>
                  ))}
                  <button onClick={handleSignup} disabled={authLoading} style={{width:'100%',height:'42px',background:authLoading?'#86efac':'#16a34a',color:'white',border:'none',borderRadius:'6px',fontSize:'14px',fontWeight:'500',cursor:'pointer',marginBottom:'16px',marginTop:'4px'}}>{authLoading?'Creating account...':'Create Account'}</button>
                  <p style={{textAlign:'center',fontSize:'13px',color:'#64748b',margin:0}}>Already have an account? <span onClick={()=>{setAuthMode('login');setAuthError('')}} style={{color:'#16a34a',cursor:'pointer',fontWeight:'500'}}>Sign In</span></p>
                </div>
              )}
              <button onClick={()=>{setShowRoleCard(true);setAuthError('')}} style={{background:'none',border:'none',color:'#64748b',fontSize:'13px',cursor:'pointer',padding:'12px 0 0',display:'block'}}>← Back to role selection</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
