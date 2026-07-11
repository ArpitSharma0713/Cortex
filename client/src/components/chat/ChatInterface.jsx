import React from "react";
import { useStreamingQuery } from "../../hooks/useStreamingQuery";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

export default function ChatInterface({ onUnauthorized, token, workspaceId }) {
  const { error, isStreaming, messages, sendQuestion } = useStreamingQuery(
    workspaceId,
    token,
    onUnauthorized,
  );

  return (
    <section className="chat-panel">
      <div className="chat-header">
        <div>
          <h2>Ask Cortex</h2>
          <p>{messages.filter((message) => message.role === "assistant").length} answers</p>
        </div>
      </div>
      <MessageList messages={messages} />
      {error && <p className="form-error">{error}</p>}
      <ChatInput disabled={isStreaming} onSend={sendQuestion} />
    </section>
  );
}
