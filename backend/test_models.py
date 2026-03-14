import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("d:/amang/healthmed/pharmaguard/backend/.env")
api_key = os.getenv("GEMINI_API_KEY", "")
print(f"Testing with key ending in: {api_key[-6:]}")
genai.configure(api_key=api_key)

models_to_test = [
    "gemini-1.5-flash-002", 
    "gemini-1.5-flash", 
    "gemini-1.5-flash-latest",
    "gemini-pro",
    "gemini-2.0-flash"
]

for m in models_to_test:
    print(f"\n--- Testing {m} ---")
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hello")
        print(f"SUCCESS! Response: {response.text.strip()[:30]}...")
    except Exception as e:
        print(f"ERROR: {e}")
