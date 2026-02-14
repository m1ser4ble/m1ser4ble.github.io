---
layout: single
title: "Claude Code OOM (Out of Memory) 대응"
date: 2026-02-14 09:01:36 +0900
categories: devops
excerpt: "Claude Code OOM (Out of Memory) 대응은(는) 핵심 개념과 배경, 이유를 정리해 적용 기준을 제공한다."
toc: true
toc_sticky: true
tags: [OOM Killer, Out of Memory, Swap, SSH 끊김, tmux 세션]
---

## TL;DR
- Claude Code OOM (Out of Memory) 대응의 핵심 개념과 용어를 한눈에 정리한다.
- Claude Code OOM (Out of Memory) 대응이(가) 등장한 배경과 필요성을 요약한다.
- Claude Code OOM (Out of Memory) 대응의 특징과 적용 포인트를 빠르게 확인한다.

## 1. 개념
Claude Code OOM (Out of Memory) 대응은(는) 핵심 용어와 정의를 정리한 주제로, 개발/운영 맥락에서 무엇을 의미하는지 설명한다.

## 2. 배경
기존 방식의 한계나 현업의 요구사항을 해결하기 위해 이 개념이 등장했다는 흐름을 이해하는 데 목적이 있다.

## 3. 이유
도입 이유는 보통 유지보수성, 성능, 안정성, 보안, 협업 효율 같은 실무 문제를 해결하기 위함이다.

## 4. 특징
- 핵심 정의와 범위를 명확히 한다.
- 실무 적용 시 선택 기준과 비교 포인트를 제공한다.
- 예시 중심으로 빠른 이해를 돕는다.

## 5. 상세 내용
> **작성일**: 2026-02-10
> **카테고리**: DevOps / System Administration
> **포함 내용**: OOM Killer, Swap, SSH 끊김, tmux 세션 유실, 메모리 관리, Docker 메모리 제한, Claude Code

---

# 1. 증상

## SSH가 갑자기 끊기고 tmux 세션도 사라짐

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  증상:                                                      │
│  ├── Claude Code 사용 중 SSH 연결 끊김                     │
│  ├── 재접속하면 tmux 세션도 없음                           │
│  ├── 특히 여러 subagent 동시 실행 시 빈번                  │
│  └── Docker 컨테이너도 함께 죽기도 함                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 2. 원인: OOM Killer

## 메커니즘

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  OOM Killer = Linux 커널의 메모리 부족 시 프로세스 강제 종료│
│                                                             │
│  발동 조건:                                                 │
│  ├── RAM 전부 사용                                          │
│  ├── + Swap 전부 사용                                       │
│  └── → 커널이 프로세스를 선택적으로 kill                   │
│                                                             │
│  kill 우선순위 (oom_score):                                │
│  ├── 메모리 많이 쓰는 프로세스가 높은 점수                 │
│  ├── 하지만 systemd, sshd도 대상이 될 수 있음              │
│  └── sshd가 죽으면 → SSH 세션 전부 종료                    │
│      systemd(user)가 죽으면 → tmux도 같이 종료             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Claude Code가 메모리를 많이 쓰는 이유

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Claude Code (Node.js 기반):                               │
│  ├── 메인 프로세스: ~200-500MB                             │
│  ├── subagent 1개당: ~100-300MB                            │
│  ├── 병렬 5개 실행 시: ~1-2GB 추가                         │
│  └── + MCP 서버들: 각각 수십~수백 MB                       │
│                                                             │
│  + Docker 컨테이너 (Java 등):                              │
│  ├── JVM 기본: 256MB-4GB                                   │
│  └── 제한 없으면: 호스트 메모리 자유롭게 사용              │
│                                                             │
│  총합이 RAM + Swap 초과 → OOM Kill                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 3. 확인 방법

## OOM 발생 여부 확인

```bash
# 최근 7일간 OOM kill 로그 확인
journalctl -k --since "7 days ago" | grep -i "oom\|out of memory"

# dmesg로 확인
dmesg | grep -i "oom\|killed process"
```

## 현재 메모리 상태 확인

```bash
# 메모리 + Swap
free -h

# 프로세스별 메모리 사용량 (상위 10개)
ps aux --sort=-%mem | head -11

# Swap 사용 중인 프로세스
for f in /proc/*/status; do
  awk '/VmSwap|Name/{printf $2 " " $3}END{print ""}' $f 2>/dev/null
done | sort -k 2 -n -r | head -10
```

---

# 4. 해결책

## 4.1 Swap 확장

```bash
# 기존 Swap 끄기
sudo swapoff /swap.img

# 기존 파일 삭제
sudo rm /swap.img

# 새 Swap 파일 생성 (24GB)
sudo fallocate -l 24G /swap.img
sudo chmod 600 /swap.img
sudo mkswap /swap.img
sudo swapon /swap.img

# 확인
free -h

# 재부팅 후에도 유지
grep swap /etc/fstab
# 없으면 추가:
echo '/swap.img none swap sw 0 0' | sudo tee -a /etc/fstab
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Swap 크기 가이드:                                          │
│                                                             │
│  RAM 크기     │  권장 Swap (Claude Code 사용 시)           │
│  8GB          │  16GB                                      │
│  16GB         │  16-24GB                                   │
│  32GB         │  16-24GB                                   │
│  64GB         │  8-16GB                                    │
│                                                             │
│  디스크 여유 있으면 넉넉하게 잡는 게 안전                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.2 SSH/tmux를 OOM Kill에서 보호

```bash
# sshd OOM 점수 낮추기 (-900 = 거의 죽이지 마)
sudo mkdir -p /etc/systemd/system/ssh.service.d
sudo tee /etc/systemd/system/ssh.service.d/oom.conf << 'EOF'
[Service]
OOMScoreAdjust=-900
EOF
sudo systemctl daemon-reload
sudo systemctl restart ssh
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  OOMScoreAdjust 범위:                                      │
│  -1000: 절대 죽이지 않음                                   │
│  -900:  거의 죽이지 않음 (권장)                            │
│  0:     기본값                                              │
│  +1000: 가장 먼저 죽임                                     │
│                                                             │
│  sshd를 보호하면:                                           │
│  OOM 시 Claude/Docker가 먼저 죽고                          │
│  SSH 세션은 유지됨                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.3 Docker 컨테이너 메모리 제한

```bash
# 실행 시 메모리 제한
docker run --memory=4g --memory-swap=6g <image>

# docker-compose.yml
services:
  java-app:
    image: my-java-app
    deploy:
      resources:
        limits:
          memory: 4G
    # 또는
    mem_limit: 4g
    memswap_limit: 6g
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Java 컨테이너 특히 주의:                                   │
│  ├── JVM은 기본적으로 호스트 메모리의 25% 사용             │
│  ├── 32GB 호스트 → JVM이 8GB 잡을 수 있음                  │
│  ├── 반드시 -Xmx로 제한하거나 Docker 제한 걸기            │
│  └── Java 10+: -XX:+UseContainerSupport (기본 활성)       │
│                                                             │
│  예:                                                        │
│  docker run --memory=4g my-java-app                        │
│  → JVM이 컨테이너 메모리를 인식하여 자동 조절             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.4 Swappiness 조정

```bash
# 현재 값 확인
cat /proc/sys/vm/swappiness
# 기본: 60

# 10으로 변경 (RAM 우선 사용, Swap은 정말 필요할 때만)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl vm.swappiness=10
```

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  swappiness 값:                                             │
│  0:   Swap 거의 안 씀 (OOM 위험 높음)                     │
│  10:  RAM 우선, Swap은 긴급 시에만 (권장)                  │
│  60:  기본값 (적극적으로 Swap 사용)                        │
│  100: 최대한 Swap 사용                                     │
│                                                             │
│  Claude Code 환경:                                          │
│  ├── 10 권장 (RAM이 충분하므로)                            │
│  ├── RAM에서 빠르게 실행                                   │
│  └── Swap은 안전망으로만 사용                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.5 Claude Code 캐시 자동 정리

```bash
#!/bin/bash
# ~/cleanup-claude.sh

# debug 로그 정리 (7일 이상)
find ~/.claude/debug/ -mtime +7 -delete 2>/dev/null

# 오래된 transcript 정리 (30일 이상)
find ~/.claude/transcripts/ -mtime +30 -delete 2>/dev/null

# /tmp 의 claude 관련 정리
find /tmp -name "claude*" -mtime +1 -delete 2>/dev/null

# Node.js 컴파일 캐시 정리
rm -rf /tmp/node-compile-cache 2>/dev/null

du -sh ~/.claude/
```

```bash
# cron으로 매일 새벽 4시 자동 실행
chmod +x ~/cleanup-claude.sh
(crontab -l 2>/dev/null; echo "0 4 * * * $HOME/cleanup-claude.sh") | crontab -
```

---

# 5. 모니터링

## 메모리 감시 스크립트

```bash
#!/bin/bash
# ~/mem-watch.sh
# 메모리 80% 초과 시 경고

THRESHOLD=80
USAGE=$(free | awk '/Mem:/{printf "%.0f", $3/$2 * 100}')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "[WARN] Memory usage: ${USAGE}% ($(date))" >> ~/mem-alert.log
    # 선택: 큰 프로세스 로깅
    ps aux --sort=-%mem | head -5 >> ~/mem-alert.log
fi
```

```bash
# 5분마다 감시
(crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/mem-watch.sh") | crontab -
```

---

# 6. 적용 체크리스트

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  OOM 방지 체크리스트:                                       │
│                                                             │
│  □ Swap 확장 (RAM의 50-75% 이상)                           │
│  □ sshd OOM 보호 (OOMScoreAdjust=-900)                     │
│  □ Docker 메모리 제한 (--memory)                           │
│  □ Swappiness 조정 (60 → 10)                               │
│  □ Claude 캐시 자동 정리 (cron)                            │
│  □ 메모리 모니터링 설정                                     │
│                                                             │
│  가장 효과 큰 것 (우선순위):                                │
│  1. Swap 확장 (즉각적 효과)                                │
│  2. Docker 메모리 제한 (근본 원인 차단)                    │
│  3. sshd OOM 보호 (세션 보존)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 관련 키워드

`OOM Killer`, `Out of Memory`, `Swap`, `SSH 끊김`, `tmux 세션`, `Claude Code`, `Docker 메모리 제한`, `swappiness`, `OOMScoreAdjust`, `oom_score`, `메모리 관리`, `캐시 정리`
