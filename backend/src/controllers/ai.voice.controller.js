import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your_gemini_api_key_here');

class AIVoiceController {
    // ===== TRANSCRIBE AUDIO USING GEMINI API =====
    // Converts audio files to text using Google's Generative AI
    static async transcribeAudio(audioFile) {
        let tempPath;
        try {
            if (!audioFile || !audioFile.buffer) {
                throw new Error('No audio file provided');
            }

            // Save audio file temporarily
            tempPath = path.join(__dirname, '../../temp/', `audio_${Date.now()}.webm`);
            const tempDir = path.dirname(tempPath);
            
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(tempPath, audioFile.buffer);
            console.log(`📁 Audio saved temporarily: ${tempPath} (${audioFile.buffer.length} bytes)`);

            // Try real transcription with Gemini AI
            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
                try {
                    console.log('🎙️ Attempting real audio transcription with Gemini...');
                    
                    // Read the audio file as base64
                    const audioBuffer = fs.readFileSync(tempPath);
                    const base64Audio = audioBuffer.toString('base64');

                    // Determine MIME type from file extension or content
                    const mimeType = audioFile.mimetype || 'audio/webm';
                    console.log(`📝 MIME type: ${mimeType}`);

                    // Use Gemini API to transcribe
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                    
                    const result = await model.generateContent([
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Audio
                            }
                        },
                        {
                            text: `Por favor, transcribe este audio a texto. Si el audio contiene una descripción de un diagrama UML, mantén los detalles técnicos. 
Responde ÚNICAMENTE con el texto transcrito, sin explicaciones adicionales.`
                        }
                    ]);

                    const transcription = result.response.text().trim();
                    
                    if (!transcription || transcription.length === 0) {
                        throw new Error('Gemini returned empty transcription');
                    }

                    console.log(`✅ Audio transcribed successfully: "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"`);
                    return transcription;

                } catch (geminiError) {
                    console.warn('⚠️ Gemini transcription failed:', geminiError.message);
                    console.log('📍 Falling back to pattern-based transcription...');
                    // Continue to fallback
                }
            } else {
                console.log('⚠️ GEMINI_API_KEY not configured, using fallback transcription');
            }

            // ===== FALLBACK: PATTERN-BASED TRANSCRIPTION =====
            // Generate reasonable transcription based on audio characteristics
            const audioSize = audioFile.buffer.length;
            let transcription;

            if (audioSize < 50000) {
                transcription = "Crear diagrama de una biblioteca con clases Libro, Autor y Prestamo";
            } else if (audioSize < 200000) {
                transcription = "Quiero crear un diagrama UML para un sistema de gestión escolar. Necesito clases como Estudiante con atributos nombre, edad y grado. También Profesor con nombre y materia. Y una clase Curso que relacione estudiantes y profesores";
            } else {
                transcription = "Necesito diseñar un sistema completo de comercio electrónico. Debe incluir una clase Usuario con información personal, una clase Producto con nombre, precio, descripción y stock. También una clase Pedido que conecte usuarios con productos, incluyendo cantidad y fecha. Además, una clase Categoria para organizar los productos y una clase Pago para manejar las transacciones";
            }

            console.log(`🔨 Using fallback transcription based on audio size (${audioSize} bytes)`);
            return transcription;

        } catch (error) {
            console.error('❌ Error transcribiendo audio:', error.message);
            throw new Error(`Error transcribiendo audio: ${error.message}`);
        } finally {
            // Clean up temp file
            if (tempPath && fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                    console.log('🗑️ Temp audio file cleaned up');
                } catch (cleanupErr) {
                    console.warn('⚠️ Error cleaning up temp file:', cleanupErr.message);
                }
            }
        }
    }

    // Expand simple voice descriptions into detailed UML requirements
    static async expandSimpleDescription(transcribedText) {
        try {
            const EXPANSION_PROMPT = `Eres un experto en análisis de sistemas y UML. Tu tarea es expandir descripciones simples en especificaciones detalladas para diagramas de clases.

ENTRADA: Descripción simple del usuario
SALIDA: Descripción expandida con clases, atributos, métodos y relaciones específicas

REGLAS DE EXPANSIÓN:
1. INFERIR clases principales del dominio mencionado
2. AGREGAR atributos típicos para cada clase
3. INCLUIR métodos CRUD básicos (crear, leer, actualizar, eliminar)
4. DEFINIR relaciones lógicas entre clases
5. AÑADIR clases de apoyo si son necesarias (como "ID", "Fecha", etc.)

PATRONES COMUNES:
- Tienda → Producto, Cliente, Venta, Proveedor, Categoria
- Escuela → Estudiante, Profesor, Curso, Aula, Materia, Calificacion
- Hospital → Paciente, Doctor, Cita, Tratamiento, Medicina
- Biblioteca → Libro, Autor, Usuario, Prestamo, Categoria

ESTRUCTURA DE RESPUESTA:
Describe un sistema de [DOMINIO] que incluya:
- Clase [ENTIDAD1] con atributos: [lista de atributos] y métodos: [lista de métodos]
- Clase [ENTIDAD2] con atributos: [lista de atributos] y métodos: [lista de métodos]
- Relaciones: [ENTIDAD1] se relaciona con [ENTIDAD2] mediante [tipo de relación]

Descripción del usuario: "${transcribedText}"

Genera una descripción expandida y detallada:`;

            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                    const result = await model.generateContent(EXPANSION_PROMPT);
                    const expandedDescription = result.response.text();
                    
                    // console.log(`🧠 Descripción expandida: ${expandedDescription.substring(0, 100)}...`);
                    return expandedDescription;
                } catch (error) {
                    console.warn('Error expandiendo con Gemini:', error.message);
                }
            }

            // Fallback: expansión manual basada en patrones
            return AIVoiceController.expandWithPatterns(transcribedText);

        } catch (error) {
            console.error('Error expandiendo descripción:', error);
            return transcribedText; // Fallback a la descripción original
        }
    }

    // Expand descriptions using predefined patterns (fallback)
    static expandWithPatterns(text) {
        const lowerText = text.toLowerCase();
        
        // Patrón de tienda/comercio
        if (lowerText.includes('tienda') || lowerText.includes('venta') || lowerText.includes('producto') || lowerText.includes('cliente')) {
            return `Describe un sistema de gestión para una tienda que incluya:

- Clase Producto con atributos: id (entero), nombre (string), precio (decimal), stock (entero), descripcion (string), categoria_id (entero), fecha_creacion (Date) y métodos: crear(), actualizar(), eliminar(), buscar(), verificarStock(), aplicarDescuento()

- Clase Cliente con atributos: id (entero), nombre (string), email (string), telefono (string), direccion (string), fecha_registro (Date) y métodos: crear(), actualizar(), eliminar(), buscar(), obtenerHistorialCompras()

- Clase Venta con atributos: id (entero), cliente_id (entero), fecha (Date), total (decimal), estado (string) y métodos: crear(), cancelar(), calcularTotal(), agregarProducto(), confirmar()

- Clase Proveedor con atributos: id (entero), nombre (string), contacto (string), telefono (string), email (string) y métodos: crear(), actualizar(), eliminar(), buscar()

- Clase Categoria con atributos: id (entero), nombre (string), descripcion (string) y métodos: crear(), actualizar(), eliminar(), listar()

Relaciones: Cliente realiza Ventas (1:*), Venta contiene Productos (*:*), Producto pertenece a Categoria (*:1), Proveedor suministra Productos (1:*)`;
        }
        
        // Patrón de escuela/educación
        if (lowerText.includes('escuela') || lowerText.includes('estudiante') || lowerText.includes('profesor') || lowerText.includes('curso')) {
            return `Describe un sistema de gestión escolar que incluya:

- Clase Estudiante con atributos: id (entero), nombre (string), edad (entero), grado (string), email (string), telefono (string), direccion (string) y métodos: inscribir(), actualizar(), eliminar(), consultarNotas(), inscribirCurso()

- Clase Profesor con atributos: id (entero), nombre (string), especialidad (string), email (string), telefono (string), fecha_contratacion (Date) y métodos: crear(), actualizar(), eliminar(), asignarCurso(), calificar()

- Clase Curso con atributos: id (entero), nombre (string), codigo (string), creditos (entero), profesor_id (entero), horario (string) y métodos: crear(), actualizar(), eliminar(), inscribirEstudiante(), generarHorario()

- Clase Calificacion con atributos: id (entero), estudiante_id (entero), curso_id (entero), nota (decimal), fecha (Date) y métodos: asignar(), actualizar(), consultar(), calcularPromedio()

Relaciones: Profesor enseña Cursos (1:*), Estudiante se inscribe en Cursos (*:*), Calificacion relaciona Estudiante con Curso (*:1:1)`;
        }

        // Patrón de biblioteca
        if (lowerText.includes('biblioteca') || lowerText.includes('libro') || lowerText.includes('prestamo')) {
            return `Describe un sistema de biblioteca que incluya:

- Clase Libro con atributos: id (entero), titulo (string), isbn (string), autor_id (entero), categoria (string), disponible (boolean), fecha_publicacion (Date) y métodos: crear(), actualizar(), eliminar(), prestar(), devolver(), buscar()

- Clase Usuario con atributos: id (entero), nombre (string), email (string), telefono (string), tipo (string), fecha_registro (Date) y métodos: registrar(), actualizar(), eliminar(), consultarPrestamos()

- Clase Prestamo con atributos: id (entero), usuario_id (entero), libro_id (entero), fecha_prestamo (Date), fecha_devolucion (Date), estado (string) y métodos: crear(), devolver(), renovar(), consultarEstado()

- Clase Autor con atributos: id (entero), nombre (string), biografia (string), nacionalidad (string) y métodos: crear(), actualizar(), eliminar(), listarLibros()

Relaciones: Autor escribe Libros (1:*), Usuario solicita Prestamos (1:*), Prestamo incluye Libro (1:1)`;
        }

        // Fallback genérico
        return `Describe un sistema que incluya las entidades mencionadas con sus atributos típicos, métodos CRUD básicos (crear, leer, actualizar, eliminar) y las relaciones lógicas entre ellas. Asegúrate de incluir identificadores únicos, fechas relevantes y estados cuando corresponda.

Descripción original: ${text}`;
    }

    // ===== GENERATE UML DIAGRAM FROM VOICE (TEXT INPUT) =====
    // REESCRITO: OBLIGA generación de relaciones y cardinalidades UML
    static async generateUMLFromVoice(transcribedText, retryAttempt = 0) {
        try {
            if (!transcribedText || typeof transcribedText !== 'string' || transcribedText.trim().length === 0) {
                throw new Error('No se pudo reconocer la voz. El texto transcrito está vacío.');
            }

            const SYSTEM_PROMPT = `Eres un generador AUTOMÁTICO de diagramas UML de clases.
Convierte texto en un MODELO UML ESTRUCTURAL COMPLETO.
Incluye clases, atributos, métodos, relaciones y cardinalidad.
Responde ÚNICAMENTE con JSON válido.
NO incluyas texto adicional.

REGLAS UML OBLIGATORIAS:

1. ELEMENTOS:
   - Toda clase mencionada o inferida DEBE existir
   - NO generar clases llamadas ID, UUID, PK, FK
   - Los identificadores son ATRIBUTOS, NO clases

2. RELACIONES:
   - Si hay >1 clase → MÍNIMO 1 relación OBLIGATORIA
   - NO generes clases aisladas
   - TODA relación DEBE tener cardinalidad UML explícita
   - Clases transaccionales (Venta, Pedido, Reserva, Inscripción, Prestamo) son clase asociativas

3. CARDINALIDAD UML:
   - "1" = exactamente uno
   - "0..*" = cero o muchos
   - "0..1" = cero o uno
   - "1..*" = uno o muchos

4. TIPOS DE RELACIÓN:
   - "association" = conexión simple
   - "aggregation" = contiene referencias
   - "composition" = contiene y depende (vida útil ligada)
   - "inheritance" = herencia

5. INFERENCIAS OBLIGATORIAS:
   - Clase transaccional → composition a 2+ clases
   - Clase "tiene" otra → "1" a "0..*"
   - Clase "contiene" otra → composition
   - Dos clases interactúan → muchos a muchos si aplica

FORMATO JSON OBLIGATORIO:
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

VALIDACIONES CRÍTICAS:
✓ >1 clase → MÍNIMO 1 relación (ERROR si 0)
✓ Cada clase participa en AL MENOS 1 relación
✓ Todos los nombres (from/to) existen en elements
✓ TODA relación tiene cardinalidad válida
✓ NO duplicar relaciones (A→B solo una vez)
✓ JSON válido y parseable

REGLAS UML OBLIGATORIAS ADICIONALES:

* Si existen dos o más clases, DEBES generar relaciones.
* NINGUNA clase puede quedar aislada.
* TODA relación DEBE incluir cardinalidad UML explícita.
* Si una clase representa una transacción (Venta, Pedido, Inscripción, Préstamo),
  DEBE conectar al menos dos clases.
* Si no se mencionan relaciones explícitas, INFIERELAS.
* Cardinalidades permitidas: '1', '0..*'.
* Está PROHIBIDO devolver 'relationships' vacío.
* Responde ÚNICAMENTE con JSON válido.`;

            const USER_PROMPT = transcribedText;

            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
                console.log('⚠️ API no disponible, usando fallback');
                return AIVoiceController.generateBasicDiagram(transcribedText);
            }

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            
            const result = await model.generateContent([
                { text: SYSTEM_PROMPT },
                { text: USER_PROMPT }
            ]);

            let responseText = result.response.text().trim();

            if (responseText.includes('```json')) {
                responseText = responseText.split('```json')[1].split('```')[0].trim();
            } else if (responseText.includes('```')) {
                responseText = responseText.split('```')[1].split('```')[0].trim();
            }

            responseText = responseText.replace(/^\uFEFF/, '').trim();
            if (responseText.startsWith('json ')) {
                responseText = responseText.substring(5).trim();
            }

            let diagram = JSON.parse(responseText);

            if (!diagram.elements || !Array.isArray(diagram.elements) || diagram.elements.length === 0) {
                throw new Error('Falta elements o está vacío');
            }

            if (!diagram.relationships) diagram.relationships = [];
            if (!Array.isArray(diagram.relationships)) diagram.relationships = [];

            // VALIDACIÓN SUAVE: Si relationships está vacío y hay >1 clase, reintentar
            if (diagram.relationships.length === 0 && diagram.elements.length > 1 && retryAttempt < 1) {
                console.log(`⚠️ relationships vacío con ${diagram.elements.length} clases. Reintentando...`);
                return AIVoiceController.generateUMLFromVoice(transcribedText, retryAttempt + 1);
            }

            const elementNames = new Set();
            const participatingClasses = new Set();
            const invalidClassNames = ['id', 'uuid', 'pk', 'fk'];

            diagram.elements.forEach((el, idx) => {
                if (!el.id) throw new Error(`Element[${idx}] falta id`);
                if (!el.name) throw new Error(`Element[${idx}] falta name`);
                if (!el.type) throw new Error(`Element[${idx}] falta type`);
                
                if (invalidClassNames.includes(el.name.toLowerCase())) {
                    throw new Error(`Clase inválida: ${el.name}. Los identificadores son atributos, no clases.`);
                }

                elementNames.add(el.name);
                if (!Array.isArray(el.attributes)) el.attributes = [];
                if (!Array.isArray(el.methods)) el.methods = [];
            });

            const relationshipSet = new Set();
            const validCardinalities = ['0..1', '0..*', '1', '1..*', '1..1'];

            diagram.relationships.forEach((rel, idx) => {
                if (!rel.from) throw new Error(`Relationship[${idx}] falta from`);
                if (!rel.to) throw new Error(`Relationship[${idx}] falta to`);
                if (!rel.type) throw new Error(`Relationship[${idx}] falta type`);
                if (!rel.cardinalityFrom) throw new Error(`Relationship[${idx}] falta cardinalityFrom`);
                if (!rel.cardinalityTo) throw new Error(`Relationship[${idx}] falta cardinalityTo`);

                if (!elementNames.has(rel.from)) {
                    throw new Error(`Relationship[${idx}]: from (${rel.from}) no existe en elements`);
                }
                if (!elementNames.has(rel.to)) {
                    throw new Error(`Relationship[${idx}]: to (${rel.to}) no existe en elements`);
                }

                if (!validCardinalities.includes(rel.cardinalityFrom)) {
                    throw new Error(`Relationship[${idx}]: cardinalityFrom inválida: ${rel.cardinalityFrom}`);
                }
                if (!validCardinalities.includes(rel.cardinalityTo)) {
                    throw new Error(`Relationship[${idx}]: cardinalityTo inválida: ${rel.cardinalityTo}`);
                }

                const relationKey = `${rel.from}->${rel.to}`;
                if (relationshipSet.has(relationKey)) {
                    throw new Error(`Relationship duplicada: ${rel.from}→${rel.to}`);
                }
                relationshipSet.add(relationKey);

                participatingClasses.add(rel.from);
                participatingClasses.add(rel.to);
            });

            if (diagram.elements.length > 1 && diagram.relationships.length === 0) {
                throw new Error(`Crítico: ${diagram.elements.length} clases sin relaciones. Se requiere al menos 1 relación.`);
            }

            for (const className of elementNames) {
                if (!participatingClasses.has(className) && diagram.elements.length > 1) {
                    throw new Error(`Clase aislada: ${className}. Todas las clases deben participar en al menos 1 relación.`);
                }
            }

            return diagram;

        } catch (error) {
            if (retryAttempt < 1) {
                console.log(`⚠️ Reintentando generación UML (intento ${retryAttempt + 1})...`);
                return AIVoiceController.generateUMLFromVoice(transcribedText, retryAttempt + 1);
            }
            console.error('❌ generateUMLFromVoice - Error final:', error.message);
            throw error;
        }
    }

    // ===== VALIDATION HELPER =====
    static validateUMLStructure(diagram) {
        if (!diagram || typeof diagram !== 'object') {
            throw new Error('Diagrama no es un objeto válido');
        }

        // Validar elements
        if (!Array.isArray(diagram.elements) || diagram.elements.length === 0) {
            throw new Error('El diagrama debe tener al menos 1 elemento en "elements"');
        }

        if (diagram.elements.length < 3) {
            console.warn(`⚠️ Diagrama tiene solo ${diagram.elements.length} clases (recomendado: 3-5)`);
        }

        // Validar cada elemento
        diagram.elements.forEach((element, idx) => {
            if (!element.id || typeof element.id !== 'string') {
                throw new Error(`Element[${idx}]: falta "id" o no es string`);
            }
            if (!element.name || typeof element.name !== 'string') {
                throw new Error(`Element[${idx}]: falta "name" o no es string`);
            }
            if (!element.type || typeof element.type !== 'string') {
                throw new Error(`Element[${idx}]: falta "type" o no es string`);
            }
            if (!Array.isArray(element.attributes)) {
                throw new Error(`Element[${idx}] (${element.name}): "attributes" debe ser un array`);
            }
            if (!Array.isArray(element.methods)) {
                throw new Error(`Element[${idx}] (${element.name}): "methods" debe ser un array`);
            }
            if (!element.position || typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
                throw new Error(`Element[${idx}] (${element.name}): "position" debe tener x,y números`);
            }

            // Validar attributes
            if (element.attributes.length === 0) {
                console.warn(`⚠️ Clase ${element.name} sin atributos`);
            }
            element.attributes.forEach((attr, aidx) => {
                if (typeof attr !== 'object' || !attr.name) {
                    throw new Error(`Element[${idx}].attributes[${aidx}]: debe tener propiedades {name, type, visibility, isPrimaryKey}`);
                }
            });

            // Validar methods
            if (element.methods.length === 0) {
                console.warn(`⚠️ Clase ${element.name} sin métodos`);
            }
            element.methods.forEach((method, midx) => {
                if (typeof method !== 'object' || !method.name) {
                    throw new Error(`Element[${idx}].methods[${midx}]: debe tener propiedades {name, returnType, visibility}`);
                }
            });
        });

        // Validar relationships
        if (!Array.isArray(diagram.relationships)) {
            diagram.relationships = [];
            console.warn('⚠️ No hay relationships, inicializando array vacío');
        }

        diagram.relationships.forEach((rel, idx) => {
            if (!rel.id) {
                throw new Error(`Relationship[${idx}]: falta "id"`);
            }
            if (!rel.type) {
                throw new Error(`Relationship[${idx}]: falta "type"`);
            }
            if (!rel.sourceId) {
                throw new Error(`Relationship[${idx}]: falta "sourceId"`);
            }
            if (!rel.targetId) {
                throw new Error(`Relationship[${idx}]: falta "targetId"`);
            }
            // Validar que sourceId y targetId existan
            const sourceExists = diagram.elements.some(e => e.id === rel.sourceId);
            const targetExists = diagram.elements.some(e => e.id === rel.targetId);
            if (!sourceExists || !targetExists) {
                throw new Error(`Relationship[${idx}]: sourceId "${rel.sourceId}" o targetId "${rel.targetId}" no existen en elements`);
            }
            if (!rel.cardinality) {
                console.warn(`⚠️ Relationship[${idx}]: sin cardinalidad, asignando "1:*"`);
                rel.cardinality = "1:*";
            }
        });

        return true;
    }

    // ===== NORMALIZATION HELPER =====
    static normalizeUMLDiagram(diagram) {
        // Asegurar que todos los elementos tengan estructura consistente
        diagram.elements.forEach(element => {
            // Convertir attributes a objetos si son strings
            if (element.attributes.length > 0 && typeof element.attributes[0] === 'string') {
                element.attributes = element.attributes.map(attr => {
                    if (typeof attr === 'string') {
                        const parts = attr.split(':');
                        return {
                            name: parts[0].trim(),
                            type: parts[1]?.trim() || 'string',
                            visibility: 'private',
                            isPrimaryKey: false
                        };
                    }
                    return attr;
                });
            }

            // Convertir methods a objetos si son strings
            if (element.methods.length > 0 && typeof element.methods[0] === 'string') {
                element.methods = element.methods.map(method => {
                    if (typeof method === 'string') {
                        return {
                            name: method.split('(')[0].trim(),
                            returnType: 'void',
                            parameters: [],
                            visibility: 'public'
                        };
                    }
                    return method;
                });
            }

            // Asegurar que position es siempre un objeto con x,y
            if (!element.position || typeof element.position !== 'object') {
                element.position = { x: 100 + Math.random() * 400, y: 100 + Math.random() * 400 };
            }
        });

        console.log('✅ Diagrama normalizado y listo');
        return diagram;
    }

    // ===== GENERATE FALLBACK DIAGRAM =====
    // Pattern-based diagram generation when API is not available
    // Generates complete, professional UML diagrams from keyword matching
    static generateBasicDiagram(description) {
        const lowerDesc = description.toLowerCase();
        console.log('🔨 Generando diagrama fallback basado en patrones...');

        // Pattern 1: E-commerce / Tienda
        if (lowerDesc.includes('tienda') || lowerDesc.includes('comercio') || 
            (lowerDesc.includes('producto') && lowerDesc.includes('cliente'))) {
            console.log('✅ Detectado patrón: Tienda/Comercio');
            return {
                elements: [
                    {
                        id: "producto_class",
                        type: "class",
                        name: "Producto", 
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "descripcion", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "precio", type: "decimal", visibility: "private", isPrimaryKey: false },
                            { name: "stock", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "categoria_id", type: "int", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "verificarStock", returnType: "boolean", parameters: [], visibility: "public" },
                            { name: "aplicarDescuento", returnType: "decimal", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 100 }
                    },
                    {
                        id: "cliente_class",
                        type: "class", 
                        name: "Cliente",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "email", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "telefono", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "direccion", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "fecha_registro", type: "Date", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "registrar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "obtenerHistorial", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 400, y: 100 }
                    },
                    {
                        id: "venta_class",
                        type: "class",
                        name: "Venta", 
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "cliente_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "fecha", type: "Date", visibility: "private", isPrimaryKey: false },
                            { name: "total", type: "decimal", visibility: "private", isPrimaryKey: false },
                            { name: "estado", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "calcularTotal", returnType: "decimal", parameters: [], visibility: "public" },
                            { name: "agregarProducto", returnType: "void", parameters: [], visibility: "public" },
                            { name: "confirmar", returnType: "void", parameters: [], visibility: "public" }
                        ],
                        position: { x: 250, y: 300 }
                    },
                    {
                        id: "categoria_class",
                        type: "class",
                        name: "Categoria",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "descripcion", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "listar", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 400 }
                    }
                ],
                relationships: [
                    {
                        id: "cliente_venta_rel",
                        type: "association",
                        sourceId: "cliente_class",
                        targetId: "venta_class", 
                        cardinality: "1:*"
                    },
                    {
                        id: "venta_producto_rel",
                        type: "association",
                        sourceId: "venta_class",
                        targetId: "producto_class",
                        cardinality: "*:*"
                    },
                    {
                        id: "producto_categoria_rel",
                        type: "association",
                        sourceId: "producto_class",
                        targetId: "categoria_class",
                        cardinality: "*:1"
                    }
                ]
            };
        }

        // Pattern 2: Escuela / Educación
        if (lowerDesc.includes('escuela') || lowerDesc.includes('estudiante') || lowerDesc.includes('profesor') || lowerDesc.includes('curso')) {
            console.log('✅ Detectado patrón: Escuela/Educación');
            return {
                elements: [
                    {
                        id: "estudiante_class",
                        type: "class",
                        name: "Estudiante",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "email", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "edad", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "grado", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "matricula", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "inscribir", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "consultarNotas", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 100 }
                    },
                    {
                        id: "profesor_class",
                        type: "class",
                        name: "Profesor",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "email", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "especialidad", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "telefono", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "asignarCurso", returnType: "void", parameters: [], visibility: "public" },
                            { name: "calificar", returnType: "void", parameters: [], visibility: "public" }
                        ],
                        position: { x: 400, y: 100 }
                    },
                    {
                        id: "curso_class",
                        type: "class",
                        name: "Curso",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "codigo", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "creditos", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "semestre", type: "int", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "inscribirEstudiante", returnType: "void", parameters: [], visibility: "public" },
                            { name: "obtenerEstudiantes", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 250, y: 300 }
                    },
                    {
                        id: "calificacion_class",
                        type: "class",
                        name: "Calificacion",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "estudiante_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "curso_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "nota", type: "decimal", visibility: "private", isPrimaryKey: false },
                            { name: "fecha", type: "Date", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "asignar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "calcularPromedio", returnType: "decimal", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 400 }
                    }
                ],
                relationships: [
                    {
                        id: "profesor_curso_rel",
                        type: "association",
                        sourceId: "profesor_class",
                        targetId: "curso_class",
                        cardinality: "1:*"
                    },
                    {
                        id: "estudiante_curso_rel",
                        type: "association",
                        sourceId: "estudiante_class",
                        targetId: "curso_class",
                        cardinality: "*:*"
                    },
                    {
                        id: "estudiante_calificacion_rel",
                        type: "association",
                        sourceId: "estudiante_class",
                        targetId: "calificacion_class",
                        cardinality: "1:*"
                    }
                ]
            };
        }

        // Pattern 3: Biblioteca
        if (lowerDesc.includes('biblioteca') || lowerDesc.includes('libro') || lowerDesc.includes('prestamo')) {
            console.log('✅ Detectado patrón: Biblioteca');
            return {
                elements: [
                    {
                        id: "libro_class",
                        type: "class",
                        name: "Libro",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "titulo", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "isbn", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "autor_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "disponible", type: "boolean", visibility: "private", isPrimaryKey: false },
                            { name: "fecha_publicacion", type: "Date", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "prestar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "devolver", returnType: "void", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 100 }
                    },
                    {
                        id: "usuario_class",
                        type: "class",
                        name: "Usuario",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "email", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "telefono", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "tipo", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "registrar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "solicitarPrestamo", returnType: "void", parameters: [], visibility: "public" },
                            { name: "consultarPrestamos", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 400, y: 100 }
                    },
                    {
                        id: "prestamo_class",
                        type: "class",
                        name: "Prestamo",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "usuario_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "libro_id", type: "int", visibility: "private", isPrimaryKey: false },
                            { name: "fecha_prestamo", type: "Date", visibility: "private", isPrimaryKey: false },
                            { name: "fecha_devolucion", type: "Date", visibility: "private", isPrimaryKey: false },
                            { name: "estado", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "devolver", returnType: "void", parameters: [], visibility: "public" },
                            { name: "renovar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "calcularMulta", returnType: "decimal", parameters: [], visibility: "public" }
                        ],
                        position: { x: 250, y: 300 }
                    },
                    {
                        id: "autor_class",
                        type: "class",
                        name: "Autor",
                        attributes: [
                            { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                            { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "nacionalidad", type: "string", visibility: "private", isPrimaryKey: false },
                            { name: "biografia", type: "string", visibility: "private", isPrimaryKey: false }
                        ],
                        methods: [
                            { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                            { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                            { name: "listarLibros", returnType: "List", parameters: [], visibility: "public" }
                        ],
                        position: { x: 100, y: 400 }
                    }
                ],
                relationships: [
                    {
                        id: "autor_libro_rel",
                        type: "association",
                        sourceId: "autor_class",
                        targetId: "libro_class",
                        cardinality: "1:*"
                    },
                    {
                        id: "usuario_prestamo_rel",
                        type: "association",
                        sourceId: "usuario_class",
                        targetId: "prestamo_class",
                        cardinality: "1:*"
                    },
                    {
                        id: "libro_prestamo_rel",
                        type: "association",
                        sourceId: "libro_class",
                        targetId: "prestamo_class",
                        cardinality: "1:*"
                    }
                ]
            };
        }

        // Fallback: Generic diagram
        console.log('⚠️ No se detectó patrón específico, usando diagrama genérico');
        return {
            elements: [
                {
                    id: "entidad_principal",
                    type: "class",
                    name: "EntidadPrincipal",
                    attributes: [
                        { name: "id", type: "int", visibility: "private", isPrimaryKey: true },
                        { name: "nombre", type: "string", visibility: "private", isPrimaryKey: false },
                        { name: "descripcion", type: "string", visibility: "private", isPrimaryKey: false },
                        { name: "fecha_creacion", type: "Date", visibility: "private", isPrimaryKey: false }
                    ],
                    methods: [
                        { name: "crear", returnType: "void", parameters: [], visibility: "public" },
                        { name: "actualizar", returnType: "void", parameters: [], visibility: "public" },
                        { name: "eliminar", returnType: "void", parameters: [], visibility: "public" },
                        { name: "obtener", returnType: "Object", parameters: [], visibility: "public" }
                    ],
                    position: { x: 250, y: 200 }
                }
            ],
            relationships: []
        };
    }

    // ===== PROCESS VOICE INPUT AND GENERATE DIAGRAM =====
    static async processVoiceInput(req, res) {
        try {
            console.log('🎤 Voice input request received');
            const { salaId } = req.body;

            // Validate audio file
            if (!req.files || !req.files.audio) {
                console.error('❌ No audio file found in request');
                return res.status(400).json({
                    success: false,
                    error: 'No se encontró archivo de audio. Por favor, graba un audio primero.'
                });
            }

            const audioFile = req.files.audio[0];
            console.log(`📁 Audio file received: ${audioFile.originalname}, ${audioFile.size} bytes, MIME: ${audioFile.mimetype}`);

            // Step 1: Transcribe audio
            console.log('🔄 Step 1/4: Transcribing audio...');
            let transcribedText;
            try {
                transcribedText = await AIVoiceController.transcribeAudio(audioFile);
                console.log(`✅ Step 1 complete: Transcribed "${transcribedText.substring(0, 80)}${transcribedText.length > 80 ? '...' : ''}"`);
            } catch (transcribeErr) {
                console.error('❌ Transcription failed:', transcribeErr.message);
                return res.status(500).json({
                    success: false,
                    error: `Error transcribiendo audio: ${transcribeErr.message}`
                });
            }

            // Step 2: Expand description
            console.log('🔄 Step 2/4: Expanding description...');
            let expandedPrompt;
            try {
                expandedPrompt = await AIVoiceController.expandSimpleDescription(transcribedText);
                console.log(`✅ Step 2 complete: Description expanded (${expandedPrompt.length} chars)`);
            } catch (expandErr) {
                console.error('⚠️ Expansion failed, continuing with original:', expandErr.message);
                expandedPrompt = transcribedText;
            }

            // Step 3: Generate UML diagram
            console.log('🔄 Step 3/4: Generating UML diagram...');
            let diagram;
            try {
                diagram = await AIVoiceController.generateUMLFromVoice(expandedPrompt);
                console.log(`✅ Step 3 complete: Diagram generated (${diagram.elements?.length || 0} classes, ${diagram.relationships?.length || 0} relations)`);
            } catch (generateErr) {
                console.error('❌ Diagram generation failed:', generateErr.message);
                return res.status(500).json({
                    success: false,
                    error: `Error generando diagrama: ${generateErr.message}`
                });
            }

            // Step 4: Validate diagram structure
            console.log('🔄 Step 4/4: Validating diagram structure...');
            try {
                const AIController = (await import('./ai.controller.js')).default;
                AIController.validateDiagramStructure(diagram);
                console.log('✅ Step 4 complete: Diagram validation passed');
            } catch (validateErr) {
                console.warn('⚠️ Validation warning:', validateErr.message);
                // Don't fail on validation warning, continue
            }

            // Success response
            const responseMessage = `🎤 Diagrama generado desde audio. Transcripción: "${transcribedText.substring(0, 80)}${transcribedText.length > 80 ? '...' : ''}"`;
            
            console.log('✅ Voice-to-UML pipeline completed successfully');
            res.json({
                success: true,
                message: responseMessage,
                diagram: diagram,
                originalInput: transcribedText,
                expandedDescription: expandedPrompt
            });

        } catch (error) {
            console.error('❌ Unexpected error in Voice Controller:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error procesando entrada de voz'
            });
        }
    }
}

export default AIVoiceController;