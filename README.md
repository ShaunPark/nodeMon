# Node Problem Detector and DrainO 설치
Node-problem-detector와 draino 설치 방법

## Node-problem-detector 설치 방법
1. helm 설치
2. repository 추가
```
  helm repo add deliveryhero https://charts.deliveryhero.io/
```
3. 추가 설정파일을 이용하여 설치
```
  helm install -f npd-config.yaml node-problem-detector deliveryhero/node-problem-detector 
```
변경내용
- prometheus exporter 비 활성화
- EFS관련 condition 추가
- kernel log 모니터 외 모니터 비 활성화

## DrainO 설치 방법
```
  kubectl apply -f draino.yaml
```
변경내용
- Drain 대상 condition 변경
- pod 리소스 설정
- 추가적인 eviction 옵션 설정


TODO
-테스트방법추가
