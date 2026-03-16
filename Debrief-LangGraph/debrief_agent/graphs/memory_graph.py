from langgraph.graph import StateGraph, START, END

from debrief_agent.state.memory_state import MemoryState
from debrief_agent.nodes.memory_retriever import memory_retriever
from debrief_agent.nodes.memory_writer import memory_writer


def compile_memory_graph():
    """
    Standalone cross-session memory graph.
    Can be used independently to query or update a user's emotional memory store.
    """
    builder = StateGraph(MemoryState)

    builder.add_node("memory_retriever", memory_retriever)
    builder.add_node("memory_writer", memory_writer)

    builder.add_edge(START, "memory_retriever")
    builder.add_edge("memory_retriever", "memory_writer")
    builder.add_edge("memory_writer", END)

    return builder.compile()
