import { useCallback, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function useStreamingQuery(workspaceId, token, onUnauthorized) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const sendQuestion = useCallback(
    async (question) => {
      setError(null);
      setIsStreaming(true);

      const userMessage = {
        role: "user",
        content: question,
        id: crypto.randomUUID(),
      };
      const assistantMessage = {
        role: "assistant",
        content: "",
        sources: [],
        id: crypto.randomUUID(),
        streaming: true,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
        assistantMessage,
      ]);

      function finishAssistant(content = "") {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content, streaming: false }
              : message,
          ),
        );
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/workspaces/${workspaceId}/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
            body: JSON.stringify({ question }),
          },
        );

        if (response.status === 401) {
          finishAssistant();
          onUnauthorized?.();
          return;
        }

        if (response.status === 429) {
          const data = await response.json();
          const message = `Daily limit reached (${data.limit} queries/day)`;
          finishAssistant(message);
          setError(message);
          return;
        }

        if (response.status === 404) {
          finishAssistant("Workspace not found");
          setError("Workspace not found");
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message = data.error || "Could not answer question";
          finishAssistant(message);
          setError(message);
          return;
        }

        if (!response.body) {
          throw new Error("Missing response stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop();

          for (const event of events) {
            if (!event.startsWith("data: ")) {
              continue;
            }

            const payload = JSON.parse(event.slice(6));

            if (payload.type === "token") {
              setMessages((currentMessages) =>
                currentMessages.map((message) =>
                  message.id === assistantMessage.id
                    ? { ...message, content: message.content + payload.content }
                    : message,
                ),
              );
            }

            if (payload.type === "done") {
              setMessages((currentMessages) =>
                currentMessages.map((message) =>
                  message.id === assistantMessage.id
                    ? {
                        ...message,
                        queryId: payload.queryId,
                        sources: payload.sources || [],
                        streaming: false,
                      }
                    : message,
                ),
              );
            }

            if (payload.type === "error") {
              finishAssistant(payload.message);
              setError(payload.message);
            }
          }
        }
      } catch (requestError) {
        finishAssistant("Connection lost. Please try again.");
        setError("Connection lost. Please try again.");
      } finally {
        setIsStreaming(false);
      }
    },
    [workspaceId, token, onUnauthorized],
  );

  return { messages, sendQuestion, isStreaming, error };
}

