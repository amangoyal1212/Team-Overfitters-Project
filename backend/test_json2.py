import os, json, time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("d:/amang/healthmed/pharmaguard/backend/.env")
api_key = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)

models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemma-3-27b-it", "gemini-flash-latest", "gemini-2.5-pro", "gemini-pro-latest"]
results = {}

for m in models:
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hello")
        results[m] = "SUCCESS - " + response.text.strip()[:20]
    except Exception as e:
        results[m] = str(e)
    time.sleep(1)

with open("d:/amang/healthmed/pharmaguard/backend/test_out.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
