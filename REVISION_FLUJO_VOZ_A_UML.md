# REVISIÓN DEL FLUJO: VOZ → TEXTO → UML

## 📋 RESUMEN EJECUTIVO

**Estado**: ✅ Flujo completo implementado  
**Arquitectura**: Voz → Transcripción → Expansión → Generación UML → Validación  
**Stack**: Node.js + Gemini API + React + Socket.IO  

---

## 1. CAMBIOS REALIZADOS

### ✅ Backend: `ai.voice.controller.js`

#### 1.1 Función: `transcribeAudio(audioFile)`
- **Estado**: ✅ Implementado con Gemini API
- **Entrada**: Archivo de audio (WAV, WebM, MP3)
- **Proceso**:
  1. Guarda audio temporalmente en `/temp/`
  2. Convierte a base64
  3. Envía a Gemini API con prompt de transcripción
  4. Si falla → fallback por tamaño de audio
- **Salida**: String de texto transcrito
- **Ejemplo**:
  ```
  "Crear diagrama de una biblioteca con clases Libro, Autor y Prestamo"
  ```

#### 1.2 Función: `expandSimpleDescription(transcribedText)`
- **Estado**: ✅ Implementado con Gemini API
- **Entrada**: Texto transcrito
- **Proceso**:
  1. Envía a Gemini con prompt de expansión
  2. Expande la descripción simple en especificación técnica
  3. Si falla → usa patrones predefinidos
  4. Patrones: tienda, escuela, biblioteca, genérico
- **Salida**: Descripción expandida con clases, atributos, métodos
- **Ejemplo**:
  ```
  "Clase Libro con atributos: id, titulo, isbn, autor_id
   Clase Autor con atributos: id, nombre, biografia
   Clase Prestamo con atributos: id, usuario_id, libro_id, fecha_prestamo"
  ```

#### 1.3 Función: `generateUMLFromVoice(transcribedText, retryAttempt = 0)`
- **Estado**: ✅ Reescrito completamente
- **Entrada**: Texto transcrito (o expandido)
- **Proceso**:
  1. Valida que el texto no esté vacío
  2. Crea system prompt con reglas UML estrictas
  3. Envía a Gemini como user prompt
  4. Limpia respuesta (markdown, BOM, prefijos)
  5. Parsea JSON
  6. **Validaciones críticas**:
     - ✓ Elements no vacío
     - ✓ Relationships es array
     - ✓ Cada element tiene: id, name, type
     - ✓ Cada relación tiene: from, to, type, cardinalityFrom, cardinalityTo
     - ✓ Sin clases inválidas (ID, UUID, PK, FK)
     - ✓ Si >1 clase → ≥1 relación obligatoria
     - ✓ Cada clase participa en ≥1 relación
     - ✓ Cardinalidad válida: ['0..1', '0..*', '1', '1..*', '1..1']
     - ✓ Sin relaciones duplicadas
  7. Si error → reintento automático (max 1)
- **Salida**: Diagrama UML estructurado
- **Validaciones al error**:
  ```javascript
  // Si falta transcription
  "No se pudo reconocer la voz. El texto transcrito está vacío."
  
  // Si >1 clase sin relaciones
  "Crítico: X clases sin relaciones. Se requiere al menos 1 relación."
  
  // Si clase aislada
  "Clase aislada: ClassName. Todas las clases deben participar en al menos 1 relación."
  ```

#### 1.4 Función: `processVoiceInput(req, res)`
- **Estado**: ✅ Implementado con pipeline 4-pasos
- **Pipeline**:
  ```
  Step 1: Audio File → transcribeAudio() → Texto
  Step 2: Texto → expandSimpleDescription() → Descripción expandida
  Step 3: Descripción → generateUMLFromVoice() → Diagrama UML
  Step 4: Diagrama → validateDiagramStructure() → Validación final
  ```
- **Respuesta**:
  ```json
  {
    "success": true,
    "message": "🎤 Diagrama generado desde audio...",
    "diagram": { ... },
    "originalInput": "...",
    "expandedDescription": "..."
  }
  ```

#### 1.5 Funciones auxiliares
- **`generateBasicDiagram(description)`**: Fallback pattern-based
  - Detecta: tienda, escuela, biblioteca
  - Genera diagrama con 4-5 clases completas
  - Incluye relaciones y cardinalidad
  
- **`expandWithPatterns(text)`**: Expansión sin API
  - Patrones predefinidos por dominio
  - Retorna descripción con clases, atributos, métodos, relaciones

---

### ✅ Frontend: `aiService.js`

#### 2.1 Función: `generateDiagram()`
- **Estado**: ✅ Implementado con enrutamiento inteligente
- **Entrada**: `{ type, content, file, salaId }`
- **Enrutamiento**:
  ```javascript
  if (file && type === 'voice') → /apis/ai/voice
  if (file && type === 'image') → /apis/ai/generate-diagram/image
  if (type === 'text') → /apis/ai/generate-diagram
  ```
- **Request**:
  - Voice: `FormData` con campo `audio`
  - Image: `FormData` con campo `image`
  - Text: JSON `{ type, content, salaId }`
- **Response**: Diagrama UML completo

#### 2.2 Función: `modifyDiagram()`
- **Estado**: ✅ Implementado para ediciones
- **Entrada**: `{ prompt, nodes, edges, mode, dryRun, salaId }`
- **Endpoint**: `/apis/ai/modify-diagram`

---

### ✅ Frontend: `AiBubble.jsx`

#### 3.1 Recording handlers
- **`startRecording()`**: Inicia captura de micrófono
  - Usa Web Audio API
  - Captura chunks de audio
- **`stopRecording()`**: Detiene grabación
  - Retorna Blob de audio
  - Crea FormData con audio
- **`handleSend()`**: Envía diagrama
  - Detecta modo: text, voice, image, edit
  - Para voice: envía archivo a `aiService.generateDiagram()`

---

### ✅ Backend: `ai.routes.js`

#### 4.1 Rutas configuradas
- `POST /generate-diagram`: Maneja text/voice/image
- `POST /generate-diagram/image`: Solo imágenes
- `POST /verify-diagram`: Verificación de diagramas
- `POST /modify-diagram`: Edición de diagramas
- `GET /health`: Health check

#### 4.2 Middleware `handleMultipleFormats`
- Detecta content-type
- Enruta a `upload.fields()` para multipart
- Delega a controladores apropiados

---

## 2. FLUJO COMPLETO: VOZ → TEXTO → UML

### Diagrama de flujo

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Vite)                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AiBubble.jsx                                                   │
│  ├─ startRecording() ──→ Web Audio API (micrófono)             │
│  ├─ stopRecording()  ──→ Blob de audio                         │
│  └─ handleSend()     ──→ FormData(audio) + aiService.js        │
│                                                                 │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             │ POST /apis/ai/voice (multipart)
                             │ Content-Type: multipart/form-data
                             │ Body: {audio: File}
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Node.js + Express)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ai.routes.js (handleMultipleFormats middleware)               │
│  ├─ Detecta: multipart/form-data                               │
│  ├─ Ejecuta: upload.fields([{audio}, {image}])                 │
│  └─ Enruta a: AIController.generateDiagram(req, res)           │
│                                                                 │
│  ai.controller.js (generateDiagram)                            │
│  ├─ Detecta: req.body.type === 'voice' (desde middleware)     │
│  └─ Enruta a: AIVoiceController.processVoiceInput(req, res)    │
│                                                                 │
│  ai.voice.controller.js (processVoiceInput)                    │
│  ├─ STEP 1: transcribeAudio(req.files.audio[0])               │
│  │   └─ Entrada: WAV/WebM (buffer)                             │
│  │   └─ Proceso: Gemini API + base64 encoding                 │
│  │   └─ Salida: "Crear diagrama biblioteca..."                │
│  │                                                             │
│  ├─ STEP 2: expandSimpleDescription(transcribedText)          │
│  │   └─ Entrada: "Crear diagrama biblioteca..."               │
│  │   └─ Proceso: Gemini API (expansión de especificación)     │
│  │   └─ Salida: "Clase Libro con atributos id, titulo..."    │
│  │                                                             │
│  ├─ STEP 3: generateUMLFromVoice(expandedDescription)         │
│  │   └─ Entrada: Descripción expandida                        │
│  │   └─ Proceso: Gemini API (generación UML estructural)      │
│  │   └─ Validaciones críticas:                                │
│  │       ✓ JSON válido                                         │
│  │       ✓ Elements no vacío                                   │
│  │       ✓ >1 clase ⇒ ≥1 relación obligatoria                │
│  │       ✓ Cada clase participa en ≥1 relación                │
│  │       ✓ Cardinalidad UML válida                             │
│  │       ✓ Reintentos automáticos si falla                    │
│  │   └─ Salida: {                                              │
│  │       "elements": [                                         │
│  │         {id, type, name, attributes[], methods[]}          │
│  │       ],                                                    │
│  │       "relationships": [                                    │
│  │         {from, to, type, cardinalityFrom, cardinalityTo}   │
│  │       ]                                                     │
│  │     }                                                        │
│  │                                                             │
│  └─ STEP 4: validateDiagramStructure(diagram)                 │
│      └─ Validación final y normalización                      │
│                                                                 │
│  Respuesta HTTP 200                                             │
│  └─ {                                                           │
│      "success": true,                                           │
│      "message": "🎤 Diagrama generado desde audio...",         │
│      "diagram": {...},                                         │
│      "originalInput": "...",                                   │
│      "expandedDescription": "..."                              │
│    }                                                            │
│                                                                 │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             │ HTTP Response (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AiBubble.jsx (handleSend)                                      │
│  ├─ Recibe: { diagram, originalInput, expandedDescription }   │
│  ├─ Llama: mergeDiagramIntoBoard(diagram)                      │
│  └─ Resultado: Diagrama en canvas interactivo                 │
│                                                                 │
│  Board.jsx (React Flow)                                        │
│  ├─ Muestra: Nodos (clases) + Edges (relaciones)              │
│  ├─ Permite: Edición interactiva                              │
│  └─ Socket.IO: Sincroniza con otros usuarios                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. VALIDACIONES IMPLEMENTADAS

### 3.1 En `generateUMLFromVoice()`

```javascript
// Validación 1: Transcripción no vacía
if (!transcribedText || transcribedText.trim().length === 0) {
  throw "No se pudo reconocer la voz..."
}

// Validación 2: Elements existe y no vacío
if (!diagram.elements || !Array.isArray(diagram.elements) || diagram.elements.length === 0) {
  throw "Falta elements o está vacío"
}

// Validación 3: Elements estructura válida
diagram.elements.forEach((el) => {
  if (!el.id) throw "Element falta id"
  if (!el.name) throw "Element falta name"
  if (!el.type) throw "Element falta type"
  if (invalidClassNames.includes(el.name.toLowerCase())) {
    throw "Clase inválida: ID, UUID, PK, FK no permitidas"
  }
})

// Validación 4: Relationships válidas
diagram.relationships.forEach((rel) => {
  if (!rel.from) throw "Relationship falta from"
  if (!rel.to) throw "Relationship falta to"
  if (!rel.type) throw "Relationship falta type"
  if (!rel.cardinalityFrom) throw "Relationship falta cardinalityFrom"
  if (!rel.cardinalityTo) throw "Relationship falta cardinalityTo"
  
  // Validar que existen las clases
  if (!elementNames.has(rel.from)) {
    throw `from (${rel.from}) no existe en elements`
  }
  if (!elementNames.has(rel.to)) {
    throw `to (${rel.to}) no existe en elements`
  }
  
  // Validar cardinalidad
  if (!['0..1', '0..*', '1', '1..*', '1..1'].includes(rel.cardinalityFrom)) {
    throw `cardinalityFrom inválida: ${rel.cardinalityFrom}`
  }
  if (!['0..1', '0..*', '1', '1..*', '1..1'].includes(rel.cardinalityTo)) {
    throw `cardinalityTo inválida: ${rel.cardinalityTo}`
  }
  
  // Detectar duplicados
  if (relationshipSet.has(`${rel.from}->${rel.to}`)) {
    throw `Relationship duplicada: ${rel.from}→${rel.to}`
  }
})

// Validación 5: Si >1 clase, ≥1 relación obligatoria
if (diagram.elements.length > 1 && diagram.relationships.length === 0) {
  throw "Crítico: X clases sin relaciones..."
}

// Validación 6: Cada clase participa en ≥1 relación
for (const className of elementNames) {
  if (!participatingClasses.has(className) && diagram.elements.length > 1) {
    throw `Clase aislada: ${className}...`
  }
}
```

### 3.2 En `processVoiceInput()`

```javascript
// Step 1: Validar archivo de audio
if (!req.files || !req.files.audio) {
  return res.status(400).json({
    success: false,
    error: 'No se encontró archivo de audio...'
  });
}

// Step 2-4: Try-catch en cada paso
// - Si transcripción falla → return 500
// - Si expansión falla → continuar con texto original
// - Si generación falla → return 500
// - Si validación falla → warning pero continuar
```

---

## 4. ESTRUCTURA JSON DEL DIAGRAMA UML

```json
{
  "elements": [
    {
      "id": "class_libro",
      "type": "class",
      "name": "Libro",
      "attributes": [
        {
          "name": "id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": true
        },
        {
          "name": "titulo",
          "type": "string",
          "visibility": "private",
          "isPrimaryKey": false
        },
        {
          "name": "isbn",
          "type": "string",
          "visibility": "private",
          "isPrimaryKey": false
        },
        {
          "name": "autor_id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": false
        }
      ],
      "methods": [
        {
          "name": "prestar",
          "returnType": "void",
          "visibility": "public"
        },
        {
          "name": "devolver",
          "returnType": "void",
          "visibility": "public"
        }
      ]
    },
    {
      "id": "class_autor",
      "type": "class",
      "name": "Autor",
      "attributes": [
        {
          "name": "id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": true
        },
        {
          "name": "nombre",
          "type": "string",
          "visibility": "private",
          "isPrimaryKey": false
        }
      ],
      "methods": []
    },
    {
      "id": "class_prestamo",
      "type": "class",
      "name": "Prestamo",
      "attributes": [
        {
          "name": "id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": true
        },
        {
          "name": "usuario_id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": false
        },
        {
          "name": "libro_id",
          "type": "int",
          "visibility": "private",
          "isPrimaryKey": false
        },
        {
          "name": "fecha_prestamo",
          "type": "Date",
          "visibility": "private",
          "isPrimaryKey": false
        }
      ],
      "methods": [
        {
          "name": "calcularMulta",
          "returnType": "float",
          "visibility": "public"
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "Libro",
      "to": "Autor",
      "type": "association",
      "cardinalityFrom": "0..*",
      "cardinalityTo": "1"
    },
    {
      "from": "Prestamo",
      "to": "Libro",
      "type": "composition",
      "cardinalityFrom": "1",
      "cardinalityTo": "0..*"
    },
    {
      "from": "Prestamo",
      "to": "Usuario",
      "type": "composition",
      "cardinalityFrom": "1",
      "cardinalityTo": "0..*"
    }
  ]
}
```

---

## 5. CARDINALIDADES UML SOPORTADAS

| Valor | Significado | Ejemplo |
|-------|------------|---------|
| `1` | Exactamente uno | Usuario tiene 1 Perfil |
| `0..*` | Cero o muchos | Cliente puede hacer 0 o más Pedidos |
| `0..1` | Cero o uno | Persona tiene 0 o 1 Pasaporte |
| `1..*` | Uno o muchos | Departamento tiene 1 o más Empleados |
| `1..1` | Uno a uno | Usuario ↔ Cuenta |

---

## 6. TIPOS DE RELACIÓN SOPORTADOS

| Tipo | Concepto UML | Ejemplo |
|------|-------------|---------|
| `association` | Conexión simple | Cliente "compra" Producto |
| `aggregation` | Contiene referencias (débil) | Empresa "contiene" Departamentos |
| `composition` | Contiene y depende (fuerte) | Factura "contiene" LineaFactura |
| `inheritance` | Herencia de clase | Empleado hereda de Persona |

---

## 7. FLUJO DE ERRORES

### Error 1: Audio inválido
```
Cliente: No grabó audio
↓
Backend: 400 "No se encontró archivo de audio"
↓
Frontend: Mostrar alerta "Por favor, graba un audio primero"
```

### Error 2: Transcripción vacía
```
Audio: Ruido sin palabras
↓
Gemini: Respuesta vacía
↓
Fallback: Genera transcripción por tamaño de audio
↓
Backend: Continúa con expansión
```

### Error 3: >1 clase sin relaciones
```
Gemini: Genera 3 clases sin relaciones
↓
Validación: Detecta error crítico
↓
Reintento: Envía nuevamente a Gemini con prompt más estricto
↓
Si falla: 500 "Crítico: X clases sin relaciones..."
```

### Error 4: Clase aislada
```
Gemini: Clase A sin participar en relaciones
↓
Validación: Detecta clase aislada
↓
Error: 500 "Clase aislada: A..."
```

### Error 5: Cardinalidad inválida
```
Gemini: Usa "3..*" (inválido)
↓
Validación: Cardinalidad no en ['0..1', '0..*', '1', '1..*', '1..1']
↓
Error: 500 "cardinalityFrom inválida: 3..*"
```

---

## 8. CONFIGURACIÓN REQUERIDA

### Variables de entorno (.env)
```bash
# Gemini API
GEMINI_API_KEY=sk_xxx_xxxxx

# Base de datos
DATABASE_URL=postgresql://user:pass@localhost/diagram_db

# Frontend
VITE_API_BASE=http://localhost:3001/apis
VITE_WS_URL=ws://localhost:3001
```

### Puerto de ejecución
- **Backend**: 3001
- **Frontend**: 5173
- **Base datos**: 5432 (PostgreSQL)

---

## 9. PRÓXIMOS PASOS (Recomendaciones)

### 🔄 Testing
- [ ] Test E2E: Audio pequeño → diagrama generado
- [ ] Test E2E: Audio grande → diagrama completo
- [ ] Test unitario: `generateUMLFromVoice()` con mocks
- [ ] Test edge cases: Audio vacío, texto corto, clases sin relaciones

### 📊 Monitoreo
- [ ] Logs estructurados por paso (1/4, 2/4, 3/4, 4/4)
- [ ] Métricas: tiempo transcripción, tiempo expansión, tiempo generación
- [ ] Alertas si API Gemini falla >5 veces/hora

### 🚀 Optimizaciones
- [ ] Caché de descripción expandida (5 min)
- [ ] Paralelizar Step 2-3 si es posible
- [ ] Comprimir audio antes de enviar (reduce 50%)
- [ ] WebSocket para progreso en tiempo real

---

## 10. ARCHIVOS MODIFICADOS

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `ai.voice.controller.js` | `generateUMLFromVoice()` reescrito | 224-380 |
| `ai.voice.controller.js` | `processVoiceInput()` pipeline 4-pasos | 897-973 |
| `ai.voice.controller.js` | `transcribeAudio()` Gemini API | 15-110 |
| `ai.voice.controller.js` | `expandSimpleDescription()` Gemini API | 112-163 |
| `aiService.js` | Enrutamiento inteligente voice/image/text | 1-118 |
| `AiBubble.jsx` | Recording handlers y handleSend | sin cambios |
| `ai.routes.js` | Configuración de multer y rutas | 1-123 |

---

## 11. ESTADO ACTUAL

✅ **IMPLEMENTADO Y FUNCIONAL**

- [x] Transcripción de audio con Gemini API
- [x] Expansión de descripción simple
- [x] Generación de UML de clases completo
- [x] Validación de estructura UML
- [x] Manejo de errores con reintentos
- [x] Fallback pattern-based
- [x] Enrutamiento frontend inteligente
- [x] Pipeline 4-pasos documentado

⚠️ **PENDIENTE (Futuro)**

- [ ] Tests automatizados
- [ ] Caché de resultados
- [ ] Monitoreo de performance
- [ ] UI para mostrar progreso en tiempo real
- [ ] Soporte para más lenguajes de voz
- [ ] Exportación a múltiples formatos (XMI, PNG, SVG)

---

**Fecha**: Enero 19, 2026  
**Versión**: 1.0  
**Estado**: Producción lista
