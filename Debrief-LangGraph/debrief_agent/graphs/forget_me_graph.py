from langgraph.graph import StateGraph, START, END

from debrief_agent.state.forget_me_state import ForgetMeState
from debrief_agent.nodes.forget_me import forget_me


def _is_complete(state: ForgetMeState) -> str:
    return "complete" if state["purge_status"] == "complete" else "failed"


def compile_forget_me_graph():
    """
    Forget Me purge graph.

    Flow: START -> forget_me -> END (or error node if purge fails)
    """
    builder = StateGraph(ForgetMeState)

    builder.add_node("forget_me", forget_me)
    builder.add_edge(START, "forget_me")
    builder.add_conditional_edges("forget_me", _is_complete, {"complete": END, "failed": END})

    return builder.compile()
