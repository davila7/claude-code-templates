# pyform Plugin for Claude Code

Genera formularios profesionales en [pyform](https://pyform.app) directamente desde Claude Code. Describe lo que necesitas en lenguaje natural y el plugin crea el formulario completo en tu cuenta.

## Instalacion

```bash
npx claude-code-templates@latest --skill productivity/generate-form
```

## Configuracion

### 1. Obtener tu API Key

1. Inicia sesion en [pyform](https://pyform.app)
2. Ve a **Ajustes -> API Keys**
3. Haz clic en **"Nueva Key"** y copia la clave

### 2. Configurar la key

Ejecuta en Claude Code:

```
/generate-form:setup pyf_tu_clave_aqui
```

El asistente te guiara para guardar la key en tu entorno.

## Skills disponibles

### `/generate-form`

Crea un formulario a partir de una descripcion en lenguaje natural.

**Ejemplos:**

```
/generate-form Encuesta de satisfaccion del cliente con NPS y comentarios
```

```
/generate-form Formulario de registro para evento tech con nombre, email, empresa y talleres
```

```
/generate-form Formulario de feedback de empleados con preguntas sobre ambiente laboral y sugerencias
```

### `/generate-form:setup`

Configura tu API Key de pyform. Solo necesitas hacerlo una vez.

```
/generate-form:setup pyf_abc123...
```

## Tipos de pregunta soportados

| Tipo | Descripcion |
|------|-------------|
| `TEXT` | Texto corto |
| `EMAIL` | Correo electronico |
| `NUMBER` | Valores numericos |
| `PHONE` | Telefono |
| `URL` | Enlace web |
| `TEXTAREA` | Texto largo |
| `MULTIPLE_CHOICE` | Seleccion unica |
| `CHECKBOXES` | Seleccion multiple |
| `DROPDOWN` | Lista desplegable |
| `DATE` | Fecha |
| `FILE_UPLOAD` | Subida de archivos |
| `WELCOME` | Pantalla de bienvenida |
| `GOODBYE` | Pantalla de despedida |

## Requisitos

- Cuenta activa en [pyform](https://pyform.app) con suscripcion Pro
- API Key generada desde el panel de Ajustes
- Conexion a la API de pyform (https://pyform.app o servidor propio)

## Seguridad

- La API Key se almacena en tu variable de entorno local, nunca en archivos del plugin.
- Todas las peticiones se autentican via header `x-api-key`.
- El plugin solo ejecuta `curl` y `echo` -- no accede a archivos ni modifica tu sistema.
- Permisos declarados explicitamente en cada skill via `allowed-tools`.

## Licencia

MIT
