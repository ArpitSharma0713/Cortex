import React from "react";
import MessageBubble from "./MessageBubble";

export default function MessageList({ messages }) {
  if (messages.length === 0) {
    return <p className="empty-state">Ask a question about this workspace</p>;
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
