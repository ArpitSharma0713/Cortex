import React from "react";

export default function SourceCard({ source }) {
  return (
    <button className="source-card" type="button">
      <div className="source-card-header">
        <span className="source-score">
          {Math.round((source.relevanceScore || 0) * 100)}% match
        </span>
        {source.pageNumber && (
          <span className="source-page">Page {source.pageNumber}</span>
        )}
      </div>
      <p className="source-excerpt">{source.excerpt}...</p>
    </button>
  );
}
