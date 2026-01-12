
import { GoogleGenAI, Type } from "@google/genai";
import { MachineConfig, Batch, Tool, Thickness } from "../types";

export const optimizeProductionSchedule = async (
  pendingOrders: Batch[],
  machines: MachineConfig[],
  tools: Tool[],
  thicknesses: Thickness[]
) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "") {
    console.error("CRITICAL ERROR: process.env.API_KEY is missing or empty.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Actúa como un experto en Lean Manufacturing y programación de plegado CNC.
    OBJETIVO: Optimizar la carga de máquinas.
    
    DATOS TÉCNICOS:
    - HERRAMENTAL DISPONIBLE: ${JSON.stringify(tools)}
    - ASOCIACIÓN ESPESOR-HERRAMENTAL: ${JSON.stringify(thicknesses)}
    - CAPACIDAD DE MÁQUINAS: ${JSON.stringify(machines)}
    - PEDIDOS A PROGRAMAR: ${JSON.stringify(pendingOrders)}
    
    REGLAS DE PROGRAMACIÓN Y EXCEPCIONES:
    1. EXCEPCIÓN DE SIMULACIÓN (PRIORITARIO): Si un pedido tiene la propiedad 'isSimulation' en true, IGNORE todas las reglas de compatibilidad de espesor y herramental. Estos son pedidos manuales para validar la configuración de la máquina. Prográmelos en la máquina asignada originalmente sin validar su viabilidad técnica.
    
    2. COMPATIBILIDAD DE ESPESOR (Solo para pedidos NO-simulación): Consulta el espesor. Si no existe en la tabla de asociación o no tiene herramientas recomendadas, el pedido es INVIABLE.
    
    3. COMPATIBILIDAD MÁQUINA-HERRAMIENTA (Solo para pedidos NO-simulación): Un pedido solo puede ir a una máquina si la máquina tiene los herramentales requeridos ('compatibleToolIds').
    
    4. CAPACIDAD FÍSICA: El 'length' del pedido no debe superar el 'maxLength' de la máquina (aplica a todos).
    
    5. RESULTADO: Genera un plan secuencial minimizando setups.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
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
        thinkingConfig: { thinkingBudget: 4000 }
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
