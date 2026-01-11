# Configuración de Vercel Preview Deployments

Esta guía te ayudará a configurar preview links automáticos para cada Pull Request.

## Opción 1: Integración Nativa de Vercel (Recomendada) ⭐

La forma más sencilla es usar la integración nativa de Vercel con GitHub:

### Pasos:

1. **Conectar el repositorio a Vercel:**
   ```bash
   vercel link
   ```
   Esto creará archivos en `.vercel/` con la configuración del proyecto.

2. **Ir al Dashboard de Vercel:**
   - Abre https://vercel.com/dashboard
   - Selecciona tu proyecto
   - Ve a **Settings** → **Git**

3. **Habilitar Preview Deployments:**
   - En la sección **"Production Branch"**, asegúrate que esté configurado `main` o `master`
   - En **"Preview Deployments"**, activa:
     - ✅ **Deploy on Pull Request**
     - ✅ **Automatic Updates from Git**

4. **Configurar permisos de GitHub:**
   - Ve a **Settings** → **Git** → **GitHub Integration**
   - Asegúrate que Vercel tenga permisos para:
     - Leer el repositorio
     - Crear checks en PRs
     - Comentar en PRs

### Resultado:

Cada vez que se abra o actualice un PR, Vercel automáticamente:
- ✅ Creará un preview deployment
- ✅ Agregará un comentario en el PR con el link
- ✅ Mostrará el status en los checks del PR

---

## Opción 2: GitHub Actions (Control Manual)

Si prefieres más control sobre el proceso, puedes usar el workflow de GitHub Actions incluido.

### Configuración:

1. **Crear secrets en GitHub:**
   - Ve a **Settings** → **Secrets and variables** → **Actions**
   - Agrega los siguientes secrets:
     - `VERCEL_TOKEN`: Token de Vercel (obtenerlo en https://vercel.com/account/tokens)
     - `VERCEL_ORG_ID`: ID de tu organización (ejecuta `vercel link` y revisa `.vercel/project.json`)
     - `VERCEL_PROJECT_ID`: ID del proyecto (ejecuta `vercel link` y revisa `.vercel/project.json`)

2. **El workflow ya está creado:**
   - Archivo: `.github/workflows/vercel-preview.yml`
   - Se ejecuta automáticamente en cada PR

3. **Configurar variables de entorno (opcional):**
   - Si tu proyecto necesita variables de entorno para el build, agrégalas en:
     - Vercel Dashboard → Settings → Environment Variables
     - O en el workflow de GitHub Actions

---

## Comparación de Opciones

| Característica | Opción 1 (Nativa) | Opción 2 (GitHub Actions) |
|----------------|-------------------|---------------------------|
| Facilidad de configuración | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Control sobre el proceso | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Velocidad de deployment | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Comentarios en PR | ✅ Automático | ✅ Configurado |
| Checks en GitHub | ✅ Automático | ✅ Configurado |

---

## Verificar que funciona

1. **Crea un PR de prueba:**
   ```bash
   git checkout -b test/vercel-preview
   echo "# Test" >> TEST.md
   git add TEST.md
   git commit -m "test: Vercel preview"
   git push origin test/vercel-preview
   ```

2. **Abre el PR en GitHub**

3. **Espera a que Vercel/GitHub Actions:**
   - Construya el proyecto
   - Genere el preview deployment
   - Comente en el PR con el link

---

## Configuración Adicional

### Ignorar ciertos archivos en preview builds:

Crea `.vercelignore`:
```
node_modules
.git
*.log
.env.local
.DS_Store
```

### Deshabilitar previews para branches específicos:

En `vercel.json`:
```json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "master": true
    }
  }
}
```

### Variables de entorno para previews:

```bash
vercel env add VARIABLE_NAME preview
```

---

## Troubleshooting

### "Vercel no comenta en el PR"
- Verifica que Vercel tenga permisos para comentar
- Revisa Settings → Git → GitHub Integration

### "El deployment falla"
- Revisa los logs en Vercel Dashboard
- Verifica que el buildCommand en `vercel.json` sea correcto
- Asegúrate que todas las dependencias estén en `package.json`

### "GitHub Actions no se ejecuta"
- Verifica que los secrets estén configurados
- Revisa los logs en Actions tab de GitHub
- Asegúrate que el workflow esté en la rama correcta

---

## Recursos

- [Vercel Preview Deployments Docs](https://vercel.com/docs/deployments/preview-deployments)
- [GitHub Integration](https://vercel.com/docs/deployments/git/vercel-for-github)
- [Vercel CLI Reference](https://vercel.com/docs/cli)

---

**Recomendación:** Empieza con la **Opción 1 (Integración Nativa)** por su simplicidad. Si necesitas más control sobre el proceso de deployment, considera migrar a la Opción 2.
