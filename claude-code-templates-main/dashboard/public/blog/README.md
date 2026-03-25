# Blog Management System

Este blog utiliza un sistema dinámico de gestión de artículos basado en JSON.

## 📁 Estructura de Archivos

```
docs/blog/
├── index.html              # Página principal del blog
├── blog-articles.json      # Base de datos de artículos
├── js/
│   └── blog-loader.js      # Cargador dinámico de artículos
└── assets/                 # Imágenes y recursos
```

## 🚀 Cómo Agregar Nuevos Artículos

Para agregar un nuevo artículo al blog, simplemente edita el archivo `blog-articles.json`:

### 1. Abre el archivo `blog-articles.json`

### 2. Agrega un nuevo objeto en el array `articles`:

```json
{
  "id": "unique-article-id",
  "title": "Título del Artículo",
  "description": "Descripción breve del artículo (1-2 líneas)",
  "url": "https://medium.com/@tu-usuario/url-del-articulo",
  "image": "https://www.aitmpl.com/blog/assets/imagen-cover.png",
  "category": "Categoría",
  "publishDate": "2025-02-10",
  "readTime": "5 min read",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "platform": "medium",
  "order": 5
}
```

### 3. Actualiza los metadatos al final del archivo:

```json
"metadata": {
  "lastUpdated": "2025-02-10",
  "totalArticles": 5,
  "platforms": {
    "medium": 5,
    "local": 0
  }
}
```

## 📝 Campos Explicados

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | string | Identificador único del artículo | `"supabase-integration"` |
| `title` | string | Título completo del artículo | `"Claude Code + Supabase Integration"` |
| `description` | string | Descripción breve (1-2 líneas) | `"Learn how to integrate..."` |
| `url` | string | URL completa del artículo | `"https://medium.com/@..."` |
| `image` | string | URL de la imagen de portada | `"https://www.aitmpl.com/blog/assets/..."` |
| `category` | string | Categoría del artículo | `"Database"`, `"Development"`, etc. |
| `publishDate` | string | Fecha de publicación (YYYY-MM-DD) | `"2025-02-10"` |
| `readTime` | string | Tiempo estimado de lectura | `"5 min read"` |
| `tags` | array | Array de tags/etiquetas | `["Supabase", "Database", "MCP"]` |
| `difficulty` | string | Nivel de dificultad del artículo | `"basic"`, `"intermediate"`, `"advanced"` |
| `order` | number | Orden de aparición (menor = primero) | `1`, `2`, `3`, etc. |

## 🎨 Categorías Recomendadas

- **Database** - Artículos sobre bases de datos
- **Development** - Desarrollo general
- **Cloud & AI** - Cloud computing e inteligencia artificial
- **Documentation** - Documentación y guías
- **Frontend** - Desarrollo frontend
- **Backend** - Desarrollo backend
- **DevOps** - DevOps y CI/CD
- **Security** - Seguridad

## 🎓 Niveles de Dificultad

Clasifica cada artículo según su complejidad:

- **`basic`** - Verde (#00D084): Artículos introductorios, tutoriales para principiantes
- **`intermediate`** - Naranja (#FFA500): Requiere conocimientos previos, configuraciones más avanzadas
- **`advanced`** - Rojo (#FF4444): Temas complejos, integraciones avanzadas, arquitecturas elaboradas

El badge de dificultad se muestra automáticamente en la metadata del artículo.

## 🏷️ Tags Recomendados

Usa tags específicos y relevantes:
- Tecnologías: `Supabase`, `Next.js`, `React`, `Node.js`
- Conceptos: `Agents`, `Commands`, `MCP`, `Automation`
- Herramientas: `Git`, `Docker`, `Kubernetes`
- Plataformas: `Vercel`, `Google Cloud`, `AWS`

## 📊 Orden de Artículos

Los artículos se muestran según el campo `order`:
- **Menor número = Aparece primero**
- Usa números consecutivos: 1, 2, 3, 4, 5...
- Para reordenar, simplemente cambia los números

## 🔄 Proceso de Publicación

1. **Publica tu artículo** en Medium u otra plataforma
2. **Copia la URL** del artículo publicado
3. **Edita** `blog-articles.json`
4. **Agrega** el nuevo artículo con todos los campos
5. **Actualiza** los metadatos (totalArticles, lastUpdated)
6. **Commit y push** los cambios

```bash
git add docs/blog/blog-articles.json
git commit -m "Add new blog article: [Título]"
git push
```

## 🎯 Badges de Dificultad

El sistema automáticamente muestra un badge de dificultad con colores específicos:
- **Basic** (Verde): Para artículos introductorios y guías básicas
- **Intermediate** (Naranja): Para configuraciones más avanzadas
- **Advanced** (Rojo): Para temas complejos y arquitecturas avanzadas

## ✨ Características

- **Carga Dinámica**: Los artículos se cargan automáticamente desde JSON
- **Ordenamiento**: Controla el orden con el campo `order`
- **Seguridad**: HTML escapado automáticamente (prevención XSS)
- **Performance**: Lazy loading de imágenes
- **Responsive**: Diseño adaptable a móviles
- **Loading States**: Indicadores de carga mientras se obtienen los datos

## 🐛 Troubleshooting

### Los artículos no se cargan
1. Verifica que `blog-articles.json` esté en la raíz de `/docs/blog/`
2. Revisa la consola del navegador para errores
3. Asegúrate de que el JSON sea válido (usa un validador JSON online)

### Error de JSON inválido
- Verifica que todas las comillas sean dobles (`"`)
- Asegúrate de que no falten comas entre objetos
- El último elemento del array no debe tener coma final

### Las imágenes no se muestran
- Verifica que las URLs de las imágenes sean accesibles
- Usa URLs completas (no relativas)
- Asegúrate de que las imágenes estén en `/docs/blog/assets/`

## 📱 Testing Local

Para probar localmente:

```bash
cd docs/blog
python -m http.server 8000
# o
npx http-server
```

Luego abre: `http://localhost:8000`

## 🎉 Ejemplo Completo

```json
{
  "articles": [
    {
      "id": "my-new-article",
      "title": "Amazing New Feature in Claude Code",
      "description": "Discover how to use the latest feature that will revolutionize your workflow.",
      "url": "https://medium.com/@dan.avila7/amazing-new-feature-12345",
      "image": "https://www.aitmpl.com/blog/assets/new-feature-cover.png",
      "category": "Development",
      "publishDate": "2025-02-10",
      "readTime": "6 min read",
      "tags": ["Claude Code", "Productivity", "Automation"],
      "difficulty": "intermediate",
      "order": 1
    }
  ],
  "metadata": {
    "lastUpdated": "2025-02-10",
    "totalArticles": 5,
    "difficultyLevels": {
      "basic": 2,
      "intermediate": 2,
      "advanced": 1
    }
  }
}
```

---

**¡Eso es todo!** Ahora puedes agregar artículos fácilmente sin tocar el HTML. 🚀
