import { QdrantClient } from "@qdrant/js-client-rest";

const DEFAULT_EMBEDDING_DIMENSION = 1536;

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export async function initQdrantCollection() {
  const name = process.env.QDRANT_COLLECTION;

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === name,
    );

    if (!exists) {
      await qdrant.createCollection(name, {
        vectors: {
          size: Number.parseInt(
            process.env.EMBEDDING_DIMENSION || `${DEFAULT_EMBEDDING_DIMENSION}`,
            10,
          ),
          distance: "Cosine",
        },
      });
      console.log(`Qdrant collection '${name}' created`);
    } else {
      console.log(`Qdrant collection '${name}' already exists`);
    }
  } catch (error) {
    console.warn("Qdrant unavailable on startup:", error.message);
  }
}
