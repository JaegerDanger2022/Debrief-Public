from langgraph.graph import StateGraph, START, END

from debrief_agent.state.session_state import SessionState
from debrief_agent.nodes.prosody_analyzer import prosody_analyzer
from debrief_agent.nodes.topic_tracker import topic_tracker
from debrief_agent.nodes.memory_retriever import memory_retriever
from debrief_agent.nodes.insight_router import insight_router
from debrief_agent.nodes.memory_writer import memory_writer


def compile_session_graph():
    """
    Main session graph.

    Flow: prosody_analyzer -> topic_tracker -> memory_retriever -> insight_router -> memory_writer

    - prosody_analyzer: tags emotional markers from Nova Sonic prosody events
    - topic_tracker: extracts topics from transcript
    - memory_retriever: queries past triggers matching current topics
    - insight_router: assembles InsightPayload, flags breakthroughs
    - memory_writer: persists insights and embeddings
    """
    builder = StateGraph(SessionState)

    builder.add_node("prosody_analyzer", prosody_analyzer)
    builder.add_node("topic_tracker", topic_tracker)
    builder.add_node("memory_retriever", memory_retriever)
    builder.add_node("insight_router", insight_router)
    builder.add_node("memory_writer", memory_writer)

    builder.add_edge(START, "prosody_analyzer")
    builder.add_edge("prosody_analyzer", "topic_tracker")
    builder.add_edge("topic_tracker", "memory_retriever")
    builder.add_edge("memory_retriever", "insight_router")
    builder.add_edge("insight_router", "memory_writer")
    builder.add_edge("memory_writer", END)

    return builder.compile()
