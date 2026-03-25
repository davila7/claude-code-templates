# E2B Sandbox Debugging Guide

## 🔍 Herramientas de Monitoreo Disponibles

### 1. Launcher Principal con Logging Mejorado
**Archivo**: `e2b-launcher.py`
- Logging detallado de cada paso
- Verificación de instalación de Claude Code
- Monitoreo de permisos y ambiente
- Timeouts extendidos para operaciones largas
- Descarga automática de archivos generados

### 2. Monitor de Sandbox en Tiempo Real
**Archivo**: `e2b-monitor.py`  
- Monitoreo de recursos del sistema
- Tracking de file system en tiempo real
- Análisis de performance y memory usage
- Logging con timestamps detallados

### 3. Simulador Demo
Para testing sin API keys válidos, crea un archivo demo que simule el flujo completo.

## 🚨 Troubleshooting Común

### Problema: "Sandbox timeout"
**Síntomas**:
```
❌ Error: The sandbox was not found: This error is likely due to sandbox timeout
```

**Soluciones**:
1. **Aumentar timeout del sandbox**:
   ```python
   sbx = Sandbox.create(timeout=600)  # 10 minutos
   sbx.set_timeout(900)  # Extender a 15 minutos
   ```

2. **Usar el monitor para ver qué consume tiempo**:
   ```bash
   python e2b-monitor.py "Your prompt here" "" your_e2b_key your_anthropic_key
   ```

### Problema: "Claude not found"
**Síntomas**:
```
❌ Claude not found, checking PATH...
```

**Debugging Steps**:
1. **Verificar template correcto**:
   ```python
   template="anthropic-claude-code"  # Debe ser exactamente este
   ```

2. **Verificar instalación en sandbox**:
   ```bash
   # El launcher ejecuta automáticamente:
   which claude
   claude --version
   echo $PATH
   ```

### Problema: "Permission denied"
**Síntomas**:
```
❌ Write permission issue
```

**Soluciones**:
1. **Verificar directorio de trabajo**:
   ```bash
   pwd
   whoami
   ls -la
   ```

2. **Cambiar a directorio con permisos**:
   ```python
   sbx.commands.run("cd /home/user && mkdir workspace && cd workspace")
   ```

### Problema: API Key Issues
**Síntomas**:
```
❌ Error: 401: Invalid API key
```

**Debugging**:
1. **Verificar formato de API key**:
   - E2B keys: formato específico de E2B
   - Anthropic keys: empiezan con "sk-ant-"

2. **Verificar permisos**:
   - Verificar que la key tenga permisos de sandbox
   - Verificar quota/límites de la cuenta

## 📊 Usando el Monitor para Debugging

### Comando Básico:
```bash
python e2b-monitor.py "Create a React app" "" your_e2b_key your_anthropic_key
```

### Output del Monitor:
```
[14:32:15] INFO: 🚀 Starting enhanced E2B sandbox with monitoring
[14:32:16] INFO: ✅ Sandbox created: abc123xyz
[14:32:17] INFO: 🔍 System resources check
[14:32:17] INFO: Memory usage:
[14:32:17] INFO:                total        used        free
[14:32:17] INFO:   Mem:           2.0Gi       512Mi       1.5Gi
[14:32:18] INFO: 📁 Initial file system state
[14:32:18] INFO: Current directory: /home/user
[14:32:19] INFO: 🤖 Executing Claude Code with monitoring
[14:32:19] INFO: Starting monitored execution: echo 'Create a React app'...
[14:32:22] INFO: Command completed in 3.45 seconds
[14:32:22] INFO: Exit code: 0
[14:32:22] INFO: STDOUT length: 2847 characters
```

## 🎯 Casos de Uso Específicos

### 1. **Debugging Timeouts**
```bash
# Usar el monitor para ver exactamente dónde se cuelga
python e2b-monitor.py "Complex prompt that times out"
```

### 2. **Verificar Generación de Archivos**
El launcher automáticamente descarga archivos generados:
```
💾 DOWNLOADING FILES TO LOCAL MACHINE:
✅ Downloaded: ./index.html → ./e2b-output/index.html
✅ Downloaded: ./styles.css → ./e2b-output/styles.css

📁 All files downloaded to: /path/to/project/e2b-output
```

### 3. **Monitoreo de Performance**
```
[14:33:20] INFO: Top processes:
[14:33:20] INFO:   USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
[14:33:20] INFO:   user      1234  5.2  2.1  98765 43210 pts/0    S+   14:32   0:01 claude
```

## 🛠 Configuración Avanzada

### Variables de Ambiente Útiles:
```bash
export E2B_DEBUG=1                    # Debug mode
export ANTHROPIC_API_KEY=your_key     # Claude API key  
export E2B_API_KEY=your_key          # E2B API key
```

### Configuración de Timeout Personalizada:
```python
# Para operaciones muy largas (ej: compilación completa)
sbx = Sandbox.create(timeout=1800)  # 30 minutos
sbx.set_timeout(3600)               # 1 hora máximo
```

## 📋 Checklist de Debugging

### Antes de Reportar un Issue:
- [ ] API keys válidos y con permisos correctos
- [ ] Template correcto: "anthropic-claude-code"
- [ ] Timeout suficiente para la operación
- [ ] Ejecutar con el monitor para logs detallados
- [ ] Verificar que Claude Code esté instalado en sandbox
- [ ] Revisar permisos de escritura en directorio
- [ ] Comprobar memoria/recursos disponibles

### Información a Incluir en Reports:
- Output completo del launcher o monitor
- Sandbox ID si está disponible
- Prompt exacto que causa el problema
- Componentes instalados (si aplica)
- Tiempo de ejecución antes del fallo

## 🚀 Funcionalidades del Sistema

### Descarga Automática de Archivos
El launcher descarga automáticamente todos los archivos generados:
- HTML, CSS, JS, TS, TSX, Python, JSON, Markdown
- Se guardan en directorio local `./e2b-output/`
- Excluye archivos internos de Claude Code
- Preserva nombres de archivo originales

### Logging Detallado
- Verificación de instalación de Claude Code
- Monitoreo de permisos y ambiente del sandbox
- Tracking de exit codes y output length
- Timestamps para análisis de performance

### Timeouts Inteligentes
- 10 minutos timeout inicial para creación
- 15 minutos total extendido automáticamente
- 5 minutos timeout para ejecución de Claude Code
- Timeouts cortos para verificaciones (5-10 segundos)

---

**Con estas herramientas puedes monitorear exactamente qué está pasando dentro del sandbox E2B y debuggear cualquier problema que surja.**