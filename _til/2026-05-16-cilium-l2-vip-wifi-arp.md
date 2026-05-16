# TIL 2026-05-16: Cilium L2 VIP, Wi-Fi ARP, and Kubernetes ingress exposure

## Context

- Cooking Assistant API is exposed by Cilium Ingress.
- The public DNS name is `api.ca.samplingcloud.top`.
- Public traffic reaches the home router first, then should be forwarded to the cluster.
- The Cilium shared ingress Service had:

```text
kube-system/cilium-ingress
type: LoadBalancer
LoadBalancer VIP: 192.168.0.240
HTTP NodePort:    30815
HTTPS NodePort:   31694
```

The intended path was:

```text
Internet
-> router public IP:80/443
-> 192.168.0.240:80/443
-> Cilium Ingress Envoy
-> cooking-assistant-api Service
-> cooking-assistant-api Pod
```

## Symptom

Public HTTP did not connect:

```text
curl http://api.ca.samplingcloud.top/v1/recipe-extractions
=> connect failed
```

The internal LoadBalancer VIP was also unstable:

```text
curl -H 'Host: api.ca.samplingcloud.top' \
  http://192.168.0.240/v1/recipe-extractions
=> timeout
```

But NodePort worked on every node:

```text
curl -H 'Host: api.ca.samplingcloud.top' \
  http://192.168.0.5:30815/v1/recipe-extractions
=> HTTP/1.1 405 Method Not Allowed
server: envoy
```

`405 Method Not Allowed` was useful evidence: the request reached Envoy and the
backend. The path was alive; GET was simply not a valid API method.

## What 192.168.0.240 is

`192.168.0.240` is not a real node IP. It is the Cilium Ingress LoadBalancer
VIP.

The node that holds the Cilium L2 lease answers ARP for that VIP:

```text
Who has 192.168.0.240?
192.168.0.240 is at <current-holder-node-mac>
```

If the current holder dies, another eligible node can acquire the lease and
answer ARP with its own MAC. Clients keep using the same VIP.

This is the Kubernetes-friendly model:

```text
router -> 192.168.0.240:80/443
```

The less ideal fallback is:

```text
router -> specific-node-ip:NodePort
```

That bypasses the VIP failover model and pins ingress to a node.

## Troubleshooting Evidence

The `cilium-ingress` Service and Cilium BPF service table contained the VIP and
NodePorts:

```text
192.168.0.240:80/TCP      LoadBalancer
192.168.0.240:443/TCP     LoadBalancer
0.0.0.0:30815/TCP         NodePort
0.0.0.0:31694/TCP         NodePort
```

Cilium L2 announcement state showed the VIP assigned to `wlan0`:

```text
IP              NetworkInterface
192.168.0.240   wlan0
```

The L2 responder map had the VIP entry, but no ARP responses were sent:

```text
key: c0 a8 00 f0 03 00 00 00
value: 00 00 00 00 00 00 00 00
```

`responses_sent=0` means ARP requests were not reaching the responder path, or
the Wi-Fi/L2 path was preventing the response from being useful.

The client ARP cache showed the failure directly:

```text
arp -n 192.168.0.240
=> incomplete
```

Node IP ARP worked:

```text
192.168.0.5  -> rpi4nc wlan0 MAC
192.168.0.6  -> rpi5ms wlan0 MAC
192.168.0.16 -> rpi4witheye wlan0 MAC
```

VIP ARP did not:

```text
192.168.0.240 -> incomplete
```

## Why Wi-Fi matters

Cilium L2 announcement requires a node to answer ARP for an IP that is not its
normal interface address. On wired Ethernet this is usually fine.

On Wi-Fi, the access point may filter or rewrite client L2 behavior:

- client isolation
- proxy ARP
- ARP spoofing protection
- IP/MAC binding checks
- gratuitous ARP filtering

Raspberry Pi Wi-Fi is a known bad fit for this pattern. MetalLB documents the
same class of issue for its L2 mode: Raspberry Pi devices may not respond to ARP
requests when using Wi-Fi.

The lesson transfers because MetalLB L2 and Cilium L2 Announcement both depend
on advertising a LoadBalancer VIP with ARP/NDP.

References:

- https://docs.cilium.io/en/stable/network/l2-announcements/
- https://metallb.io/troubleshooting/index.html

## Live Mitigation

The cluster was changed to select an explicit ingress role label instead of
letting any Wi-Fi node hold the VIP lease:

```bash
kubectl label node rpi4nc node-role.kubernetes.io/ingress=true --overwrite
kubectl patch ciliuml2announcementpolicy lan-l2-policy --type=merge \
  -p '{"spec":{"nodeSelector":{"matchLabels":{"node-role.kubernetes.io/ingress":"true"}}}}'
```

GitOps policy shape:

```yaml
apiVersion: cilium.io/v2alpha1
kind: CiliumL2AnnouncementPolicy
metadata:
  name: lan-l2-policy
spec:
  nodeSelector:
    matchLabels:
      node-role.kubernetes.io/ingress: "true"
  loadBalancerIPs: true
  interfaces:
    - ^eth[0-9]+
    - ^en.*
    - ^wlan[0-9]+
```

This is better than hostname pinning because another ingress-capable node can be
added later by applying the same label.

## Correct long-term fix

The right fix is not to depend on Wi-Fi for L2 VIP announcement.

Preferred setup:

```text
router 80/443 -> 192.168.0.240:80/443
```

with:

```text
2+ ingress-capable nodes
wired LAN interfaces
Cilium L2 policy selecting only ingress nodes
Cilium L2 policy restricted to the wired interface
```

Example:

```yaml
spec:
  nodeSelector:
    matchLabels:
      node-role.kubernetes.io/ingress: "true"
  loadBalancerIPs: true
  interfaces:
    - ^eth0$
```

This preserves the VIP failover model. If `rpi4nc` dies, another wired ingress
node can acquire the lease and answer ARP for `192.168.0.240`.

## Fallbacks

### NodePort forwarding

This avoids Wi-Fi L2 VIP failure:

```text
WAN 80  -> 192.168.0.5:30815
WAN 443 -> 192.168.0.5:31694
```

It works because `30815` and `31694` are NodePorts on the `cilium-ingress`
Service, not Pod ports. Pod restarts do not change them.

But it pins ingress to a specific node. If `192.168.0.5` dies, public ingress
dies.

### Router static ARP

If the router supports static ARP:

```text
192.168.0.240 -> rpi4nc wlan0 MAC
```

This can make the router send VIP traffic to the selected node without needing
ARP resolution. It also removes failover, because the router keeps sending the
VIP to the same MAC even if another node takes the Cilium lease.

## Takeaway

- `Service` is not a Pod. It is a stable Kubernetes routing object.
- `NodePort` is a stable node-level entry point for a Service.
- `LoadBalancer VIP` is the nicer abstraction, but it requires working L2 ARP.
- Wi-Fi-only Raspberry Pi clusters are a poor fit for ARP-based L2 VIPs.
- For stable Kubernetes-style ingress, use wired ingress nodes and let Cilium
  move the VIP between eligible nodes.
