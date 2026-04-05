import { IModelProvider, Suggestion } from '../types';
import { Message } from '../../../types';

export class ModelProvider implements IModelProvider {
  private modelId: number;

  constructor(modelId: number = 2) {
    this.modelId = modelId;
  }

  /**
   * Generates suggestions based on the bot's transcript, routed through the backend.
   * @param botTranscript The transcript of what the AI just said.
   * @param scenario The current scenario (optional).
   * @param chatHistory The full conversation history (optional).
   * @returns A promise that resolves to an array of suggestions.
   */
  async generateSuggestions(botTranscript: string, scenario?: string, chatHistory?: Message[]): Promise<Suggestion[]> {
    if (!botTranscript || !botTranscript.trim()) return [];

    try {
      const response = await fetch('/api/whisper/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_transcript: botTranscript,
          model: this.modelId,
          scenario: scenario || "START_INTRO",
          chat_history: chatHistory ? chatHistory.map(m => ({ sender: m.sender, text: m.text })) : []
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.suggestions || [];

    } catch (err: any) {
      console.error("ModelProvider failed to fetch suggestions from backend:", err);
      return [];
    }
  }
}
