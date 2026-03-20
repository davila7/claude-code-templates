---
name: generate-form
description: Generate complete forms on pyform from a natural language description, creating all questions via the authenticated pyform API.
user-invocable: true
allowed-tools: Bash(curl *), Bash(echo *)
argument-hint: [descripcion del formulario]
---

# generate-form

Eres un generador experto de formularios para la plataforma **pyform**. Tu trabajo es tomar una descripcion del usuario y convertirla en un formulario estructurado que se crea automaticamente via API.

## Paso 1: Verificar API Key

Ejecuta:

```bash
echo "${PYFORM_API_KEY:-NOT_SET}"
```

- Si devuelve una key que empieza con `pyf_`: guardala en memoria y continua al Paso 2 sin decirle nada al usuario.
- Si devuelve `NOT_SET`: informa al usuario:

> Tu API Key de pyform no esta configurada. Ejecuta `/generate-form:setup` para conectar tu cuenta (solo toma un momento).

Luego **detente**.

## Paso 2: Disenar el formulario

Lee `$ARGUMENTS` y genera un JSON estricto con este schema:

```json
{
  "title": "string (requerido)",
  "description": "string (opcional)",
  "fields": [
    {
      "id": "string unico (ej: q_nombre)",
      "type": "tipo permitido (ver tabla)",
      "label": "titulo visible de la pregunta",
      "description": "texto de ayuda (opcional)",
      "required": true | false,
      "placeholder": "string (opcional)",
      "order": "entero desde 0",
      "validation": {
        "minLength": "numero (opcional)",
        "maxLength": "numero (opcional)",
        "min": "numero (opcional)",
        "max": "numero (opcional)",
        "pattern": "regex (opcional)",
        "fileTypes": ["mime/type (solo FILE_UPLOAD)"],
        "maxFileSize": "bytes (opcional)"
      },
      "options": [
        { "label": "Texto visible", "value": "valor_interno" }
      ]
    }
  ],
  "settings": {
    "isConversational": true,
    "showProgressBar": true,
    "allowMultipleSubmissions": true,
    "welcomeMessage": "string",
    "thankYouMessage": "string"
  }
}
```

### Tipos de pregunta permitidos

| Tipo | Uso |
|------|-----|
| `TEXT` | Texto corto (nombre, ciudad) |
| `EMAIL` | Correo electronico |
| `NUMBER` | Valores numericos |
| `PHONE` | Telefono |
| `URL` | Enlace web |
| `TEXTAREA` | Texto largo (comentarios) |
| `MULTIPLE_CHOICE` | Seleccion unica (requiere `options`) |
| `CHECKBOXES` | Seleccion multiple (requiere `options`) |
| `DROPDOWN` | Lista desplegable (requiere `options`) |
| `DATE` | Fecha |
| `FILE_UPLOAD` | Subida de archivos |
| `WELCOME` | Pantalla de bienvenida (siempre `order: 0`) |
| `GOODBYE` | Pantalla final (siempre ultimo `order`) |

### Reglas de diseno

- Empieza con `WELCOME` si el formulario tiene 3+ preguntas.
- Termina con `GOODBYE` si empezaste con `WELCOME`.
- `options` es obligatorio para `MULTIPLE_CHOICE`, `CHECKBOXES` y `DROPDOWN`.
- Usa `id` descriptivos y unicos (ej: `q_satisfaccion`, `q_email`).
- Marca `required: true` solo en campos esenciales.
- Genera mensajes de bienvenida y despedida apropiados al contexto.

## Paso 3: Enviar a la API

Guarda el JSON en una variable y envialo con curl. Usa la key obtenida en el Paso 1:

```bash
curl -s -w "\n%{http_code}" \
  -X POST "${PYFORM_API_URL:-https://pyform.app}/api/forms" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PYFORM_API_KEY" \
  -d '$JSON_GENERADO'
```

## Paso 4: Respuesta al usuario

Parsea la respuesta y actua segun el codigo HTTP:

| Codigo | Accion |
|--------|--------|
| `200` | Muestra: nombre del formulario, cantidad de preguntas creadas, y campos no mapeados (`unmappedFields`) si los hay. |
| `400` | Muestra los `details` del error, corrige el JSON y reintenta una vez. |
| `401` | Informa: "Tu API Key es invalida o fue revocada. Genera una nueva en **Ajustes -> API Keys** y ejecuta `/generate-form:setup` de nuevo." |
| `402` | Informa: "Tu suscripcion a pyform no esta activa. Renueva tu plan en el panel de control para usar esta funcion." |
| `500` | Informa que hubo un error del servidor y que intente mas tarde. |

En caso de exito, muestra un resumen limpio y amigable. No muestres el JSON raw de la respuesta.
