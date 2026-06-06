import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function draftAdviceSummary(clientName: string, goals: string[], changes: string[]) {
  if (!ai) return "AI capability currently unavailable. Please provide a manual draft.";
  
  const prompt = `
    You are a professional wealth manager at Nexus Wealth Management.
    Draft a concise, friendly, and client-facing summary of financial advice for our client, ${clientName}.
    
    Goals: ${goals.join(", ")}
    Proposed Changes: ${changes.join(", ")}
    
    The tone should be reassuring but professional. Use Markdown for formatting.
    Start with a brief executive summary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI draft. Please check your connection.";
  }
}

export async function explainRiskProfile(score: number) {
  if (!ai) return "Explanation unavailable.";
  
  const prompt = `Explain a risk profile score of ${score} out of 15 in the context of wealth management. Determine if it is Conservative, Moderate, or Aggressive and provide 3 bullet points on what this means for asset allocation.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text;
  } catch (error) {
    return "Error explaining risk profile.";
  }
}
