import os, json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("d:/amang/healthmed/pharmaguard/backend/.env")
api_key = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)

models = []
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            models.append(m.name)
except Exception as e:
    models.append(str(e))

with open("d:/amang/healthmed/pharmaguard/backend/test_out.json", "w", encoding="utf-8") as f:
    json.dump(models, f, indent=2)
