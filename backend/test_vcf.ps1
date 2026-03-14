$token = ''
$headers = @{ "Authorization" = "Bearer $token" }

$form = @{
    drug = "sertraline"
    file = Get-Item -Path "..\data\vcf\vcf_poor.vcf"
}

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/analyze/vcf" -ContentType "multipart/form-data" -Form $form -Headers $headers
