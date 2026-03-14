import requests
import json

base_url = "http://localhost:8000"

# 1. Signup/Login
login_res = requests.post(
    f"{base_url}/api/auth/signup",
    json={
        "full_name": "Test User",
        "email": "test7@example.com",
        "password": "password"
    }
)
if login_res.status_code == 400:
    # Already registered, try login
    login_res = requests.post(
        f"{base_url}/api/auth/login",
        json={"email": "test7@example.com", "password": "password"}
    )
token = login_res.json()["access_token"]
print("Auth successful.")

# 2. Upload VCF
headers = {"Authorization": f"Bearer {token}"}
with open("../data/vcf/vcf_poor.vcf", "rb") as f:
    files = {"file": f}
    upload_res = requests.post(
        f"{base_url}/api/analyze/vcf",
        headers=headers,
        data={"drug": "sertraline"},
        files=files
    )

print(f"Upload Status: {upload_res.status_code}")
try:
    print(f"Upload Response: {upload_res.json()['success']}")
except Exception as e:
    print(f"Upload text: {upload_res.text}")

# 3. Get History
history_res = requests.get(
    f"{base_url}/api/vcf/history",
    headers=headers
)

print(f"History Status: {history_res.status_code}")
history_data = history_res.json()
print("History Items:")
for item in history_data:
    print(f" - {item['filename']} ({item['date']}) - {item['status']}")
