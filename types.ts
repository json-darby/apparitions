
/**
 * Defines the available conversational scenarios within the engine.
 */
export enum ScenarioType {
  INTRO = 'START_INTRO',
  COFFEE = 'START_COFFEE',
  COMPREHENSION = 'START_COMPREHENSION',
  FREESPEECH = 'START_FREESPEECH'
}

/**
 * The mode in which the apparition responds: either instantly or after a review delay.
 */
export type ResponseMode = 'instant' | 'review';

/**
 * Represents a single message within the conversational history.
 */
export interface Message {
  id: string;
  sender: 'apparition' | 'user' | 'narrator';
  text: string;
  timestamp: Date;
  isCorrect?: boolean;
  translation?: string;
  metadata?: any;
}

/**
 * Maintains the overarching state of the current apparition interaction.
 */
export interface ApparitionState {
  currentScenario: ScenarioType | null;
  history: Message[];
  isLoading: boolean;
  userContext?: string;
  optionalTopic?: string;
}

/**
 * Represents a partial transcription segment for live speech-to-text functionality.
 */
export interface TranscriptionPart {
  text: string;
}
