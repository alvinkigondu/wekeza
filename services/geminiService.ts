import { GoogleGenAI } from "@google/genai";
import { AgentState, Trade } from "../types";

// Initialize Gemini Client
// Note: In a production environment, this would be handled via a secure backend proxy.
// We strictly follow the instruction to use process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateOrchestratorReport = async (
  marketContext: string,
  activeAgents: AgentState[],
  recentTrades: Trade[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("API Key missing. Returning mock data.");
    return "API Key not configured. Using simulation mode... \n\nBased on the OrderFlowAgent's analysis of the recent footprint tensors, we are observing aggressive buying pressure at the VWAP. The VolumeProfileAgent indicates a weak high, suggesting potential mean reversion. Recommendation: Accumulate long positions with tight stops below the Point of Control.";
  }

  try {
    const agentSummaries = activeAgents
      .map(a => `- ${a.role}: ${a.status} (Conf: ${a.confidence}%) - ${a.lastMessage}`)
      .join('\n');

    const tradeContext = recentTrades.slice(0, 5)
      .map(t => `${t.side} ${t.symbol} @ ${t.price}`)
      .join(', ');

    const prompt = `
      You are the StrategyOrchestrator for Wekeza, a high-frequency trading platform.
      
      Current Market Context: ${marketContext}
      
      Agent Statuses:
      ${agentSummaries}
      
      Recent Trades:
      ${tradeContext}
      
      Task:
      Generate a concise, institutional-grade executive summary of the current market structure and strategy. 
      Focus on microstructure signals (order flow, volume profile) and risk management. 
      Keep it under 100 words. Use financial jargon appropriate for a quant fund.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis pending...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Orchestrator connection unstable. Switching to localized heuristic fallback. Maintaining current risk exposure.";
  }
};