import { IModelProvider, Suggestion } from './types';
import { Message } from '../../types';
import { ModelProvider } from './providers/ModelProvider';

class ShhhSystem {
  private provider: IModelProvider;

  constructor(provider?: IModelProvider) {
    this.provider = provider || new ModelProvider();
  }

  /**
   * Easily swap the provider (e.g., to a Mistral based provider)
   */
  setProvider(provider: IModelProvider) {
    this.provider = provider;
  }

  /**
   * Generates whisper suggestions using the currently configured provider.
   */
  async getWhispers(botTranscript: string, scenario?: string, chatHistory?: Message[]): Promise<Suggestion[]> {
    /* Errors propagate deliberately: the chat view needs to know the difference
       between "the model had nothing" and "the model never answered". */
    return this.provider.generateSuggestions(botTranscript, scenario, chatHistory);
  }
}

// Export a singleton instance of the Shhh system
export const shhh = new ShhhSystem();
