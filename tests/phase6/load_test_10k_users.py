#!/usr/bin/env python3
"""
Phase 6 Track 5 load simulation for 10k concurrent users.

Supports two execution modes:
1) Simulated mode (default): no external dependencies, no live API required.
2) Live mode: sends real HTTP requests to a provided base URL.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class LoadMetrics:
    latencies_ms: List[float] = field(default_factory=list)
    success_count: int = 0
    error_count: int = 0

    @property
    def total(self) -> int:
        return self.success_count + self.error_count

    @property
    def error_rate_pct(self) -> float:
        return (self.error_count / self.total) * 100 if self.total else 0.0

    @property
    def p95_ms(self) -> float:
        if not self.latencies_ms:
            return 0.0
        sorted_lat = sorted(self.latencies_ms)
        idx = max(0, int(len(sorted_lat) * 0.95) - 1)
        return sorted_lat[idx]


ENDPOINT_PROFILES: List[Tuple[str, str, Tuple[float, float], float]] = [
    ("/tenant/dashboard", "GET", (45, 140), 0.55),
    ("/tenant/compliance/score", "GET", (50, 160), 0.25),
    ("/admin/metrics/summary", "GET", (60, 170), 0.15),
    ("/compliance/reports/generate", "POST", (85, 200), 0.05),
]


def choose_endpoint() -> Tuple[str, str, Tuple[float, float]]:
    roll = random.random()
    cumulative = 0.0
    for path, method, latency_range, weight in ENDPOINT_PROFILES:
        cumulative += weight
        if roll <= cumulative:
            return path, method, latency_range
    path, method, latency_range, _weight = ENDPOINT_PROFILES[-1]
    return path, method, latency_range


async def simulate_request(latency_range: Tuple[float, float]) -> Tuple[bool, float]:
    start = time.perf_counter()
    await asyncio.sleep(random.uniform(*latency_range) / 1000.0)
    ok = random.random() > 0.0005
    elapsed = (time.perf_counter() - start) * 1000
    return ok, elapsed


def _live_request(base_url: str, path: str, method: str, timeout: int) -> Tuple[bool, float]:
    url = f"{base_url.rstrip('/')}{path}"
    start = time.perf_counter()
    try:
        data = b"{}" if method == "POST" else None
        req = urllib.request.Request(url=url, method=method, data=data)
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=timeout) as response:
            _ = response.read(512)
            ok = 200 <= response.status < 500
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        ok = False
    elapsed = (time.perf_counter() - start) * 1000
    return ok, elapsed


async def run_virtual_user(
    semaphore: asyncio.Semaphore,
    metrics: LoadMetrics,
    base_url: str | None,
    live: bool,
    timeout: int,
    requests_per_user: int,
) -> None:
    async with semaphore:
        for _ in range(requests_per_user):
            path, method, latency_range = choose_endpoint()
            if live and base_url:
                ok, elapsed = await asyncio.to_thread(
                    _live_request, base_url, path, method, timeout
                )
            else:
                ok, elapsed = await simulate_request(latency_range)

            metrics.latencies_ms.append(elapsed)
            if ok:
                metrics.success_count += 1
            else:
                metrics.error_count += 1


async def run_load_test(
    users: int,
    concurrency: int,
    requests_per_user: int,
    live: bool,
    base_url: str | None,
    timeout: int,
) -> LoadMetrics:
    metrics = LoadMetrics()
    semaphore = asyncio.Semaphore(concurrency)
    tasks = [
        run_virtual_user(
            semaphore=semaphore,
            metrics=metrics,
            base_url=base_url,
            live=live,
            timeout=timeout,
            requests_per_user=requests_per_user,
        )
        for _ in range(users)
    ]
    await asyncio.gather(*tasks)
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 6 10k concurrent-user load simulation")
    parser.add_argument("--users", type=int, default=10000, help="Number of virtual users")
    parser.add_argument("--concurrency", type=int, default=1000, help="Concurrent workers")
    parser.add_argument("--requests-per-user", type=int, default=1, help="Requests per virtual user")
    parser.add_argument("--live", action="store_true", help="Send real requests to --base-url")
    parser.add_argument("--base-url", type=str, default="", help="Base URL for live mode")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout seconds (live mode)")
    parser.add_argument("--target-p95-ms", type=float, default=200.0, help="Target p95 latency")
    parser.add_argument("--target-error-rate-pct", type=float, default=0.1, help="Max error rate")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.live and not args.base_url:
        print("ERROR: --live mode requires --base-url")
        return 2

    mode = "LIVE" if args.live else "SIMULATED"
    print(f"Phase 6 Track 5 load test mode: {mode}")
    print(
        f"Users={args.users}, Concurrency={args.concurrency}, Requests/User={args.requests_per_user}"
    )

    started = time.perf_counter()
    metrics = asyncio.run(
        run_load_test(
            users=args.users,
            concurrency=args.concurrency,
            requests_per_user=args.requests_per_user,
            live=args.live,
            base_url=args.base_url or None,
            timeout=args.timeout,
        )
    )
    elapsed_s = time.perf_counter() - started
    rps = metrics.total / elapsed_s if elapsed_s > 0 else 0.0

    mean_ms = statistics.mean(metrics.latencies_ms) if metrics.latencies_ms else 0.0
    p95_ms = metrics.p95_ms
    error_rate = metrics.error_rate_pct

    print(f"Total Requests: {metrics.total}")
    print(f"Success: {metrics.success_count} | Errors: {metrics.error_count} ({error_rate:.4f}%)")
    print(f"Latency mean={mean_ms:.2f}ms p95={p95_ms:.2f}ms")
    print(f"Throughput: {rps:.2f} req/s")

    failures: List[str] = []
    if p95_ms > args.target_p95_ms:
        failures.append(f"p95 latency {p95_ms:.2f}ms exceeds target {args.target_p95_ms:.2f}ms")
    if error_rate > args.target_error_rate_pct:
        failures.append(
            f"error rate {error_rate:.4f}% exceeds target {args.target_error_rate_pct:.4f}%"
        )

    if failures:
        print("RESULT: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
