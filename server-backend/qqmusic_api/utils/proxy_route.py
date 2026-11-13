"""Optional NAS proxy routing for one CGI request; legacy calls stay direct."""
import asyncio
from contextvars import ContextVar

import httpx

PROXY_URL = "http://100.84.143.63:18888"
PROXY_TIMEOUT = 5.0
_route = ContextVar("qqmusic_proxy_route", default=None)


class ProxyRoute:
    def __init__(self, request_id=""):
        self.failed = False
        self.request_id = request_id
        self.state = "waiting"
        self.reason = ""
        self.report("waiting")

    def report(self, state, reason=""):
        self.state, self.reason = state, reason
        from proxy_status import save
        save(self.request_id, state, reason)

    def result(self, cache_hit=False):
        if self.state == "waiting":
            self.report("cache" if cache_hit else "ready")
        return {"state": self.state, "reason": self.reason}

    async def request(self, method, url, **kwargs):
        if not self.failed:
            self.report("proxy")
            try:
                # wait_for covers connect, TLS, response headers AND response body.
                async def via_proxy():
                    async with httpx.AsyncClient(
                        proxy=PROXY_URL, trust_env=False, timeout=PROXY_TIMEOUT
                    ) as client:
                        return await client.request(method, url, **kwargs)
                return await asyncio.wait_for(via_proxy(), timeout=PROXY_TIMEOUT)
            except (asyncio.TimeoutError, httpx.TransportError) as exc:
                self.failed = True
                self.report("fallback", "timeout" if isinstance(exc, (asyncio.TimeoutError, httpx.TimeoutException)) else "connection_error")
        # Disable environment proxies so fallback really uses the server's IP.
        async with httpx.AsyncClient(trust_env=False, timeout=20.0) as client:
            return await client.request(method, url, **kwargs)


def configure_proxy(value, request_id=""):
    enabled = str(value).strip().lower() in ("1", "true", "yes", "on")
    _route.set(ProxyRoute(request_id) if enabled else None)


def get_route():
    return _route.get()
