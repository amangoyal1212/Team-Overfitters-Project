import requests

res = requests.post("http://localhost:8000/api/auth/login", json={"email": "doctor@geneguard.ai", "password": "demo123"})
print("login:", res.status_code, res.text)
if res.status_code == 200:
    token = res.json()["access_token"]
    with open("../data/vcf/vcf_intermediate.vcf", "rb") as f:
        files = {"file": f}
        headers = {"Authorization": f"Bearer {token}"}
        res2 = requests.post("http://localhost:8000/api/analyze/vcf?drug=sertraline", files=files, headers=headers)
        print("upload:", res2.status_code, res2.text)
