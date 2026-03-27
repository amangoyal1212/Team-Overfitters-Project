import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("d:/amang/healthmed/pharmaguard/backend/.env")
api_key = os.getenv("GEMINI_API_KEY", "")
print(f"Testing key ending in {api_key[-6:]}")
genai.configure(api_key=api_key)

model = genai.GenerativeModel("gemini-flash-latest")
try:
    response = model.generate_content("Hello!")
    print("SUCCESS:", response.text.strip())
except Exception as e:
    print("FAILED:", str(e))
