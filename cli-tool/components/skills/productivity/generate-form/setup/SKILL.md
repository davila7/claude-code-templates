---
name: setup
description: Configure your pyform API Key to connect Claude Code with your account. Run once before using /generate-form.
user-invocable: true
allowed-tools: Bash(echo *), Bash(cat *)
argument-hint: [tu-api-key]
---

# pyform setup

Ayuda al usuario a configurar su API Key de pyform.

## Instrucciones

1. Si `$ARGUMENTS` contiene una key (un string que empieza con `pyf_`), extraela directamente.

2. Si `$ARGUMENTS` esta vacio o no contiene una key, informa al usuario:

> Para conectar Claude Code con tu cuenta de pyform necesitas una API Key:
>
> 1. Abre tu panel de pyform -> **Ajustes -> API Keys**
> 2. Haz clic en **"Nueva Key"** y copia la clave generada
> 3. Ejecuta: `/generate-form:setup pyf_tu_clave_aqui`
>
> Solo tienes que hacerlo una vez.

Luego **detente y espera** a que el usuario ejecute el comando con su key.

3. Una vez que tienes la key, valida que empiece con `pyf_` y tenga al menos 20 caracteres. Si no es valida, informa el formato correcto y detente.

4. Indica al usuario que debe anadir esta variable a su entorno persistente. Muestrale el comando exacto segun su sistema:

> Tu API Key es valida. Para que funcione en todas tus sesiones, ejecuta **uno** de estos comandos:
>
> **macOS/Linux (zsh):**
> ```
> echo 'export PYFORM_API_KEY="LA_KEY"' >> ~/.zshrc && source ~/.zshrc
> ```
>
> **macOS/Linux (bash):**
> ```
> echo 'export PYFORM_API_KEY="LA_KEY"' >> ~/.bashrc && source ~/.bashrc
> ```
>
> Listo. Ya puedes usar `/generate-form` para crear formularios.

Reemplaza `LA_KEY` con la key real del usuario en los comandos mostrados.

No ejecutes estos comandos automaticamente -- solo muestralos para que el usuario los copie y ejecute.
