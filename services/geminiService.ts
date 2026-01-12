
import { GoogleGenAI, Type } from "@google/genai";
import { MachineConfig, Batch, Tool, Thickness } from "../types";

export const optimizeProductionSchedule = async (
  pendingOrders: Batch[],
  machines: MachineConfig[],
  tools: Tool[],
  thicknesses: Thickness[]
) => {
  try {
    // Inicializar la IA justo antes de usarla para asegurar que la API_KEY inyectada esté disponible
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Actúa como un experto en Lean Manufacturing y programación de plegado CNC.
    OBJETIVO: Optimizar la carga de máquinas cumpliendo estrictamente con las capacidades técnicas.
    
    DATOS TÉCNICOS:
    - HERRAMENTAL DISPONIBLE: ${JSON.stringify(tools)}
    - ASOCIACIÓN ESPESOR-HERRAMENTAL: ${JSON.stringify(thicknesses)}
    - CAPACIDAD DE MÁQUINAS: ${JSON.stringify(machines)}
    - PEDIDOS A PROGRAMAR: ${JSON.stringify(pendingOrders)}
    
    REGLAS CRÍTICAS DE PROGRAMACIÓN:
    1. COMPATIBILIDAD DE ESPESOR: Para cada pedido, consulta el espesor en la tabla de ASOCIACIÓN ESPESOR-HERRAMENTAL. Si el espesor no existe o no tiene herramentales recomendados ('recommendedToolIds'), el pedido es INVIABLE.
    2. COMPATIBILIDAD DE MÁQUINA-HERRAMIENTA: Un pedido solo puede ir a una máquina si la máquina tiene los herramentales requeridos en su lista 'compatibleToolIds'. Debes cruzar 'recommendedToolIds' del espesor con 'compatibleToolIds' de la máquina.
    3. CAPACIDAD FÍSICA: El 'length' del pedido no debe superar el 'maxLength' de la máquina.
    4. VALIDACIÓN ESTRICTA: Si un pedido no cumple las reglas 1, 2 o 3, NO lo incluyas en 'plan'. Inclúyelo en 'unschedulable' con una razón técnica detallada (ej: "El espesor 6mm requiere matriz V50 no asociada a la PL-01").
    5. OPTIMIZACIÓN: Agrupa por espesor y herramientas en la misma máquina para minimizar setups. Prioriza por 'priority' y 'deliveryDate'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  batch_id: { type: Type.STRING },
                  machine_id: { type: Type.STRING },
                  scheduled_date: { type: Type.STRING },
                  sequence_order: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING }
                },
                required: ["batch_id", "machine_id", "scheduled_date"]
              }
            },
            unschedulable: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  batch_id: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["batch_id", "reason"]
              }
            }
          }
        },
        thinkingConfig: { thinkingBudget: 6000 }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Optimization Error:", error);
    return null;
  }
};
