import { ScenarioType } from "../types";

const LOCAL_WEBSOCKET_ADDRESS = "ws://127.0.0.1:8080/ws";

export const ai = {
  live: {
    connect: async ({ callbacks, config }: any) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(LOCAL_WEBSOCKET_ADDRESS);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "setup", scenario: config?.scenario || "START_INTRO" }));

          if (callbacks.onopen) callbacks.onopen();
          resolve({
            sendRealtimeInput: (input: any) => {
              if (input.text) {
                ws.send(JSON.stringify({ type: "realtime_input", input: { text: input.text } }));
              } else if (input.audio) {
                ws.send(JSON.stringify({ type: "realtime_input", input: { audio: input.audio } }));
              }
            },
            sendToolResponse: (resp: any) => {
              const functionResponses = resp.functionResponses;
              /*
               * Supports either an array or a single object.
               * The React ChatWindow component sends a single object.
               * Wrap it in an array if necessary.
               */
              let resps = Array.isArray(functionResponses) ? functionResponses : [functionResponses];
              ws.send(JSON.stringify({ type: "tool_response", resp: resps }));
            },
            close: () => {
              ws.close();
            }
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (callbacks.onmessage) callbacks.onmessage(data);
          } catch (err) {
            console.error("WebSocket message parse error", err);
          }
        };

        ws.onerror = (e) => {
          if (callbacks.onerror) callbacks.onerror(e);
          reject(e);
        };

        ws.onclose = () => {
          if (callbacks.onclose) callbacks.onclose();
        };
      });
    }
  }
};

/**
 * Generates the default configuration for local testing.
 * @param scenario The current conversational scenario to load.
 */
export function getLiveConfig(scenario: ScenarioType) {
  return {
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    config: {
      responseModalities: ["AUDIO"],
      scenario: scenario
    }
  };
}
