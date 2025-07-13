"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const MyModelAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const firstContent = messages[0].content[0];
    if (firstContent && firstContent.type === "text") {
      const result = await fetch("https://quatar-legal-chatbot.duckdns.org/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // forward the messages in the chat to the API
        body: JSON.stringify({
          user_query: firstContent.text,
        }),
        // if the user hits the "cancel" button or escape keyboard key, cancel the request
        signal: abortSignal,
      });

      const data = await result.json();
      const response = data.final_memo;
      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: "No TEXT",
        },
      ],
    };
  },
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const runtime = useLocalRuntime(MyModelAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
