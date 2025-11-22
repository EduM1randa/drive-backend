# ============================================================================
# Script: create-resources.ps1
# Description: Creates Azure resources for PapuDrive Backend API
#              - Resource Group
#              - App Service Plan (Linux, B1)
#              - Web App (Node 18)
#              - Key Vault
#              - Managed Identity for Web App
#              - App Settings with Key Vault references
# ============================================================================

param(
    [string]$ResourceGroup = "rg-papudrive",
    [string]$Location = "eastus",
    [string]$AppServicePlan = "plan-papudrive",
    [string]$WebAppName = "papudrive-backend",
    [string]$KeyVaultName = "kv-papudrive",
    [string]$MongoUri = "",
    [string]$FirebaseSecretPath = "",
    [string]$EmailSender = "",
    [string]$EmailPassword = "",
    [string]$CorsOrigin = "*"
)

Write-Host "Starting Azure resource creation for PapuDrive Backend..." -ForegroundColor Cyan

# Ensure Azure CLI path is in session
$azPath = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin'
if (-not ($env:Path -split ';' | Where-Object { $_ -eq $azPath })) {
    $env:Path = $env:Path + ';' + $azPath
    Write-Host "Added Azure CLI to PATH" -ForegroundColor Yellow
}

# Verify login
Write-Host "`nVerifying Azure CLI login..." -ForegroundColor Cyan
$account = az account show 2>$null
if (-not $account) {
    Write-Host "Not logged in. Running 'az login'..." -ForegroundColor Yellow
    az login
}

# 1. Create Resource Group (if not exists)
Write-Host "`n[1/7] Creating Resource Group: $ResourceGroup" -ForegroundColor Green
az group create -n $ResourceGroup -l $Location --output table

# 2. Create App Service Plan (Linux, B1)
Write-Host "`n[2/7] Creating App Service Plan: $AppServicePlan" -ForegroundColor Green
az appservice plan create `
    -g $ResourceGroup `
    -n $AppServicePlan `
    --is-linux `
    --sku B1 `
    --output table

# 3. Create Web App (Node 18)
Write-Host "`n[3/7] Creating Web App: $WebAppName" -ForegroundColor Green
az webapp create `
    -g $ResourceGroup `
    -p $AppServicePlan `
    -n $WebAppName `
    --runtime 'NODE:18-lts' `
    --output table

# 4. Set startup command
Write-Host "`n[4/7] Configuring Web App startup command" -ForegroundColor Green
az webapp config set `
    -g $ResourceGroup `
    -n $WebAppName `
    --startup-file 'node dist/main' `
    --output table

# 5. Create Key Vault
Write-Host "`n[5/7] Creating Key Vault: $KeyVaultName" -ForegroundColor Green
az keyvault create `
    -g $ResourceGroup `
    -n $KeyVaultName `
    -l $Location `
    --output table

# 6. Enable Managed Identity for Web App and grant Key Vault access
Write-Host "`n[6/7] Enabling Managed Identity and granting Key Vault access" -ForegroundColor Green
$principalId = az webapp identity assign -g $ResourceGroup -n $WebAppName --query principalId -o tsv
Write-Host "Managed Identity Principal ID: $principalId" -ForegroundColor Yellow

Start-Sleep -Seconds 5  # Wait for identity propagation

az keyvault set-policy `
    --name $KeyVaultName `
    --object-id $principalId `
    --secret-permissions get list `
    --output table

# 7. Upload secrets to Key Vault (if provided)
Write-Host "`n[7/7] Uploading secrets to Key Vault (if provided)" -ForegroundColor Green

if ($MongoUri) {
    Write-Host "  - Uploading MONGO_URI" -ForegroundColor Yellow
    az keyvault secret set --vault-name $KeyVaultName --name MONGO-URI --value $MongoUri --output none
}

if ($FirebaseSecretPath -and (Test-Path $FirebaseSecretPath)) {
    Write-Host "  - Uploading FIREBASE_SERVICE_ACCOUNT_KEY from file" -ForegroundColor Yellow
    az keyvault secret set --vault-name $KeyVaultName --name FIREBASE-SERVICE-ACCOUNT-KEY --file $FirebaseSecretPath --output none
}

if ($EmailPassword) {
    Write-Host "  - Uploading EMAIL_PASSWORD" -ForegroundColor Yellow
    az keyvault secret set --vault-name $KeyVaultName --name EMAIL-PASSWORD --value $EmailPassword --output none
}

# Get Key Vault URI
$kvUri = az keyvault show --name $KeyVaultName -g $ResourceGroup --query properties.vaultUri -o tsv

# 8. Configure App Settings with Key Vault references
Write-Host "`nConfiguring App Settings for Web App" -ForegroundColor Green

$appSettings = @()

if ($MongoUri) {
    $appSettings += "MONGO_URI=@Microsoft.KeyVault(SecretUri=${kvUri}secrets/MONGO-URI/)"
}

if ($FirebaseSecretPath) {
    $appSettings += "FIREBASE_SERVICE_ACCOUNT_KEY=@Microsoft.KeyVault(SecretUri=${kvUri}secrets/FIREBASE-SERVICE-ACCOUNT-KEY/)"
}

if ($EmailSender) {
    $appSettings += "EMAIL_SENDER=$EmailSender"
}

if ($EmailPassword) {
    $appSettings += "EMAIL_PASSWORD=@Microsoft.KeyVault(SecretUri=${kvUri}secrets/EMAIL-PASSWORD/)"
}

$appSettings += "CORS_ORIGIN=$CorsOrigin"
$appSettings += "PORT=3000"
$appSettings += "NODE_ENV=production"

if ($appSettings.Count -gt 0) {
    $settingsArgs = $appSettings -join ' '
    az webapp config appsettings set `
        -g $ResourceGroup `
        -n $WebAppName `
        --settings @appSettings `
        --output table
}

# Summary
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Azure resources created successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Resource Group:   $ResourceGroup" -ForegroundColor Yellow
Write-Host "Web App:          $WebAppName" -ForegroundColor Yellow
Write-Host "Key Vault:        $KeyVaultName" -ForegroundColor Yellow
Write-Host "Web App URL:      https://$WebAppName.azurewebsites.net" -ForegroundColor Yellow
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Download publish profile from Azure Portal for CI/CD" -ForegroundColor White
Write-Host "2. Add AZURE_WEBAPP_NAME and AZURE_WEBAPP_PUBLISH_PROFILE to GitHub Secrets" -ForegroundColor White
Write-Host "3. Push to 'main' or 'dev' branch to trigger deployment" -ForegroundColor White
Write-Host "============================================`n" -ForegroundColor Cyan
