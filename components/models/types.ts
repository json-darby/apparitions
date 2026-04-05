import { Message } from '../../types';

export interface Suggestion {
  dutch: string;
  english: string;
}

export interface IModelProvider {
  /**
   * Generates suggestions based on the bot's transcript, routed through the backend.
   * @param botTranscript The transcript of what the AI just said.
   * @param scenario The current scenario (optional).
   * @param chatHistory The full conversation history (optional).
   * @returns A promise that resolves to an array of suggestions.
   */
  generateSuggestions(botTranscript: string, scenario?: string, chatHistory?: Message[]): Promise<Suggestion[]>;
}
