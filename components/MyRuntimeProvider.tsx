// chamza97-chatbot-front/components/MyRuntimeProvider.tsx
"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

// Removed: FETCH_TIMEOUT_MS constant, as we no longer want a frontend timeout.

const MyModelAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    // Find the last user message in the conversation history.
    const lastUserMessage = messages.findLast(
      (msg) => msg.role === "user" && msg.content.length > 0
    );

    let userQuery = "No user text message found."; // Default fallback message

    // Safely extract the text content from the latest user message.
    if (lastUserMessage) {
      const firstContentPart = lastUserMessage.content[0];
      if (firstContentPart && firstContentPart.type === "text") {
        userQuery = firstContentPart.text;
      }
    }

    // If no valid text message was found from the user, return an informative error.
    if (userQuery === "No user text message found.") {
      return {
        content: [
          {
            type: "text",
            text: "Could not process your message. Please ensure you are sending a text message.",
          },
        ],
      };
    }

    // Attempt to send the extracted latest user query to your FastAPI backend.
    try {
      // Removed: AbortController and setTimeout for timeout.
      // The fetch request will now rely solely on the 'abortSignal' provided by Assistant UI
      // (which is typically triggered by the user clicking a "cancel" button).
      const result = await fetch("https://quatar-legal-chatbot.duckdns.org/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // forward the messages in the chat to the API
        body: JSON.stringify({
          user_query: userQuery,
        }),
        // Use the original abortSignal provided by Assistant UI.
        // This signal is typically managed by the Assistant UI's internal cancel logic.
        signal: abortSignal,
      });

      // Removed: clearTimeout(timeoutId); as there's no timeout to clear.

      // Check if the HTTP response was successful.
      if (!result.ok) {
        const errorDetails = await result.text(); // Get response body for more info
        throw new Error(
          `Backend API error: ${result.status} ${result.statusText} - ${errorDetails}`
        );
      }

      const data = await result.json();
      const response = data.final_memo; // Assuming your FastAPI response always has a 'final_memo' field.

      // Return the response from the backend to Assistant UI.
      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    } catch (error) {
      // Removed: clearTimeout(timeoutId); as there's no timeout to clear.

      // Log the error for debugging purposes.
      console.error("Error calling backend:", error);

      // The error message will now reflect network issues, CORS, or backend errors directly.
      // The specific 'AbortError' check for timeout is no longer needed here.
      let errorMessage = `An error occurred while fetching a response: ${
        error instanceof Error ? error.message : String(error)
      }.`;

      return {
        content: [
          {
            type: "text",
            text: errorMessage + " Please try again or simplify your query.",
          },
        ],
      };
    }
  },
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Initialize the local runtime with your custom model adapter.
  const runtime = useLocalRuntime(MyModelAdapter);

  return (
    // Provide the runtime to the Assistant UI components.
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}