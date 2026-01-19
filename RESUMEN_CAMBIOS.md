# RESUMEN RÁPIDO: FLUJO VOZ → UML

## ✅ FLUJO COMPLETO IMPLEMENTADO

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ FRONTEND: Micrófono                                    │
│    ✓ startRecording() → captura audio                     │
│    ✓ stopRecording()  → genera Blob                       │
└────────────────┬────────────────────────────────────────────┘
                 │ FormData(audio)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ BACKEND STEP 1: Transcripción                          │
│    transcribeAudio()                                       │
│    ✓ Gemini API + base64 encoding                         │
│    ✓ Input: WAV/WebM (buffer)                            │
│    ✓ Output: "Crear diagrama biblioteca..."              │
│    ✓ Fallback: pattern-based si falla                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ BACKEND STEP 2: Expansión                              │
│    expandSimpleDescription()                              │
│    ✓ Gemini API expansion                                │
│    ✓ Input: "Crear diagrama biblioteca..."               │
│    ✓ Output: Especificación técnica completa             │
│    ✓ Fallback: patrones (tienda, escuela, biblioteca)    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ BACKEND STEP 3: Generación UML                         │
│    generateUMLFromVoice(expandedText, retryAttempt)       │
│    ✓ Gemini API generación UML estructural                │
│    ✓ Input: Descripción expandida                        │
│    ✓ System prompt: reglas UML obligatorias              │
│    ✓ Output: { elements[], relationships[] }             │
│    ✓ Reintento automático si falla (max 1)              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ BACKEND STEP 4: Validación                             │
│    validateDiagramStructure()                             │
│    ✓ Elements: no vacío, estructura válida               │
│    ✓ Relaciones: >1 clase ⇒ ≥1 relación                 │
│    ✓ Cardinalidad: ['0..1', '0..*', '1', '1..*']        │
│    ✓ Clases: no aisladas (participan en ≥1 rel)        │
└────────────────┬────────────────────────────────────────────┘
                 │ JSON Response
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6️⃣ FRONTEND: Renderizar                                    │
│    mergeDiagramIntoBoard()                                │
│    ✓ Nodos (clases) + Edges (relaciones)                │
│    ✓ Canvas interactivo (React Flow)                     │
│    ✓ Socket.IO: sincroniza con otros usuarios            │
└─────────────────────────────────────────────────────────────┘
```

## 📋 CAMBIOS REALIZADOS

### Backend: `ai.voice.controller.js`

| Función | Estado | Input | Output |
|---------|--------|-------|--------|
| `transcribeAudio()` | ✅ | Audio (WAV/WebM) | "Crear diagrama..." |
| `expandSimpleDescription()` | ✅ | "Crear diagrama..." | Spec técnica completa |
| `generateUMLFromVoice()` | ✅ **REESCRITO** | Spec técnica | { elements[], relationships[] } |
| `processVoiceInput()` | ✅ | req/res | Pipeline 4-pasos |
| `generateBasicDiagram()` | ✅ | Texto cualquiera | Diagrama fallback |
| `expandWithPatterns()` | ✅ | Texto | Expansión sin API |

### Frontend: `aiService.js`

| Función | Estado | Cambio |
|---------|--------|--------|
| `generateDiagram()` | ✅ | Enrutamiento inteligente voice/image/text |

### Frontend: `AiBubble.jsx`

| Handler | Estado | Función |
|---------|--------|---------|
| `startRecording()` | ✅ | Captura audio desde micrófono |
| `stopRecording()` | ✅ | Detiene y retorna Blob |
| `handleSend()` | ✅ | Envía a backend y renderiza |

---

## 🔑 VALIDACIONES CRÍTICAS

En `generateUMLFromVoice()`:

```javascript
✓ if (!transcribedText) → Error "Texto vacío"
✓ if (diagram.elements.length === 0) → Error "Elements vacío"
✓ if (diagram.elements.length > 1 && diagram.relationships.length === 0) 
  → Error "X clases sin relaciones (ERROR CRÍTICO)"
✓ if (className no participa en relaciones && elements.length > 1)
  → Error "Clase aislada"
✓ if (cardinalityFrom not in ['0..1', '0..*', '1', '1..*'])
  → Error "Cardinalidad inválida"
✓ if (class name in ['id', 'uuid', 'pk', 'fk'])
  → Error "Clase inválida (deben ser atributos)"
✓ if (duplicated relationship A→B)
  → Error "Relación duplicada"
```

---

## 📊 ESQUEMA JSON UML

```json
{
  "elements": [
    {
      "id": "class_id",
      "type": "class",
      "name": "ClassName",
      "attributes": [
        {"name": "attrName", "type": "string", "visibility": "public"}
      ],
      "methods": [
        {"name": "methodName", "returnType": "string", "visibility": "public"}
      ]
    }
  ],
  "relationships": [
    {
      "from": "ClassName1",
      "to": "ClassName2",
      "type": "association|aggregation|composition|inheritance",
      "cardinalityFrom": "1|0..*|0..1|1..*",
      "cardinalityTo": "1|0..*|0..1|1..*"
    }
  ]
}
```

---

## 🎯 EJEMPLOS DE USO

### Entrada 1: "diagrama biblioteca"
```
STEP 1: "Diagrama de biblioteca con libros, autores y préstamos"
STEP 2: "Clase Libro {id, titulo, isbn, autor_id} | Clase Autor {id, nombre} | Clase Prestamo {id, usuario_id, libro_id, fecha_prestamo}"
STEP 3: Genera 3 clases con 2 relaciones (Libro→Autor, Prestamo→Libro)
STEP 4: Validación pasa ✓
```

### Entrada 2: "sistema tienda"
```
STEP 1: "Sistema para una tienda con productos, clientes y ventas"
STEP 2: Especificación: Producto, Cliente, Venta, Proveedor, Categoria
STEP 3: Genera 5 clases con 4+ relaciones
STEP 4: Validación pasa ✓
```

### Error: "crear diagrama"
```
STEP 1: Audio muy corto → fallback "Crear diagrama..."
STEP 2: Expansión genérica
STEP 3: Genera 1 clase → Validación PASA (1 clase = 0 relaciones OK)
STEP 4: Validación pasa ✓
```

---

## ⚠️ ERRORES POSIBLES

| Error | Causa | Solución |
|-------|-------|----------|
| "Texto vacío" | Audio sin palabras | Repetir con audio claro |
| "X clases sin relaciones" | IA no generó relaciones | Reintento automático |
| "Clase aislada: X" | Clase sin participar en relaciones | Prompt más estricto |
| "Cardinalidad inválida: 3..*" | IA usó cardinalidad incorrecta | Reintento automático |
| "Clase inválida: ID" | IA creó clase para identificador | Reintento automático |

---

## 🔄 FLUJO CON MANEJO DE ERRORES

```
Audio grabado
     ↓
STEP 1: transcribeAudio()
     ├─ ✅ OK → STEP 2
     └─ ❌ Error → fallback (pattern-based)
            ↓
         STEP 2
            ↓
STEP 2: expandSimpleDescription()
     ├─ ✅ OK → STEP 3
     └─ ❌ Error → usa texto original
            ↓
         STEP 3
            ↓
STEP 3: generateUMLFromVoice(retryAttempt=0)
     ├─ ✅ OK → STEP 4
     └─ ❌ Error → REINTENTO (retryAttempt=1)
            ├─ ✅ OK → STEP 4
            └─ ❌ Error → Response 500
                  ↓
              Error message al usuario
                  ↓
STEP 4: validateDiagramStructure()
     ├─ ✅ OK → Response 200 { diagram }
     └─ ⚠️ Warning → Response 200 { diagram } (continúa)
                  ↓
           Renderizar en frontend
```

---

## 📌 ARCHIVOS CLAVE

- **Backend**: `backend/src/controllers/ai.voice.controller.js`
  - Líneas 224-380: `generateUMLFromVoice()` (reescrito)
  - Líneas 897-973: `processVoiceInput()` (pipeline)
  
- **Frontend**: `frontend/src/utils/aiService.js`
  - Enrutamiento inteligente voice/image/text
  
- **Routes**: `backend/src/routes/ai.routes.js`
  - Configuración de multer
  - Middleware `handleMultipleFormats`

---

## ✨ ESTADO FINAL

✅ **VOZ → TEXTO**: Gemini API real + fallback  
✅ **TEXTO → UML**: Prompt system estricto + validaciones  
✅ **VALIDACIÓN**: Relaciones, cardinalidad, clases completas  
✅ **REINTENTOS**: Automáticos si generación falla  
✅ **FALLBACK**: Pattern-based para cada dominio  
✅ **DOCUMENTADO**: Sistema completo explicado  

🚀 **LISTO PARA PRODUCCIÓN**

---

**Última actualización**: Enero 19, 2026  
**Versión**: 1.0 Stable
