import urllib.request
import json

# Test 1 - Health
print("=" * 50)
print("TEST 1 - Health Check")
print("=" * 50)
try:
    resp = urllib.request.urlopen("http://localhost:8000/api/health")
    data = json.loads(resp.read())
    if data.get("status") == "ok":
        print(f"Result: {data}")
        print(">>> PASS")
    else:
        print(f"Unexpected: {data}")
        print(">>> FAIL")
except Exception as e:
    print(f"Error: {e}")
    print(">>> FAIL")

# Test 2 - Gene Analysis
print("\n" + "=" * 50)
print("TEST 2 - Gene Analysis (CYP2D6 *4/*4 + sertraline)")
print("=" * 50)
try:
    body = json.dumps({
        "patient_id": "PT-003",
        "prescribed_drug": "sertraline",
        "allele_calls": {"CYP2D6": "*4/*4"}
    }).encode()
    req = urllib.request.Request(
        "http://localhost:8000/api/analyze",
        data=body,
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    r = data[0]
    print(f"risk_score: {r['risk_score']}")
    print(f"severity: {r['severity']}")
    eb = r.get('evidence_breakdown', {})
    print(f"evidence_breakdown: gene={eb.get('gene_analyzed','N/A')}, phenotype={eb.get('phenotype_assigned','N/A')}, source={eb.get('source','N/A')}")
    
    if r["risk_score"] >= 80 and r["severity"] == "HIGH":
        print(">>> PASS")
    else:
        print(">>> FAIL (expected risk_score >= 80 and severity HIGH)")
except Exception as e:
    print(f"Error: {e}")
    print(">>> FAIL")

# Test 3 - VCF Analysis
print("\n" + "=" * 50)
print("TEST 3 - VCF Analysis (vcf_poor.vcf + sertraline)")
print("=" * 50)
try:
    import os
    vcf_path = os.path.join("..", "data", "vcf", "vcf_poor.vcf")
    with open(vcf_path, "rb") as f:
        vcf_data = f.read()
    
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="vcf_poor.vcf"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
    ).encode() + vcf_data + f"\r\n--{boundary}--\r\n".encode()
    
    req = urllib.request.Request(
        "http://localhost:8000/api/analyze/vcf?drug=sertraline",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        }
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    
    print(f"success: {data['success']}")
    print(f"genes_analyzed: {data['genes_analyzed']}")
    print(f"number of results: {len(data['results'])}")
    
    has_high = False
    for result in data["results"]:
        a = result["analysis"]
        print(f"  Gene: {a['gene']}, risk_score: {a['risk_score']}, severity: {a['severity']}")
        if a["severity"] == "HIGH":
            has_high = True
    
    if has_high and data["success"]:
        print(">>> PASS")
    else:
        print(">>> FAIL (expected at least one HIGH severity)")
except Exception as e:
    print(f"Error: {e}")
    print(">>> FAIL")

print("\n" + "=" * 50)
print("ALL TESTS COMPLETE")
print("=" * 50)
