import logging
from typing import Literal

from debrief_agent.state.session_state import SessionState

log = logging.getLogger(__name__)

# Resolution outcome type used to decide post-processing path
ResolutionOutcome = Literal["close_tab", "mobile_notification", "none"]


async def ledger_capture_node(state: SessionState) -> dict:
    """
    Platform-aware ledger capture node.

    Reads the `ledger_item` dict injected into state (if any) and determines
    the correct resolution path:

      - platform == "desktop": sets should_close_tab=True and resolution_outcome="close_tab"
        so the Chrome Extension can be signalled to close the captured tab.

      - platform == "mobile" (standard): sets resolution_outcome="mobile_notification"
        so a push notification can be dispatched to the user's phone.

      - platform == "mobile" + in_app_browser=True: treats the same as desktop because
        the Debrief app's internal WebView grants full window.close() authority.

      - No ledger item: no-op, returns empty update dict.
    """
    ledger_item: dict | None = state.get("ledger_item")
    if not ledger_item:
        log.debug("[ledger_capture] No ledger item in state — skipping")
        return {}

    platform: str = ledger_item.get("platform", "desktop")
    in_app_browser: bool = ledger_item.get("in_app_browser", False)
    item_id: str = ledger_item.get("id", "unknown")

    if platform == "desktop" or (platform == "mobile" and in_app_browser):
        outcome: ResolutionOutcome = "close_tab"
        ledger_item["should_close_tab"] = True
        log.info("[ledger_capture] item=%s platform=%s → outcome=close_tab", item_id, platform)
    elif platform == "mobile":
        outcome = "mobile_notification"
        ledger_item["should_close_tab"] = False
        log.info("[ledger_capture] item=%s platform=mobile → outcome=mobile_notification", item_id)
    else:
        outcome = "none"
        log.warning("[ledger_capture] item=%s unknown platform=%r → outcome=none", item_id, platform)

    return {
        "ledger_item": ledger_item,
        "ledger_resolution_outcome": outcome,
    }
