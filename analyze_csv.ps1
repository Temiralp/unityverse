$file = (Get-ChildItem 'c:\Users\seman\OneDrive\Masaüstü\unityverse\' -Filter '*nternal*').FullName
Write-Host "File: $file"
$csv = Import-Csv $file -Encoding UTF8
$nonIndexable = $csv | Where-Object { $_.Indexability -eq "Non-Indexable" }
$htmlOnly = $nonIndexable | Where-Object { $_."Content Type" -like "*text/html*" }
Write-Host "Total rows: $($csv.Count)"
Write-Host "Non-Indexable (all): $($nonIndexable.Count)"
Write-Host "Non-Indexable (HTML only): $($htmlOnly.Count)"
Write-Host ""
Write-Host "=== Non-Indexable Reasons ==="
$nonIndexable | Group-Object "Indexability Status" | Select-Object Count, Name | Format-Table -AutoSize
Write-Host ""
Write-Host "=== Sample: Non-Indexable HTML pages with their Canonical ==="
$htmlOnly | Select-Object -First 20 | ForEach-Object {
    Write-Host "---"
    Write-Host "URL: $($_.Address)"
    Write-Host "Reason: $($_.'Indexability Status')"
    Write-Host "Canonical: $($_.'Canonical Link Element 1')"
}
