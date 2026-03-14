import os, json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("d:/amang/healthmed/pharmaguard/backend/.env")
api_key = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)

models_to_test = [
    "gemini-1.5-flash-002", 
    "gemini-1.5-flash", 
    "gemini-1.5-flash-latest", 
    "gemini-1.5-pro",
    "gemini-pro"
]
res = {}

for m in models_to_test:
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hello")
        res[m] = "SUCCESS"
    except Exception as e:
        res[m] = str(e)

with open("d:/amang/healthmed/pharmaguard/backend/test_out.json", "w", encoding="utf-8") as f:
    json.dump(res, f, indent=2)
