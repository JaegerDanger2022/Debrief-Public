# debrief-agent

Standalone LangGraph orchestration package for Debrief. Manages conversation state, cross-session memory, and the "Forget Me" purge flow.

## Installation

Install as a local editable dependency from the backend:

```bash
pip install -e ../Debrief-LangGraph
```

## Public API

```python
from debrief_agent import compile_session_graph, compile_forget_me_graph

# Run a session graph after audio processing
graph = compile_session_graph()
result = await graph.ainvoke({
    "session_id": "...",
    "user_id": "...",
    "prosody_events": [...],
    "messages": [],
})

# Purge all user data
forget_graph = compile_forget_me_graph()
await forget_graph.ainvoke({"user_id": "...", "purge_status": "pending", "affected_record_ids": []})
```

## Graph Architecture

```
session_graph:
  START -> prosody_analyzer -> topic_tracker -> memory_retriever -> insight_router -> memory_writer -> END

memory_graph:
  Injected into session_graph via memory_retriever node

forget_me_graph:
  START -> [validate] -> forget_me -> [confirm] -> END
```
