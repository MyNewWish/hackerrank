"""Reference solution - shipping cost (all 4 parts)."""
import heapq
from collections import defaultdict


def parse_routes(data):
    """'US:UK:UPS:5,UK:FR:DHL:3' -> adjacency {src: [(dst, carrier, cost)]}.
    Malformed entries are skipped."""
    graph = defaultdict(list)
    for raw in data.split(","):
        parts = [p.strip() for p in raw.split(":")]
        if len(parts) != 4 or not all(parts):
            continue
        src, dst, carrier, cost = parts
        try:
            cost = int(cost)
        except ValueError:
            continue
        if cost < 0:
            continue
        graph[src].append((dst, carrier, cost))
    return graph


# Part 1
def direct_cost(data, src, dst):
    costs = [c for d, _, c in parse_routes(data).get(src, []) if d == dst]
    return min(costs) if costs else None


def _fmt(nodes, carriers, cost):
    return {"route": " -> ".join(nodes), "method": " -> ".join(carriers), "cost": cost}


# Parts 2-4: one search handles them all.
def cheapest_route(data, src, dst, max_legs=None, carriers=None):
    """Dijkstra over (node, legs_used). Tie-break: cost, legs, route string."""
    graph = parse_routes(data)
    if src == dst:
        return _fmt([src], [], 0)
    # heap item: (cost, legs, route_str, node, nodes_tuple, carriers_tuple)
    heap = [(0, 0, src, src, (src,), ())]
    best = {}  # (node, legs) -> cost already finalized
    while heap:
        cost, legs, rstr, node, nodes, used = heapq.heappop(heap)
        if node == dst:
            return _fmt(list(nodes), list(used), cost)
        key = (node, legs) if max_legs is not None else node
        if key in best:
            continue
        best[key] = cost
        if max_legs is not None and legs >= max_legs:
            continue
        for nxt, carrier, c in graph.get(node, []):
            if carriers is not None and carrier not in carriers:
                continue
            if nxt in nodes:  # no cycles
                continue
            nn = nodes + (nxt,)
            heapq.heappush(heap, (cost + c, legs + 1, " -> ".join(nn), nxt, nn, used + (carrier,)))
    return None


def one_hop_route(data, src, dst):
    return cheapest_route(data, src, dst, max_legs=2)


if __name__ == "__main__":
    s = "US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6"
    print(direct_cost(s, "US", "UK"))
    print(one_hop_route(s, "US", "FR"))
