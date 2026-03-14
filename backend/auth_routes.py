from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from database import get_db, User
from auth import verify_password, get_password_hash, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    specialization: Optional[str] = ""
    hospital: Optional[str] = ""
    phone: Optional[str] = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    full_name: str
    specialization: Optional[str] = ""
    hospital: Optional[str] = ""
    phone: Optional[str] = ""

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "specialization": user.specialization or "",
        "hospital": user.hospital or "",
        "phone": user.phone or "",
        "created_at": user.created_at.isoformat() if user.created_at else ""
    }

@router.post("/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        full_name=request.full_name,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        specialization=request.specialization,
        hospital=request.hospital,
        phone=request.phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user)}

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user)}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)

@router.put("/profile")
def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.full_name = request.full_name
    current_user.specialization = request.specialization
    current_user.hospital = request.hospital
    current_user.phone = request.phone
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated", "user": user_to_dict(current_user)}

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}
