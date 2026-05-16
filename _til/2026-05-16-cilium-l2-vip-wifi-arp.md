# TIL 2026-05-16: Cilium L2 VIP, Wi-Fi ARP, and dev HTTPS

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

## Cert-manager and Let's Encrypt HTTP-01

After the VIP was reachable through wired LAN, the next issue was HTTPS.

HTTP worked:

```text
curl http://api.ca.samplingcloud.top/v1/recipe-extractions
=> HTTP/1.1 405 Method Not Allowed
server: envoy
```

The `405` was not an ingress failure. It only meant that the request reached
Envoy/backend, but `GET /v1/recipe-extractions` is not the API method. The real
route is `POST /v1/recipe-extractions`.

HTTPS failed before cert-manager was configured:

```text
curl https://api.ca.samplingcloud.top/v1/recipe-extractions
=> Recv failure: Connection reset by peer
```

The live Ingress referenced:

```yaml
tls:
  - hosts:
      - api.ca.samplingcloud.top
    secretName: api-ca-samplingcloud-top-tls
```

but the secret did not exist yet:

```text
kubectl -n cooking-assistant-dev get secret api-ca-samplingcloud-top-tls
=> NotFound
```

### Installation

cert-manager was installed with Helm using the OCI chart:

```bash
helm install \
  cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --version v1.20.2 \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true
```

`oci://` means Helm pulls the chart from an OCI/container registry, similar to
pulling an image from `quay.io`, instead of using a legacy Helm chart repo URL.

Install verification:

```text
cert-manager                 Running
cert-manager-cainjector      Running
cert-manager-webhook         Running
```

The cert-manager CRDs appeared:

```text
certificates.cert-manager.io
clusterissuers.cert-manager.io
orders.acme.cert-manager.io
challenges.acme.cert-manager.io
```

### Issuers

Two `ClusterIssuer`s were used for the same dev domain:

```text
letsencrypt-dev-staging
letsencrypt-dev-prod
```

These names do not mean there are separate application environments. They mean:

- `staging`: Let's Encrypt test CA, useful for checking HTTP-01 without real
  certificate/rate-limit risk.
- `prod`: Let's Encrypt real CA, trusted by browsers and Android.

Both use HTTP-01 through Cilium Ingress:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-dev-prod
spec:
  acme:
    email: <acme-account-email>
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-dev-prod-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: cilium
```

### Argo CD ownership

cert-manager itself was installed by Helm. The project-specific issuers are
better stored in GitOps.

An Argo CD `Application` for `deploy/cert-manager` means:

```text
Read manifests from GitHub main/deploy/cert-manager
Apply them to this Kubernetes cluster
Continuously reconcile drift
```

The destination:

```yaml
destination:
  server: https://kubernetes.default.svc
  namespace: cert-manager
```

means "apply to the same cluster Argo CD is running in; use `cert-manager` as
the default namespace for namespace-scoped resources." `ClusterIssuer` itself is
cluster-scoped, so it does not live inside that namespace.

The AppProject also needs to allow the cluster-scoped cert-manager resource:

```yaml
clusterResourceWhitelist:
  - group: cert-manager.io
    kind: ClusterIssuer
```

### HTTP-01 failure mode

cert-manager created the solver resources correctly:

```text
cm-acme-http-solver-* Ingress  class=cilium  host=api.ca.samplingcloud.top
cm-acme-http-solver-* Service
cm-acme-http-solver-* Pod      Running
```

But the challenge stayed pending. The important `Challenge` reason was:

```text
Waiting for HTTP-01 challenge propagation:
failed to perform self check GET request
'http://api.ca.samplingcloud.top/.well-known/acme-challenge/...':
Get "https://api.ca.samplingcloud.top/.well-known/acme-challenge/...":
read: connection reset by peer
```

The clue is that cert-manager started with `http://...` but the actual request
became `https://...`. Cilium Ingress was forcing HTTP to HTTPS because the
Ingress had TLS configured, but HTTPS could not work yet because the TLS secret
was exactly what cert-manager was trying to create. That made a bootstrap loop:

```text
HTTP-01 challenge needs HTTP
-> Cilium redirects HTTP to HTTPS
-> HTTPS has no valid secret yet
-> connection reset
-> challenge self-check fails
```

The fix was to disable Cilium's forced HTTPS redirect on this dev Ingress:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-dev-prod
    ingress.cilium.io/force-https: disabled
```

After adding the annotation, staging issuance completed:

```text
Certificate api-ca-samplingcloud-top-tls  READY=True
Order                                     valid
```

Then the Ingress was switched to `letsencrypt-dev-prod`, the staging-issued TLS
secret was removed, and prod issuance completed:

```text
Certificate: api-ca-samplingcloud-top-tls
Issuer:      letsencrypt-dev-prod
Ready:       True
Secret:      kubernetes.io/tls
```

HTTPS then reached the backend:

```text
curl https://api.ca.samplingcloud.top/v1/recipe-extractions
=> HTTP/1.1 405 Method Not Allowed
server: envoy
```

Again, `405` only proves transport/ingress/backend reachability for a GET
request. The real functional smoke test is a POST:

```bash
curl -i https://api.ca.samplingcloud.top/v1/recipe-extractions \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceUrl": "https://www.youtube.com/watch?v=Zh92ofOGAqY",
    "videoId": "Zh92ofOGAqY",
    "clientRequestId": "https-cert-manager-smoke",
    "languageHint": "ko"
  }'
```

That returned:

```text
HTTP/1.1 200 OK
x-envoy-upstream-service-time: 61123
```

The response contained a Unity-compatible recipe for the Sung Si Kyung boiled
pork video, with ingredients, six steps, media cues, and warnings:

```text
youtube_transcript_auto_generated
gemini_cli_recipe_structuring
```

### Long-running extraction note

The successful POST took about 61 seconds. Unity coroutine use prevents the main
thread from blocking, but it does not remove HTTP timeout limits. The current
client transport default was 12 seconds, so long-running extraction can still
time out even though it is coroutine-based.

Short-term fix:

```text
Increase the backend extraction client timeout for dev validation.
```

Long-term shape:

```text
POST /v1/recipe-extractions       -> 202 Accepted + jobId
GET  /v1/recipe-extractions/{id}  -> queued/running/completed/failed
```

That avoids holding one HTTP request open for the entire Gemini/YouTube
processing duration.
