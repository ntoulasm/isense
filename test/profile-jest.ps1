# 1. Configuration (Change 'analyzer-performance.js' to your exact file name)
$testFile = "performance"
$jestCliPath = ".\node_modules\jest-cli\bin\jest.js"

# 2. Run Jest with V8 Profiler
Write-Host "Running Jest with V8 Profiler..."
node --prof $jestCliPath --runInBand --testPathPattern=$testFile

# 3. Locate the Log File
$logFile = Get-ChildItem "isolate-*-v8.log" | Select-Object -First 1

if (-not $logFile) {
    Write-Error "Error: V8 log file not found. Check if tests ran successfully."
    exit 1
}

Write-Host "Found log file: $($logFile.Name)"

# 4. Process the Log File
$outputFile = "profile-results.txt"
Write-Host "Processing log file into $outputFile..."
node --prof-process $($logFile.Name) > $outputFile

# 5. Clean Up (Optional but recommended)
Remove-Item $logFile.Name

Write-Host "✨ Profiling complete. Results are in: $outputFile"