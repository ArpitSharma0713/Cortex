import React, { useState } from "react";

export default function ChatInput({ disabled, onSend }) {
  const [question, setQuestion] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 3) {
      return;
    }

    onSend(trimmedQuestion);
    setQuestion("");
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        disabled={disabled}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask a question about your documents"
        rows="3"
        value={question}
      />
      <button disabled={disabled || question.trim().length < 3} type="submit">
        {disabled ? "Thinking..." : "Send"}
      </button>
    </form>
  );
}
