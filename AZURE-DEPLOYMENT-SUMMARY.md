# PapuDrive Backend - Resumen Ejecutivo de Despliegue en Azure

**Fecha:** 12 de Noviembre, 2025  
**Proyecto:** PapuDrive Backend API (Cloud Computing - UCN)  
**Responsable:** Backend API + VNet  
**Estado:** ✅ Infraestructura creada y configurada

---

## 📦 Recursos creados en Azure

### Información general
- **Suscripción:** Azure for Students
- **Región:** `centralus` (Central US)
- **Resource Group:** `rg-papudrive`

### Servicios desplegados

| Recurso | Nombre | Tipo | Estado |
|---------|--------|------|--------|
| Resource Group | `rg-papudrive` | Microsoft.Resources/resourceGroups | ✅ Creado |
| App Service Plan | `plan-papudrive` | Linux, B1 SKU | ✅ Creado |
| Web App | `papudrive-backend` | Node 20 LTS | ✅ Creado |
| Key Vault | `kv-papudrive` | Standard, RBAC habilitado | ✅ Creado |

### URLs y endpoints
- **Web App URL:** https://papudrive-backend.azurewebsites.net
- **SCM (Kudu):** https://papudrive-backend.scm.azurewebsites.net
- **Key Vault URI:** https://kv-papudrive.vault.azure.net

---

## 🔐 Secretos y configuración

### Secretos almacenados en Key Vault (`kv-papudrive`)
- ✅ `MONGO-URI` — Cadena de conexión a MongoDB (actualizar con valor real)
- ✅ `EMAIL-PASSWORD` — Contraseña SMTP para envío de correos (actualizar con valor real)
- ⚠️ `FIREBASE-SERVICE-ACCOUNT-KEY` — *Pendiente de subir*

### App Settings configurados en Web App (`papudrive-backend`)
| Variable | Valor | Tipo |
|----------|-------|------|
| `MONGO_URI` | @Microsoft.KeyVault(SecretUri=...) | Key Vault Reference |
| `EMAIL_SENDER` | soporte@papudrive.com | Directo |
| `EMAIL_PASSWORD` | @Microsoft.KeyVault(SecretUri=...) | Key Vault Reference |
| `CORS_ORIGIN` | * | Directo |
| `PORT` | 3000 | Directo |
| `NODE_ENV` | production | Directo |

### Permisos configurados
- ✅ **Managed Identity (SystemAssigned):** habilitada en Web App
- ✅ **RBAC Key Vault:** Web App tiene rol `Key Vault Secrets User`
- ✅ **RBAC Key Vault (usuario):** Tu cuenta tiene rol `Key Vault Secrets Officer`

---

## 📁 Archivos generados en el repositorio

### Estructura añadida
```
drive-backend/
├── .github/workflows/
│   └── azure-deploy.yml          ← CI/CD automático (GitHub Actions)
├── scripts/azure/
│   └── create-resources.ps1      ← Script de aprovisionamiento
├── docs/
│   └── azure-deploy.md           ← Documentación completa
└── .env.example                  ← Plantilla de variables de entorno
```

### Workflow CI/CD (`.github/workflows/azure-deploy.yml`)
- **Trigger:** Push a `main` o `dev`, o ejecución manual
- **Pasos:**
  1. Checkout del código
  2. Setup Node 20 con cache de npm
  3. Instalar dependencias (`npm ci`)
  4. Ejecutar linter y tests
  5. Build de la aplicación (`npm run build`)
  6. Eliminar dependencias de desarrollo (`npm prune --production`)
  7. Crear ZIP con artifact de producción
  8. Deploy a Azure Web App usando publish profile

---

## ⚠️ Restricciones importantes (Azure for Students)

### Regiones permitidas
Tu suscripción **solo permite** estas 5 regiones:
- `southcentralus` (South Central US)
- `canadacentral` (Canada Central)
- **`centralus`** (Central US) ⭐ **Actualmente en uso**
- `brazilsouth` (Brazil South)
- `westus3` (West US 3)

### Resource Providers
Registrados manualmente (necesario la primera vez):
- ✅ `Microsoft.Web` (App Service)
- ✅ `Microsoft.KeyVault` (Key Vault)

### Runtime de Node.js
- ❌ Node 18 LTS — Ya no disponible en Azure
- ✅ Node 20 LTS — **Actualmente configurado**
- ✅ Node 22 LTS — Disponible
- ✅ Node 24 LTS — Disponible

---

## 📋 Próximos pasos pendientes

### 1. Actualizar secretos en Key Vault con valores reales

#### MongoDB URI (reemplazar con tu conexión real)
```powershell
# Opción A: MongoDB Atlas
az keyvault secret set --vault-name kv-papudrive --name MONGO-URI --value "mongodb+srv://user:password@cluster.mongodb.net/papudrive?retryWrites=true&w=majority"

# Opción B: Azure Cosmos DB para MongoDB
az keyvault secret set --vault-name kv-papudrive --name MONGO-URI --value "mongodb://account-name:password@account-name.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000"
```

#### Firebase Service Account (subir desde archivo JSON)
```powershell
az keyvault secret set --vault-name kv-papudrive --name FIREBASE-SERVICE-ACCOUNT-KEY --file "./secrets/firebase-service-account.json"

# Agregar App Setting para Firebase
az webapp config appsettings set -g rg-papudrive -n papudrive-backend --settings "FIREBASE_SERVICE_ACCOUNT_KEY=@Microsoft.KeyVault(SecretUri=https://kv-papudrive.vault.azure.net/secrets/FIREBASE-SERVICE-ACCOUNT-KEY/)"
```

#### Contraseña de email SMTP (Gmail App Password o servicio SMTP)
```powershell
az keyvault secret set --vault-name kv-papudrive --name EMAIL-PASSWORD --value "tu-app-password-real"
```

---

### 2. Configurar GitHub Secrets para CI/CD

#### Pasos para obtener Publish Profile:
1. Ir al [Azure Portal](https://portal.azure.com)
2. Buscar `papudrive-backend` (Web App)
3. Menú lateral: **Deployment** → **Deployment Center**
4. Click **Manage publish profile** → **Download publish profile**
5. Guardar el archivo XML descargado

#### Añadir secrets en GitHub:
1. Ir a: `https://github.com/EduM1randa/drive-backend/settings/secrets/actions`
2. Click **New repository secret**
3. Añadir:
   - **Name:** `AZURE_WEBAPP_NAME`  
     **Value:** `papudrive-backend`
   - **Name:** `AZURE_WEBAPP_PUBLISH_PROFILE`  
     **Value:** *(pegar todo el contenido del XML descargado)*

---

### 3. Primer despliegue y verificación

#### Desplegar código a Azure
```powershell
cd "M:\Documentos\GitHub\PapuDrive - V.Edu\drive-backend"
git add .
git commit -m "Add Azure deployment configuration and infrastructure"
git push origin dev
```

#### Verificar progreso del workflow
- URL: https://github.com/EduM1randa/drive-backend/actions
- Observar el job `build-and-deploy`
- Esperar a que termine (tarda ~3-5 minutos)

#### Verificar que la app responde
```powershell
# Ver logs en tiempo real
az webapp log tail -g rg-papudrive -n papudrive-backend

# Hacer request HTTP para probar
curl https://papudrive-backend.azurewebsites.net
```

#### Troubleshooting común
- **Error 500/503 al iniciar:**
  - Verificar logs: `az webapp log tail -g rg-papudrive -n papudrive-backend`
  - Revisar que `MONGO_URI` apunta a una BD accesible
  - Verificar que el startup command es correcto: `node dist/main`

- **Error de Key Vault (403 Forbidden):**
  - Esperar 2-3 minutos para propagación de permisos RBAC
  - Verificar que Managed Identity tiene rol `Key Vault Secrets User`

- **Error de compilación en GitHub Actions:**
  - Revisar el log del workflow en la pestaña Actions
  - Asegurar que `package-lock.json` está commiteado
  - Verificar que todos los tests pasan localmente: `npm test`

---

### 4. (Opcional) Configurar VNet e integración de red

Si necesitas conectar la Web App a recursos privados (base de datos en VNet privada, etc.):

```powershell
# Crear VNet y subnet
az network vnet create -g rg-papudrive -n vnet-papudrive --address-prefix 10.0.0.0/16 --subnet-name subnet-app --subnet-prefix 10.0.1.0/24

# Integrar Web App con VNet
az webapp vnet-integration add -g rg-papudrive -n papudrive-backend --vnet vnet-papudrive --subnet subnet-app

# Verificar integración
az webapp vnet-integration list -g rg-papudrive -n papudrive-backend
```

---

## 💰 Costos estimados (Azure for Students)

| Servicio | SKU | Costo mensual estimado | Cubierto por créditos |
|----------|-----|------------------------|----------------------|
| App Service Plan | B1 (1 core, 1.75 GB RAM) | ~$13 USD | ✅ Sí |
| Key Vault | Standard | ~$0.03 USD (10k ops) | ✅ Sí |
| Bandwidth | Primeros 5 GB | Gratis | ✅ Sí |
| **Total** | | **~$13.03 USD/mes** | **✅ 100% cubierto** |

**Nota:** Azure for Students incluye $100 USD en créditos por 12 meses, suficiente para este proyecto.

---

## 🔗 Recursos útiles

### Documentación del proyecto
- **Guía completa de despliegue:** `drive-backend/docs/azure-deploy.md`
- **Script de aprovisionamiento:** `drive-backend/scripts/azure/create-resources.ps1`
- **Workflow CI/CD:** `drive-backend/.github/workflows/azure-deploy.yml`
- **Variables de entorno:** `drive-backend/.env.example`

### Azure
- [Portal de Azure](https://portal.azure.com)
- [Azure App Service Documentation](https://learn.microsoft.com/azure/app-service/)
- [Azure Key Vault Documentation](https://learn.microsoft.com/azure/key-vault/)
- [Azure CLI Reference](https://learn.microsoft.com/cli/azure/)

### GitHub
- [Repository](https://github.com/EduM1randa/drive-backend)
- [Actions](https://github.com/EduM1randa/drive-backend/actions)
- [Settings - Secrets](https://github.com/EduM1randa/drive-backend/settings/secrets/actions)

---

## 🤝 Coordinación con equipo de Blob Storage

### Información para compartir con tu compañero
- **Resource Group:** `rg-papudrive`
- **Región:** `centralus`
- **VNet (si se crea):** `vnet-papudrive` (10.0.0.0/16)
- **Backend URL:** https://papudrive-backend.azurewebsites.net

### Recomendaciones de integración
1. **Storage Account:** Crear en el mismo Resource Group y región
2. **Conexión:** Usar Managed Identity o SAS tokens con caducidad
3. **Red privada:** Si crean Private Endpoint para el Storage Account, conectarlo a la misma VNet
4. **Variables de entorno:** El backend necesitará:
   - `AZURE_STORAGE_ACCOUNT_NAME`
   - `AZURE_STORAGE_CONTAINER_NAME`
   - `AZURE_STORAGE_SAS_TOKEN` o usar Managed Identity

---

## ✅ Checklist de validación

Antes de presentar/demostrar el proyecto, verificar:

- [ ] Recursos creados en Azure Portal (RG, App Service, Key Vault)
- [ ] Secretos actualizados en Key Vault con valores reales
- [ ] GitHub Secrets configurados (AZURE_WEBAPP_NAME, AZURE_WEBAPP_PUBLISH_PROFILE)
- [ ] Código desplegado (push a `dev` o `main`)
- [ ] Workflow de GitHub Actions completado exitosamente
- [ ] Web App responde en https://papudrive-backend.azurewebsites.net
- [ ] Logs de la aplicación sin errores críticos
- [ ] Base de datos MongoDB accesible desde la Web App
- [ ] CORS configurado correctamente (prueba desde frontend)
- [ ] Documentación actualizada en el repositorio

---

**Última actualización:** 12 de Noviembre, 2025  
**Autor:** GitHub Copilot Agent  
**Contacto:** EduM1randa (GitHub)
