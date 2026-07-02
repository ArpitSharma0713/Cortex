import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
});

export async function initQdrantCollection() {
  const collectionName = process.env.QDRANT_COLLECTION;

  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === collectionName,
  );

  if (!exists) {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: Number(process.env.EMBEDDING_DIMENSION),
        distance: "Cosine",
      },
    });

    console.log(`✅ Qdrant collection '${collectionName}' created`);
  } else {
    console.log(`✅ Qdrant collection '${collectionName}' already exists`);
  }
}