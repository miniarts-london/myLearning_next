"""A per-learner daily question limit, so one person (or a bot) can't run up the API bill.

Kept in memory: fine for one server process. With several processes or servers, keep the
counts in shared storage such as Redis instead."""
from __future__ import annotations

import time
from collections import defaultdict


class DailyLimit:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._counts: dict[tuple[str, int], int] = defaultdict(int)

    def _day(self) -> int:
        return int(time.time() // 86400)

    def try_take(self, user: str) -> bool:
        """Counts one question for `user`. False if they've reached today's limit."""
        key = (user, self._day())
        if self._counts[key] >= self.limit:
            return False
        self._counts[key] += 1
        return True

    def remaining(self, user: str) -> int:
        return max(0, self.limit - self._counts[(user, self._day())])
