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

  const features = ['✓ CPIC Official Guidelines','✓ Live PharmGKB Annotations','✓ Evidence Breakdown Panel','✓ VCF Genome File Analysis','✓ 6-Gene Pharmacogenomic Panel'];

  const focusStyle = {borderBottom:'2px solid #1A6B3C', background:'#F3F4F1'};

  return (
    <div style={{minHeight:'100vh',display:'flex'}}>
      <div style={{width:'40%',background:'#00210D',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>🧬</div>
        <div style={{fontSize:'28px',fontWeight:'800',color:'white',marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>GeneGuard</div>
        <div style={{fontSize:'14px',color:'#BFC9BE',marginBottom:'40px',textAlign:'center'}}>Clinical Pharmacogenomics Platform</div>
        {features.map(item=>(
          <div key={item} style={{display:'flex',gap:'10px',marginBottom:'12px',alignSelf:'flex-start'}}>
            <span style={{color:'#89D89E',fontWeight:'700'}}>{item.split(' ')[0]}</span>
            <span style={{color:'#BFC9BE',fontSize:'14px'}}>{item.split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
        <div style={{marginTop:'40px',background:'rgba(26,107,60,0.2)',border:'1px solid rgba(26,107,60,0.4)',borderRadius:'100px',padding:'6px 16px',color:'#89D89E',fontSize:'12px',fontWeight:'500'}}>For Healthcare Professionals Only</div>
      </div>

      <div style={{width:'60%',background:'#F7F8F5',display:'flex',alignItems:'center',justifyContent:'center',padding:'60px'}}>
        <div style={{width:'100%',maxWidth:'400px'}}>
          {showRoleCard ? (
            <div>
              <h2 style={{fontSize:'24px',fontWeight:'800',color:'#191C1B',marginBottom:'8px',fontFamily:'Manrope, Inter, sans-serif'}}>Welcome back</h2>
              <p style={{fontSize:'14px',color:'#707A70',marginBottom:'32px'}}>Sign in to access GeneGuard</p>
              <div onClick={()=>setShowRoleCard(false)} style={{background:'white',borderRadius:'16px',padding:'24px',marginBottom:'16px',cursor:'pointer',display:'flex',alignItems:'flex-start',gap:'16px',boxShadow:'0 1px 3px rgba(0,33,13,0.04)',transition:'all 0.2s ease'}} onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 20px rgba(26,107,60,0.1)'}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,33,13,0.04)'}}>
                <div style={{width:'48px',height:'48px',background:'rgba(26,107,60,0.06)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>👨‍⚕️</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'18px',fontWeight:'700',color:'#191C1B',fontFamily:'Manrope, Inter, sans-serif'}}>Doctor</div>
                  <div style={{fontSize:'13px',color:'#707A70',marginBottom:'8px'}}>Healthcare Professional</div>
                  <div style={{fontSize:'13px',color:'#404940',marginBottom:'12px'}}>Access clinical dashboards, patient PGx reports, and CPIC-guided prescribing tools.</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {['Patient PGx Reports','Drug Interaction Alerts','CPIC Guidelines'].map(t=>(
                      <span key={t} style={{background:'#EDEEEB',color:'#404940',borderRadius:'100px',padding:'3px 10px',fontSize:'11px',fontWeight:'500'}}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:'20px',color:'#707A70',alignSelf:'center'}}>→</div>
              </div>
              <button onClick={onBack} style={{background:'none',border:'none',color:'#707A70',fontSize:'13px',cursor:'pointer',padding:0}}>← Back to home</button>
            </div>
          ) : (
            <div>
              <h2 style={{fontSize:'20px',fontWeight:'700',color:'#191C1B',marginBottom:'4px',fontFamily:'Manrope, Inter, sans-serif'}}>{authMode==='login'?'Welcome back, Doctor':'Create Doctor Account'}</h2>
              <p style={{fontSize:'13px',color:'#707A70',marginBottom:'24px'}}>{authMode==='login'?'Sign in to your GeneGuard account':'Join GeneGuard Precision Medicine Platform'}</p>
              {authError && <div style={{background:'rgba(186,26,26,0.06)',borderRadius:'10px',padding:'10px 14px',color:'#ba1a1a',fontSize:'13px',marginBottom:'16px'}}>{authError}</div>}

              {authMode === 'login' ? (
                <div>
                  <div style={{marginBottom:'16px'}}><label style={labelStyle}>EMAIL ADDRESS</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="doctor@hospital.com" style={inputStyle} onFocus={e=>{e.target.style.borderBottom='2px solid #1A6B3C';e.target.style.background='#F3F4F1'}} onBlur={e=>{e.target.style.borderBottom='2px solid transparent';e.target.style.background='#EDEEEB'}}/></div>
                  <div style={{marginBottom:'20px'}}><label style={labelStyle}>PASSWORD</label><input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="Enter your password" style={inputStyle} onFocus={e=>{e.target.style.borderBottom='2px solid #1A6B3C';e.target.style.background='#F3F4F1'}} onBlur={e=>{e.target.style.borderBottom='2px solid transparent';e.target.style.background='#EDEEEB'}}/></div>
                  <button onClick={handleLogin} disabled={authLoading} style={{width:'100%',height:'44px',background:authLoading?'#89D89E':'linear-gradient(135deg,#1A6B3C,#005129)',color:'white',border:'none',borderRadius:'100px',fontSize:'14px',fontWeight:'600',cursor:authLoading?'not-allowed':'pointer',marginBottom:'16px',boxShadow:'0 4px 20px rgba(26,107,60,0.15)'}}>{authLoading?'Signing in...':'Sign In'}</button>
                  <p style={{textAlign:'center',fontSize:'13px',color:'#707A70',margin:'0 0 8px'}}>Don't have an account? <span onClick={()=>{setAuthMode('signup');setAuthError('')}} style={{color:'#1A6B3C',cursor:'pointer',fontWeight:'600'}}>Sign Up</span></p>
                  <p style={{textAlign:'center',margin:0}}><span style={{fontSize:'12px',color:'#BFC9BE'}}>Demo: doctor@geneguard.ai / demo123</span></p>
                </div>
              ) : (
                <div>
                  {[{l:'FULL NAME *',v:signupName,s:setSignupName,t:'text',p:'Dr. John Sharma'},{l:'EMAIL *',v:signupEmail,s:setSignupEmail,t:'email',p:'doctor@hospital.com'},{l:'PASSWORD *',v:signupPassword,s:setSignupPassword,t:'password',p:'Minimum 6 characters'},{l:'CONFIRM PASSWORD *',v:signupConfirm,s:setSignupConfirm,t:'password',p:'Re-enter password'},{l:'SPECIALIZATION',v:signupSpec,s:setSignupSpec,t:'text',p:'e.g. Psychiatry'},{l:'HOSPITAL',v:signupHospital,s:setSignupHospital,t:'text',p:'e.g. AIIMS Delhi'}].map(f=>(
                    <div key={f.l} style={{marginBottom:'14px'}}><label style={labelStyle}>{f.l}</label><input type={f.t} value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={inputStyle} onFocus={e=>{e.target.style.borderBottom='2px solid #1A6B3C';e.target.style.background='#F3F4F1'}} onBlur={e=>{e.target.style.borderBottom='2px solid transparent';e.target.style.background='#EDEEEB'}}/></div>
                  ))}
                  <button onClick={handleSignup} disabled={authLoading} style={{width:'100%',height:'44px',background:authLoading?'#89D89E':'linear-gradient(135deg,#1A6B3C,#005129)',color:'white',border:'none',borderRadius:'100px',fontSize:'14px',fontWeight:'600',cursor:'pointer',marginBottom:'16px',marginTop:'4px',boxShadow:'0 4px 20px rgba(26,107,60,0.15)'}}>{authLoading?'Creating account...':'Create Account'}</button>
                  <p style={{textAlign:'center',fontSize:'13px',color:'#707A70',margin:0}}>Already have an account? <span onClick={()=>{setAuthMode('login');setAuthError('')}} style={{color:'#1A6B3C',cursor:'pointer',fontWeight:'600'}}>Sign In</span></p>
                </div>
              )}
              <button onClick={()=>{setShowRoleCard(true);setAuthError('')}} style={{background:'none',border:'none',color:'#707A70',fontSize:'13px',cursor:'pointer',padding:'12px 0 0',display:'block'}}>← Back to role selection</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
