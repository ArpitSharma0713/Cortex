import React, { useState } from "react";
import api from "../api/axiosInstance";

function ChatInterface({ accessToken, onUnauthorized, workspaceId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 3) {
      setError("Question must be at least 3 characters");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/query`,
        { question: trimmedQuestion },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          question: trimmedQuestion,
          answer: response.data.answer,
          sources: response.data.sources || [],
        },
      ]);
      setQuestion("");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onUnauthorized();
        return;
      }

      if (requestError.response?.status === 429) {
        setError(
          `Daily query limit reached (${requestError.response.data.limit} per day)`,
        );
        return;
      }

      setError(requestError.response?.data?.error || "Could not answer question");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="chat-section">
      <div className="chat-header">
        <h2>Ask Cortex</h2>
        <p>{messages.length} answered</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="empty-state">Ask a question about this workspace</p>
        )}
        {messages.map((message, index) => (
          <article className="chat-message" key={`${message.question}-${index}`}>
            <p className="chat-question">{message.question}</p>
            <p className="chat-answer">{message.answer}</p>
            {message.sources.length > 0 && (
              <div className="source-grid">
                {message.sources.map((source, sourceIndex) => (
                  <div className="source-card" key={source.chunkId}>
                    <span>Source {sourceIndex + 1}</span>
                    <p>{source.excerpt}</p>
                    <small>
                      Score {Number(source.relevanceScore || 0).toFixed(3)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label>
          Question
          <textarea
            disabled={isLoading}
            onChange={(event) => setQuestion(event.target.value)}
            rows="3"
            value={question}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={isLoading} type="submit">
          {isLoading ? "Asking..." : "Ask"}
        </button>
      </form>
    </section>
  );
}

export default ChatInterface;

