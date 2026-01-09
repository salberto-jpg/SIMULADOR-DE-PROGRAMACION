
import { GoogleGenAI, Type } from "@google/genai";
import { MachineConfig, Batch } from "../types";

// Always use the process.env.API_KEY directly for initialization as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getProductionRecommendation = async (
  batchDetails: Partial<Batch>,
  machines: MachineConfig[]
) => {
  try {
    const prompt = `Given the following production batch details:
    Pieces: ${batchDetails.pieces}
    Strikes per piece: ${batchDetails.strikesPerPiece}
    Trams: ${batchDetails.trams}
    
    And the available machines with their configurations:
    ${JSON.stringify(machines, null, 2)}
    
    Which machine would be the most efficient for this specific job and why? Consider efficiency, strike time, and machine specialization. Provide a brief recommendation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Return the generated text using the property directly.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "No se pudo obtener recomendación de IA en este momento.";
  }
};
