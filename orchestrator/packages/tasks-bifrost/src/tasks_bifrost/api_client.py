"""HTTP client for the Bifrost API."""

import logging

logger = logging.getLogger(__name__)


class BifrostAPIClient:
    """HTTP client for Bifrost API operations."""

    def __init__(self, base_url: str = "http://localhost:8000", timeout: int = 30) -> None:
        """Initialize the API client.

        Args:
            base_url: Base URL of the Bifrost API server
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def fetch_ready_runes(self) -> list[dict]:
        """Fetch runes that are ready for execution.

        Returns:
            List of rune dictionaries
        """
        import requests

        params = {
            "status": "open",
            "blocked": "false",
            "is_saga": "false",
        }

        url = f"{self.base_url}/runes"
        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch ready runes: %s", exc)
            return []

    def fetch_rune_detail(self, rune_id: str) -> dict | None:
        """Fetch detailed information about a specific rune.

        Args:
            rune_id: Unique rune identifier

        Returns:
            Rune detail dictionary or None if not found
        """
        import requests

        url = f"{self.base_url}/rune"
        params = {"id": rune_id}

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            logger.error("Failed to fetch rune detail for %s: %s", rune_id, exc)
            return None

    def claim_rune(self, rune_id: str, claimant: str) -> bool:
        """Claim a rune for execution.

        Args:
            rune_id: Unique rune identifier
            claimant: Identifier for the claimant

        Returns:
            True if claim was successful
        """
        import requests

        url = f"{self.base_url}/claim-rune"
        payload = {"id": rune_id, "claimant": claimant}

        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return True
        except requests.RequestException as exc:
            logger.error("Failed to claim rune %s: %s", rune_id, exc)
            return False

    def unclaim_rune(self, rune_id: str) -> bool:
        """Unclaim a rune.

        Args:
            rune_id: Unique rune identifier

        Returns:
            True if unclaim was successful
        """
        import requests

        url = f"{self.base_url}/unclaim-rune"
        payload = {"id": rune_id}

        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return True
        except requests.RequestException as exc:
            logger.error("Failed to unclaim rune %s: %s", rune_id, exc)
            return False

    def fulfill_rune(self, rune_id: str) -> bool:
        """Mark a rune as fulfilled.

        Args:
            rune_id: Unique rune identifier

        Returns:
            True if fulfill was successful
        """
        import requests

        url = f"{self.base_url}/fulfill-rune"
        payload = {"id": rune_id}

        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return True
        except requests.RequestException as exc:
            logger.error("Failed to fulfill rune %s: %s", rune_id, exc)
            return False

    def add_note(self, rune_id: str, text: str) -> bool:
        """Add a note to a rune.

        Args:
            rune_id: Unique rune identifier
            text: Note text content

        Returns:
            True if note was added successfully
        """
        import requests

        url = f"{self.base_url}/add-note"
        payload = {"rune_id": rune_id, "text": text}

        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return True
        except requests.RequestException as exc:
            logger.error("Failed to add note to rune %s: %s", rune_id, exc)
            return False
