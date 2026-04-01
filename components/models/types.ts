export interface Suggestion {
  dutch: string;
  english: string;
}

export interface IModelProvider {
  /**
   * Generates suggestions for the next user response.
   * @param botTranscript The transcript of what the AI just said.
   * @param scenario The current scenario (optional).
   */
  generateSuggestions(botTranscript: string, scenario?: string): Promise<Suggestion[]>;
}
