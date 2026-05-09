# TIL 2026-05-10: Raspberry Pi Kubernetes, Argo CD, GHCR, Cilium Ingress

## 목표

Raspberry Pi 기반 Kubernetes 클러스터에 Cooking Assistant backend를 배포하는 GitOps 흐름을 만들었다.

최종 목표 흐름은 아래와 같다.

```text
GitHub main
-> GitHub Actions
-> backend Docker image build
-> GHCR push
-> dev kustomize image tag update
-> Argo CD sync
-> Kubernetes Deployment
-> Cilium Ingress
-> Service
-> Pods
```

작업 중 크게 네 계층이 서로 다르다는 점을 다시 확인했다.

```text
Git repository auth
Container registry auth
Kubernetes scheduling/networking
External ingress / load balancer
```

이 네 개가 모두 맞아야 외부 도메인에서 Pod까지 도달한다.

## Argo CD는 클러스터에 설치되는 GitOps 컨트롤러다

Argo CD는 로컬 PC에 설치해서 쓰는 배포 도구라기보다, Kubernetes 클러스터 안에 설치되는 컨트롤러다.

Helm으로 설치할 수 있다.

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --wait
```

다만 최신 `argo/argo-cd` chart는 Kubernetes version 조건이 있다. 당시 클러스터 server version은 `v1.24.17`이었고, 최신 chart는 `kubeVersion >=1.25.0-0`을 요구해서 설치가 실패했다.

```text
Error: chart requires kubeVersion: >=1.25.0-0
which is incompatible with Kubernetes v1.24.17
```

Helm은 Kubernetes용 package manager에 가깝지만, chart가 요구하는 Kubernetes API version 조건까지 무시해주지는 않는다.

## kubeadm upgrade와 apt repo 문제

`kubeadm upgrade plan`은 현재 설치된 kubeadm minor series 기준으로 upgrade target을 보여준다.

```text
Cluster version: v1.24.17
kubeadm version: v1.24.17
remote version is much newer: v1.36.0; falling back to: stable-1.24
Target version: v1.24.17
```

이 메시지는 `1.36.0`으로 바로 upgrade 가능하다는 뜻이 아니라, 현재 kubeadm이 너무 오래되어 현재 minor series인 `stable-1.24`만 보겠다는 뜻이다. Kubernetes는 minor version을 순차적으로 올리는 것이 기본 전제다.

`pkgs.k8s.io/core:/stable:/v1.25` apt repo에서는 GPG key가 만료되어 있었다.

```text
EXPKEYSIG 234654DA9A296436
The repository ... is not signed.
```

기술적으로 apt 검증을 우회할 수는 있지만, 오래된 minor repo의 만료된 key를 우회하면서 단계별 upgrade를 계속하는 것보다 OS와 Kubernetes를 새로 설치하는 쪽이 낫다고 판단했다.

## Raspberry Pi OS와 Cilium Envoy VA_BITS 문제

Cilium 설치 중 `cilium-envoy`가 아래 로그로 죽었다.

```text
TCMalloc assumes a 48-bit virtual address space size
FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
```

핵심은 RAM 용량이 아니라 ARM64 kernel의 virtual address bits였다.

문제 노드에서는 다음처럼 39-bit VA kernel이었다.

```bash
grep CONFIG_ARM64_VA_BITS /boot/config-$(uname -r)
```

```text
CONFIG_ARM64_VA_BITS_39=y
CONFIG_ARM64_VA_BITS=39
```

새 Ubuntu Raspberry Pi image를 설치한 뒤에는 48-bit VA kernel이 확인되었다.

```text
# CONFIG_ARM64_VA_BITS_39 is not set
CONFIG_ARM64_VA_BITS_48=y
CONFIG_ARM64_VA_BITS=48
```

결론:

- Raspberry Pi 4/5라도 OS image와 kernel config에 따라 Cilium Envoy 동작 여부가 갈릴 수 있다.
- 단순히 "64-bit OS"라는 말만으로 충분하지 않다.
- `CONFIG_ARM64_VA_BITS=48`인지 확인해야 한다.

## kubeadm reset, worker join, NotReady 원인

기존 worker node는 `kubeadm reset` 후 다시 join했다.

join은 root 권한이 필요하다.

```text
[ERROR IsPrivilegedUser]: user is not running as root
```

즉 아래처럼 실행해야 한다.

```bash
sudo kubeadm join ...
```

초기 `NotReady` 원인은 CNI가 아직 준비되지 않았기 때문이다.

```text
container runtime network not ready
NetworkPluginNotReady
cni plugin not initialized
```

Kubernetes node가 Ready가 되려면 CNI plugin이 정상 동작해야 한다. Pod끼리 통신하지 않는다고 생각해도, kubelet 입장에서는 Pod network plugin 초기화가 Ready 조건에 들어간다.

## Cilium과 kernel module

Cilium agent가 `protocol not supported`로 죽었다.

확인한 kernel config:

```bash
grep -E 'CONFIG_IP_MULTIPLE_TABLES|CONFIG_IPV6_MULTIPLE_TABLES|CONFIG_FIB_RULES|CONFIG_VXLAN|CONFIG_GENEVE' /boot/config-$(uname -r)
```

필요 module:

```bash
sudo modprobe vxlan
sudo modprobe geneve
lsmod | grep -E 'vxlan|geneve'
```

module을 올린 뒤 Cilium pod가 정상화되고 node들이 Ready가 되었다.

```text
rpi4nc        Ready
rpi4witheye   Ready      control-plane
rpi5ms        Ready
```

## Argo CD AppProject와 Application

`deploy/argocd/projects/cooking-assistant.yaml`은 배포 자체를 수행하지 않는다. 이것은 Argo CD `AppProject`다.

역할은 "이 프로젝트에 속한 Application이 어디에서 읽고 어디에 배포할 수 있는지"를 제한하는 것이다.

```yaml
sourceRepos:
  - https://github.com/m1ser4ble/cooking-assistant.git
destinations:
  - namespace: cooking-assistant-dev
    server: https://kubernetes.default.svc
  - namespace: cooking-assistant-staging
    server: https://kubernetes.default.svc
  - namespace: cooking-assistant-prod
    server: https://kubernetes.default.svc
```

실제 배포를 시작하는 것은 `Application` 리소스다.

```bash
kubectl apply -f deploy/argocd/projects/cooking-assistant.yaml
kubectl apply -f deploy/argocd/applications/cooking-assistant-dev.yaml
```

dev만 apply하면 dev만 배포된다. staging/prod는 해당 Application을 apply하기 전까지 배포되지 않는다.

## GitOps 배포 구조

Cooking Assistant backend는 Ktor app이다. 기존 scaffold에는 ASP.NET 흔적이 있었고, 이를 Ktor/Cilium 기준으로 맞췄다.

수정한 핵심:

- readiness/liveness probe path를 `/healthz`에서 `/health`로 변경
- `ingressClassName: nginx`를 `cilium`으로 변경
- `ASPNETCORE_ENVIRONMENT` 제거
- `PORT=8080`, `LOG_LEVEL`, `RECIPE_LLM_PROVIDER=heuristic` 등 Ktor 기준 env 사용
- dev Application은 automated sync, prune, selfHeal을 켬

dev image tag는 사람이 매번 version tag를 정하지 않고 commit SHA를 사용하도록 했다.

```text
ghcr.io/m1ser4ble/cooking-assistant-api:<commit-sha>
```

## GitHub Actions + GHCR

처음 만든 workflow는 아래 일을 한다.

```text
main push
-> backend build
-> multi-arch Docker image push
-> dev kustomization newTag update
-> commit back to main
-> Argo CD auto sync
```

GHCR은 개인/오픈소스 용도로 쓰기 편한 registry다. 이미지 주소는 다음 형태다.

```text
ghcr.io/m1ser4ble/cooking-assistant-api:<sha>
```

## GitHub Actions 실패 1: DOCKER_CONTEXT 충돌

첫 실패는 `docker/setup-qemu-action` 단계에서 발생했다.

```text
Failed to initialize: unable to resolve docker endpoint:
context "backend": context not found
```

원인은 workflow env에 `DOCKER_CONTEXT=backend`를 둔 것이다. `DOCKER_CONTEXT`는 Docker CLI가 자체적으로 사용하는 예약 환경변수다.

해결:

```yaml
DOCKER_CONTEXT: backend
```

를 아래처럼 바꿨다.

```yaml
DOCKER_BUILD_CONTEXT: backend
```

이 수정은 PR #148로 들어갔다.

## GitHub Actions 실패 2: QEMU 안에서 Gradle 다운로드

두 번째 실패는 multi-arch Docker build 중 `linux/arm64` stage에서 Gradle wrapper가 Gradle distribution을 받다가 죽은 것이다.

```text
[linux/arm64 build 7/7] RUN ./gradlew --no-daemon test installDist
Downloading https://services.gradle.org/distributions/gradle-9.1.0-bin.zip
java.net.SocketException: Broken pipe
```

원인은 Dockerfile 안에서 Gradle build를 수행했기 때문이다. `linux/arm64` image build는 GitHub hosted runner에서 QEMU emulation으로 돌고, 그 안에서 Gradle 다운로드와 빌드까지 수행하면 느리고 불안정하다.

해결:

```text
GitHub runner에서 ./gradlew test installDist
-> Docker build는 build/install 결과만 COPY
```

Dockerfile은 runtime image 조립만 하게 줄였다.

```dockerfile
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

ENV PORT=8080
EXPOSE 8080

COPY build/install/cooking-assistant-backend/ ./
RUN chown -R app:app /app

USER app

ENTRYPOINT ["./bin/cooking-assistant-backend"]
```

이 수정은 PR #149로 들어갔다.

성공 후 Actions 로그에는 GHCR manifest push가 확인되었다.

```text
ghcr.io/m1ser4ble/cooking-assistant-api:d0cbc4dd2fd886b3a35974a47b1383641594a5aa
sha256:8b6bcf18520404990a52e72a38ac331eca5921692e5efcbb1cbaf5b8b5b79022
```

## Argo CD가 private Git repo를 못 읽는 문제

Argo CD Application이 `Unknown`이었고 dev namespace에는 리소스가 없었다.

```text
Failed to load target state
failed to list refs: authentication required: Repository not found.
```

GitHub private repo를 인증 없이 읽으려고 해서 발생했다.

해결은 read-only deploy key 방식으로 했다.

```text
ssh-keygen으로 SSH key pair 생성
public key -> GitHub repo Deploy key로 등록
private key -> argocd namespace Secret에 저장
Application repoURL -> git@github.com:m1ser4ble/cooking-assistant.git
```

중요한 점:

- 이 SSH key는 Git repo를 읽기 위한 것이다.
- Pod image pull과는 무관하다.
- Argo CD repo-server가 private key로 GitHub SSH에 접속하고, GitHub는 deploy key public key와 매칭해서 repo read를 허용한다.

적용 후 Argo CD는 `Synced`로 바뀌었고 Deployment/Service/Pod가 생성되었다.

## GHCR image pull 인증 문제

Pod가 처음에는 `ImagePullBackOff`가 되었다.

```text
failed to fetch anonymous token
401 Unauthorized
```

여기서 필요한 인증은 Git repo deploy key가 아니다. kubelet/containerd가 `ghcr.io`에서 image layer를 받기 위한 Docker registry 인증이다.

정리:

```text
Argo CD -> GitHub repo
인증: SSH deploy key
용도: manifest YAML 읽기

kubelet/containerd -> GHCR
인증: public package 또는 docker-registry imagePullSecret
용도: container image pull
```

선택지는 두 개다.

```text
1. GHCR package를 public으로 전환
2. private 유지 후 read:packages PAT로 imagePullSecret 생성
```

dev용이라 GHCR package visibility를 public으로 바꿨다. 이것은 code repo visibility가 아니라 package visibility다.

```text
GitHub repo: private
GHCR package: public
```

이후 Pod는 `1/1 Running`이 되었다.

```text
cooking-assistant-api-fc499fb-ngs9f   1/1   Running
cooking-assistant-api-fc499fb-rfvz8   1/1   Running
```

## Service, Endpoint, Ingress

Pod IP로 직접 테스트하기보다는 Service나 Ingress 기준으로 테스트하는 것이 맞다.

Service:

```bash
kubectl -n cooking-assistant-dev get svc cooking-assistant-api
```

Endpoints:

```bash
kubectl -n cooking-assistant-dev get endpoints cooking-assistant-api -o wide
kubectl -n cooking-assistant-dev get endpointslice \
  -l kubernetes.io/service-name=cooking-assistant-api -o wide
```

Service 내부 테스트:

```bash
kubectl -n cooking-assistant-dev run curl-test \
  --rm -it \
  --image=curlimages/curl \
  --restart=Never \
  -- curl -v http://cooking-assistant-api/health
```

로컬 테스트:

```bash
kubectl -n cooking-assistant-dev port-forward svc/cooking-assistant-api 8080:80
curl -v http://localhost:8080/health
```

## Ingress와 외부 주소

Ingress 리소스는 생성되었지만 `ADDRESS`가 비어 있었다.

```text
NAME                    CLASS    HOSTS                                   ADDRESS
cooking-assistant-api   cilium   api.dev.cooking-assistant.example.com
```

이 상태는 외부에서 들어올 진입점 IP가 아직 없다는 뜻이다.

도메인은 결국 IP 하나를 가리킨다.

```text
api.ca.samplingcloud.top
-> DNS A record
-> public IP
-> 공유기 port forward
-> Kubernetes ingress entrypoint
-> Service
-> Pods
```

Pod가 2개라서 LoadBalancer가 필요한 것이 핵심은 아니다. Pod 로드밸런싱은 Kubernetes Service가 이미 한다.

외부에서 클러스터 안으로 들어오는 ingress entrypoint가 필요하다.

## Node load balancing과 Pod load balancing은 다르다

NodePort나 hostNetwork로 공유기가 특정 노드 하나에만 port-forward하면 node 차원의 분산은 안 된다.

```text
공유기 -> 192.168.0.16:30080
```

이 경우 외부 트래픽은 항상 `192.168.0.16`으로 들어간다.

하지만 그 뒤에는 Service가 Pod로 분산한다.

```text
node -> Ingress -> Service -> Pod A / Pod B
```

즉:

```text
Node-level load balancing: 안 됨
Pod-level load balancing: 됨
```

Cilium LB IP + L2 announcement 구조는 node-level load balancing이라기보다, 하나의 virtual IP를 살아있는 노드 중 하나가 ARP로 advertise하고 장애 시 다른 노드가 넘겨받는 failover에 가깝다.

## Cilium LB IPAM + L2 announcement

원하는 구조:

```text
공유기
-> Cilium LB IP
-> Cilium Ingress
-> Service
-> Pods
```

Cilium 설정에는 LB IPAM이 켜져 있었다.

```text
default-lb-service-ipam: lbipam
enable-lb-ipam: "true"
```

하지만 IP pool은 없었다.

```bash
kubectl get ciliumloadbalancerippools.cilium.io -A
```

```text
No resources found
```

Cilium Ingress/L2 announcement에는 추가로 다음이 필요하다.

```text
ingressController.enabled=true
l2announcements.enabled=true
kubeProxyReplacement=true
k8sServiceHost=<api-server-ip>
k8sServicePort=6443
CiliumLoadBalancerIPPool
CiliumL2AnnouncementPolicy
```

공식 문서상 L2 announcement는 kube-proxy replacement가 필요하다. 이 변경은 Cilium DaemonSet 재시작과 기존 service connection 끊김을 유발할 수 있다.

당시 클러스터 상태:

```text
nodes:
  rpi4nc        192.168.0.5
  rpi4witheye   192.168.0.16
  rpi5ms        192.168.0.6

cilium:
  version: 1.19.3
  kube-proxy-replacement: false
  kube-proxy daemonset: running
```

LB IP 후보로 `192.168.0.240`을 ping/ARP로 확인했고 응답은 없었다. 다만 DHCP range와 겹치지 않는지는 공유기 설정에서 최종 확인해야 한다.

예상 manifest:

```yaml
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: lan-pool
spec:
  blocks:
    - start: "192.168.0.240"
      stop: "192.168.0.250"
---
apiVersion: cilium.io/v2alpha1
kind: CiliumL2AnnouncementPolicy
metadata:
  name: lan-l2-policy
spec:
  loadBalancerIPs: true
  interfaces:
    - ^eth[0-9]+
    - ^en.*
    - ^wlan[0-9]+
```

공유기 port-forward는 아래처럼 잡게 된다.

```text
public 80  -> 192.168.0.240:80
public 443 -> 192.168.0.240:443
```

DNS는 public IP를 가리킨다.

```text
api.ca.samplingcloud.top -> home public IP
```

LAN 내부에서 같은 도메인을 내부 IP로 쓰고 싶으면 split-horizon DNS 또는 공유기 DNS override가 필요하다.

## BGP/별도 LB 구조

더 진지하게 node-level 분산을 하려면 별도 Load Balancer 또는 BGP가 필요하다.

HAProxy 예:

```text
공유기 80/443
-> HAProxy
-> node1:NodePort
-> node2:NodePort
-> node3:NodePort
```

BGP 예:

```text
Cilium 또는 MetalLB
-> 라우터에 VIP route 광고
-> 라우터가 적절한 노드로 전달
```

가정용 공유기는 보통 BGP를 지원하지 않는다. OpenWrt, MikroTik, pfSense, OPNsense 같은 장비면 가능하다.

이번 Raspberry Pi 홈 클러스터에서는 BGP까지 갈 필요는 낮고, `Cilium LB IPAM + L2 announcement`가 적절한 다음 단계다.

## 현재까지 확인된 결과

성공한 것:

- Kubernetes `v1.36.0` 클러스터 재구성
- Raspberry Pi Ubuntu 24.04 48-bit VA kernel 확인
- Cilium CNI 정상화
- Argo CD Helm 설치
- GitOps deploy scaffold main merge
- GitHub Actions backend image build 성공
- GHCR image push 성공
- Argo CD private Git repo 인증 해결
- GHCR package public 전환 후 image pull 성공
- dev Pod 2개 Running

남은 것:

- Cilium Ingress controller를 실제로 enable
- Cilium LB IPAM pool 생성
- Cilium L2 announcement policy 생성
- Ingress host를 `api.ca.samplingcloud.top`으로 교체
- 공유기 port-forward를 Cilium LB IP로 연결
- 외부/내부 DNS 경로 검증

## 기억할 점

- Argo CD가 Git을 읽는 인증과 Kubernetes가 image를 pull하는 인증은 완전히 다르다.
- `AppProject`는 권한 범위이고, `Application`이 실제 배포 단위다.
- Helm chart의 `kubeVersion` 조건은 현재 cluster server version 기준이다.
- Raspberry Pi Cilium Envoy 문제는 RAM보다 ARM64 VA_BITS가 핵심일 수 있다.
- CNI가 준비되지 않으면 node는 `NotReady`다.
- GHCR package visibility는 code repo visibility와 별개다.
- `DOCKER_CONTEXT`는 Docker CLI 예약 환경변수라 workflow 변수명으로 쓰면 안 된다.
- multi-arch Docker build에서 QEMU 안에 Gradle/npm 같은 무거운 build를 넣지 않는 편이 안정적이다.
- Node-level load balancing과 Pod-level load balancing은 분리해서 생각해야 한다.
