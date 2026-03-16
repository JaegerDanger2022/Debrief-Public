from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_url: str = "postgresql://debrief:debrief@localhost:5432/debrief"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "amazon.nova-sonic-v1:0"
    bedrock_text_model_id: str = "amazon.nova-lite-v1:0"  # text LLM for post-session analysis
    bedrock_embed_model_id: str = "amazon.titan-embed-text-v2:0"


@lru_cache
def get_agent_settings() -> AgentSettings:
    return AgentSettings()
