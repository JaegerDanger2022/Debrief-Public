from debrief_agent.config import get_agent_settings


class VectorStore:
    """pgvector-based semantic similarity store for topic embeddings.

    Used by memory_retriever to find past sessions with emotionally similar topics.
    Requires the pgvector extension to be installed in PostgreSQL.
    """

    def __init__(self):
        self._pool = None

    async def connect(self) -> None:
        import asyncpg
        settings = get_agent_settings()
        self._pool = await asyncpg.create_pool(settings.postgres_url)

    async def embed_text(self, text: str) -> list[float]:
        """Generate an embedding for text using Amazon Titan Embed via Bedrock."""
        import boto3, json
        settings = get_agent_settings()
        client = boto3.client(
            "bedrock-runtime",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        response = client.invoke_model(
            modelId=settings.bedrock_embed_model_id,
            body=json.dumps({"inputText": text}),
        )
        return json.loads(response["body"].read())["embedding"]

    async def find_similar_sessions(self, user_id: str, query: str, top_k: int = 5) -> list[dict]:
        """Find past sessions with topics semantically similar to query."""
        # TODO: embed query, run pgvector cosine similarity search
        raise NotImplementedError("Vector similarity search not yet implemented")
