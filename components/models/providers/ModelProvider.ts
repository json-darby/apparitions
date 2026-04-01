import { IModelProvider, Suggestion } from '../types';

export class ModelProvider implements IModelProvider {
  private modelId: number;

  constructor(modelId: number = 2) {
    this.modelId = modelId;
  }

  /**
   * Generates suggestions based on the bot's transcript, routed through the backend.
   * @param botTranscript The transcript of what the AI just said.
   * @returns A promise that resolves to an array of suggestions.
   */
  async generateSuggestions(botTranscript: string, scenario?: string): Promise<Suggestion[]> {
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
          scenario: scenario || "START_INTRO"
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
