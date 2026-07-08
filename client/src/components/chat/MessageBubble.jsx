import ReactMarkdown from "react-markdown";
import SourceCard from "./SourceCard";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`message ${isUser ? "message-user" : "message-assistant"}`}>
      <div className="message-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown>
            {message.content || (message.streaming ? "..." : "")}
          </ReactMarkdown>
        )}
      </div>

      {!isUser && message.sources?.length > 0 && (
        <div className="message-sources">
          {message.sources.map((source) => (
            <SourceCard key={source.chunkId} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

