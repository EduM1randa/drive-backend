# Azure Deployment Guide - PapuDrive Backend API

Este documento describe los pasos para desplegar la API de NestJS en Azure App Service **sin Docker**, usando GitHub Actions para CI/CD automático.

---

## Arquitectura

- **Azure App Service** (Linux, Node 18): host de la aplicación NestJS.
- **Azure Key Vault**: almacenamiento seguro de secretos (MongoDB URI, Firebase Service Account, contraseñas SMTP).
- **Managed Identity**: la Web App accede a Key Vault sin credenciales explícitas.
- **GitHub Actions**: construye, prueba y despliega automáticamente en cada push a `main` o `dev`.

---

## Requisitos previos

1. **Cuenta de Azure** con suscripción activa (Azure for Students, Free Trial o pago).
2. **Azure CLI** instalado y autenticado (`az login`).
3. **Cuenta de GitHub** con el repositorio `drive-backend`.
4. **Node.js 18+** instalado localmente (para pruebas).
5. **Secretos preparados**:
   - URI de MongoDB (local o Azure Cosmos DB / MongoDB Atlas).
   - JSON de Firebase Service Account.
   - Credenciales SMTP (para envío de correos).
6. **Resource Providers registrados** (sólo necesario la primera vez):
   ```powershell
   az provider register --namespace Microsoft.Web
   az provider register --namespace Microsoft.KeyVault
   ```

### Regiones permitidas (Azure for Students)

Si usas Azure for Students, tu suscripción **solo permite** estas regiones:
- `southcentralus` (South Central US)
- `canadacentral` (Canada Central)
- `centralus` (Central US) ⭐ **Recomendado**
- `brazilsouth` (Brazil South)
- `westus3` (West US 3)

Usa `-Location "centralus"` en el script o comandos manuales.

---

## Paso 1: Crear recursos en Azure

### Opción A: Script automatizado (recomendado)

Ejecuta el script PowerShell incluido desde la raíz del proyecto:

```powershell
# Cambiar al directorio del proyecto
cd "M:\Documentos\GitHub\PapuDrive - V.Edu\drive-backend"

# Ejecutar script (ajusta parámetros según sea necesario)
.\scripts\azure\create-resources.ps1 `
  -ResourceGroup "rg-papudrive" `
  -Location "centralus" `
  -AppServicePlan "plan-papudrive" `
  -WebAppName "papudrive-backend" `
  -KeyVaultName "kv-papudrive" `
  -MongoUri "mongodb+srv://user:pass@cluster.mongodb.net/papudrive" `
  -FirebaseSecretPath "./secrets/firebase-service-account.json" `
  -EmailSender "soporte@papudrive.com" `
  -EmailPassword "tu-app-password" `
  -CorsOrigin "https://tu-frontend.com"
```

**Nota:** Si no proporcionas parámetros opcionales (MongoUri, FirebaseSecretPath, etc.), deberás configurarlos manualmente después.

### Opción B: Comandos manuales

Si prefieres ejecutar paso a paso:

```powershell
# 1. Crear Resource Group
az group create -n rg-papudrive -l westeurope

# 2. Crear App Service Plan (Linux, B1)
az appservice plan create -g rg-papudrive -n plan-papudrive --is-linux --sku B1

# 3. Crear Web App (Node 18)
az webapp create -g rg-papudrive -p plan-papudrive -n papudrive-backend --runtime "NODE|18-lts"

# 4. Configurar comando de inicio
az webapp config set -g rg-papudrive -n papudrive-backend --startup-file "node dist/main"

# 5. Crear Key Vault
az keyvault create -g rg-papudrive -n kv-papudrive -l westeurope

# 6. Habilitar Managed Identity y dar acceso a Key Vault
$principalId = az webapp identity assign -g rg-papudrive -n papudrive-backend --query principalId -o tsv
az keyvault set-policy --name kv-papudrive --object-id $principalId --secret-permissions get list

# 7. Subir secretos a Key Vault
az keyvault secret set --vault-name kv-papudrive --name MONGO-URI --value "mongodb+srv://..."
az keyvault secret set --vault-name kv-papudrive --name FIREBASE-SERVICE-ACCOUNT-KEY --file ./secrets/firebase-service-account.json
az keyvault secret set --vault-name kv-papudrive --name EMAIL-PASSWORD --value "tu-password"

# 8. Configurar App Settings (referencias a Key Vault)
$kvUri = az keyvault show --name kv-papudrive -g rg-papudrive --query properties.vaultUri -o tsv
az webapp config appsettings set -g rg-papudrive -n papudrive-backend --settings `
  MONGO_URI="@Microsoft.KeyVault(SecretUri=${kvUri}secrets/MONGO-URI/)" `
  FIREBASE_SERVICE_ACCOUNT_KEY="@Microsoft.KeyVault(SecretUri=${kvUri}secrets/FIREBASE-SERVICE-ACCOUNT-KEY/)" `
  EMAIL_SENDER="soporte@papudrive.com" `
  EMAIL_PASSWORD="@Microsoft.KeyVault(SecretUri=${kvUri}secrets/EMAIL-PASSWORD/)" `
  CORS_ORIGIN="https://tu-frontend.com" `
  PORT=3000 `
  NODE_ENV=production
```

---

## Paso 2: Configurar GitHub Actions para CI/CD

### 2.1. Obtener el Publish Profile

1. Ve al [Azure Portal](https://portal.azure.com).
2. Navega a tu Web App (`papudrive-backend`).
3. En el menú lateral, selecciona **Deployment Center** > **Manage publish profile** > **Download publish profile**.
4. Guarda el archivo XML descargado.

### 2.2. Añadir secretos a GitHub

1. Ve a tu repositorio en GitHub: `https://github.com/EduM1randa/drive-backend`.
2. Click en **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** y añade:
   - **Name:** `AZURE_WEBAPP_NAME`  
     **Value:** `papudrive-backend`
   - **Name:** `AZURE_WEBAPP_PUBLISH_PROFILE`  
     **Value:** (pega el contenido completo del XML descargado)

### 2.3. Verificar el workflow

El workflow ya está incluido en `.github/workflows/azure-deploy.yml`. Se ejecutará automáticamente en cada push a `main` o `dev`.

Pasos del workflow:
1. Checkout del código.
2. Setup Node 18 con cache de npm.
3. Instalar dependencias (`npm ci`).
4. Ejecutar linter y tests.
5. Build de la aplicación (`npm run build`).
6. Eliminar dependencias de desarrollo (`npm prune --production`).
7. Crear ZIP con `package.json`, `dist` y `node_modules` de producción.
8. Desplegar a Azure usando el publish profile.

---

## Paso 3: Desplegar y probar

### Primer despliegue manual (opcional)

Si quieres probar antes de configurar CI/CD:

```powershell
# Desde la raíz del proyecto
npm ci
npm run build
npm prune --production
Compress-Archive -Path package.json,dist,node_modules -DestinationPath app.zip -Force
az webapp deployment source config-zip -g rg-papudrive -n papudrive-backend --src app.zip
```

### Despliegue automático con GitHub Actions

1. Haz commit y push a `dev` o `main`:
   ```bash
   git add .
   git commit -m "Configure Azure deployment"
   git push origin dev
   ```
2. Ve a la pestaña **Actions** en GitHub para ver el progreso del workflow.
3. Una vez completado, accede a tu API:
   ```
   https://papudrive-backend.azurewebsites.net
   ```

---

## Paso 4: Verificación y monitoreo

### Comprobar logs de la aplicación

```powershell
az webapp log tail -g rg-papudrive -n papudrive-backend
```

### Comprobar App Settings

```powershell
az webapp config appsettings list -g rg-papudrive -n papudrive-backend --output table
```

### Comprobar secretos en Key Vault

```powershell
az keyvault secret list --vault-name kv-papudrive --output table
```

### Probar endpoint de la API

```bash
curl https://papudrive-backend.azurewebsites.net
```

---

## Paso 5: Integración con VNet (opcional)

Si necesitas que la Web App acceda a recursos privados (ej: base de datos en otra VNet):

```powershell
# Crear VNet y subnet
az network vnet create -g rg-papudrive -n vnet-papudrive --address-prefix 10.0.0.0/16 --subnet-name subnet-app --subnet-prefix 10.0.1.0/24

# Integrar Web App con VNet
az webapp vnet-integration add -g rg-papudrive -n papudrive-backend --vnet vnet-papudrive --subnet subnet-app
```

---

## Troubleshooting

### Error: "No subscriptions found"
- Ejecuta `az login` y selecciona la suscripción correcta.
- Verifica con `az account show`.

### Error: "Key Vault access denied"
- Asegúrate de que Managed Identity tiene permisos (`get`, `list`) en Key Vault.
- Espera unos segundos después de asignar la identidad para que se propague.

### Error: "Application failed to start"
- Verifica el startup command: `node dist/main`.
- Revisa logs: `az webapp log tail -g rg-papudrive -n papudrive-backend`.
- Comprueba que todas las variables de entorno están configuradas.

### Error: "Cannot connect to MongoDB"
- Verifica que `MONGO_URI` apunta a una instancia accesible (pública o con VNet integration).
- Si usas MongoDB Atlas, añade la IP de Azure a la whitelist (o habilita acceso desde cualquier IP en Atlas).

---

## Costos estimados (Azure for Students)

- **App Service Plan B1:** ~$13/mes (incluido en créditos de Azure for Students).
- **Key Vault:** ~$0.03/mes por 10,000 operaciones.
- **Bandwidth:** primeros 5GB/mes gratis.

**Total estimado:** cubierto por créditos de Azure for Students ($100/año).

---

## Próximos pasos

- [ ] Configurar Application Insights para monitoreo y trazas.
- [ ] Implementar staging slots para despliegues sin downtime.
- [ ] Añadir custom domain y certificado SSL.
- [ ] Configurar autoscaling si el tráfico crece.
- [ ] Migrar a Docker/ACR si necesitas mayor control del runtime.

---

## Referencias

- [Azure App Service Documentation](https://learn.microsoft.com/azure/app-service/)
- [Azure Key Vault Documentation](https://learn.microsoft.com/azure/key-vault/)
- [GitHub Actions - Azure Web Apps Deploy](https://github.com/Azure/webapps-deploy)
- [NestJS Deployment Guide](https://docs.nestjs.com/deployment)

---

**Autor:** PapuDrive Team  
**Última actualización:** Noviembre 2025
