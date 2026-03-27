import os

from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

DATABASE_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://root:123456@localhost:3306/geneguard_db")

# Railway provides MYSQL_URL with mysql:// prefix — replace with pymysql driver
_railway_url = os.environ.get("MYSQL_URL")
if _railway_url:
    DATABASE_URL = _railway_url.replace("mysql://", "mysql+pymysql://")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    specialization = Column(String(100), default="")
    hospital = Column(String(200), default="")
    phone = Column(String(20), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    vcf_uploads = relationship("VCFUpload", back_populates="user")

class VCFStatus(str, enum.Enum):
    uploaded = "uploaded"
    analyzed = "analyzed"
    failed = "failed"

class VCFUpload(Base):
    __tablename__ = "vcf_uploads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    patient_id = Column(String(50))
    filename = Column(String(255))
    upload_date = Column(DateTime, default=datetime.utcnow)
    file_content = Column(LONGTEXT)
    genes_analyzed = Column(JSON)
    status = Column(SQLEnum(VCFStatus), default=VCFStatus.uploaded)

    user = relationship("User", back_populates="vcf_uploads")

def create_tables():
    Base.metadata.create_all(bind=engine)

def create_vcf_table():
    VCFUpload.__table__.create(bind=engine, checkfirst=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
