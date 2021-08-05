# node-mon
노드의 특정 컨디션 변경(장애 발생) 발생에 의해 DrainO가 노드를 drain하면 해당 노드를 리부트 하는 모니터링 툴

## 동작개요 

### 장애 대응
  - Node Problem Detector 과 DrainO에 의해 Drain된 노드의 리부트 혹은 종료
  - DrainO에 의해 노드가 Drain작업을 수행하면 성공/실패여부에 상관없이 해당 노드를 재 부팅 혹은 종료시킴

### 주기적으로 일정 비율에 대한 노드를 재 부팅 - Private 환경에 대해서만 수행
 - cordon 판단 시점이 되면. 일정기간이상(예시: 14일) 재 부팅이 되지않은 경우 먼저 cordon을 수행. 단, 일일  최대 리부트 숫자보다 큰 경우 최대 리부트 수 만큼만 cordon을 수행함.
 - cordon을 수행하면 "RebootScheduled" 컨디션이 활성화 됨.
 - reboot 시점이 되면, 먼저 cordon이된 노드 수("RebootScheduled" 컨디션이 활성화 된 노드들) 확인
 - 해당 숫자가 최대 리부트 숫자보다 작은 경우, 그 외의 노드들 중에서 worker가 실행되지 않고 있는 노드들 중에서 리부트 된지 가장 오래된 노드 순으로 리부트 대상에 추가
 - 리부트 대상이 선정되면, 해당 노드의 "RebootRequested" 컨디션을 활성화 함.
 - 노드의 "RebootRequested" 컨디션이 활성화 되면 DrainO가 해당 노드를 drain 함
 - Drain이 완료되면 해당 노드에 대한 리부트 수행
 - 리부트가 완료되면, 사용된 컨디션을 모두 제거하고 uncordon수행 

## node-mon 설정파일 
<예시>
```
    rebootThroughSSH: true
    kubernetes:
        nodeSelector: "worker=enabled"
        workerPodLabelSelector: "component=worker"
    nodeManager:
        sshPemFile: "/etc/ssl/certs/my.pem"
        sshUser: "ubuntu"
        awsRegion: "ap-northeast-2"
        awsVPC: "vpc-08d52a53e0cfxxxxx"
    elasticSearch:
        host: 1.1.1.1
        port: 9200
        logIndex: log
        statusIndex: status
        id: "elastic"
    maintenance:
        runMaintenance: true
        maxLivenessDays: 14
        cordonStartHour: "20:00+09:00"
        cordonEndHour: "21:00+09:00"
        startHour: "03:00+09:00"
        endHour: "05:00+09:00"
        ratio: 20
        rebootBuffer: 15
```

- rebootThroughSSH: 서버에 대한 reboot 혹은 종료를 수행하는 방법. 매니지드 클러스터를 사용하여 인스턴스를 종료해야 하는 경우에는  false, 개별 서버를 사용하여 서버를 reboot해야 하는 경우에는 true로 설정
- kubernetes: 쿠버네티스 모니터링 관련 설정
    - nodeSelector: 모니터링 대상 노드를 선택하기 위한 LabelSelector를 정의. 없으면 모든 노드 에 대해 모니터링 
    - workerPodLabelSelector: 실행 중인 Pod중에 "worker" pod를 선택하기 위한 LabelSelector를 정의.
    노드를 주기적으로 리부트하는 경우에 해당 노드에 "worker" pod가 실행중이면 우선순위가 뒤로 밀림 
- nodeManager: 
    - sshPemFile: SSH 연결을 위한 pem 키 파일의 위치 설정. deploy.yaml에 설정된 값과 동일하게 유지해야 함. "/etc/ssl/certs/my.pem"
    - sshUser: SSH연결 수행 시 사용하는 OS 계정을 정의
    - awsRegion: AWS상의 EKS 모니터링 시 해당 클러스터가 실행중인 region 명
    - awsVPC: AWS상의 EKS 모니터링 시 해당 클러스터가 실행중인 VPI ID
- elasticSearch: Elastic Search 관련 설정
    - host: Elastic Search 호스트 명 혹은 IP 주소
    - port: Elastic Search 서비스 포트 번호
    - logIndex: 처리 로그를 남기기 위한 인덱스 명. 없으면 자동 생성
    - statusIndex: 노드 상태를 남기기 위한 인덱스 명. 없으면 자동 생성
    - id: Elastic Search 아이디 
- maintenance: 주기적 노드 리부트를 위한 설정
    - runMaintenance: 주기적으로 노드 리부트를 수행할 것인지 여부 
    - maxLivenessDays: 리부트 없이 실행되는 최대일수. 14로 설정된 경우 리부트된지 14일이 지났으면, cordon 시간대에 해당 노드에 대해 cordon을 수행하고 reboot 시간대가 되면 reboot를 수행
    - cordonStartHour: maxLivenessDays 보다 오랜시간 리부트 되지 않은 노드에 대해새 cordon을 수행하는 시간대 의 시작 시각. 시간만 정의하며 한국시간으로 표시할 경우 뒤에"+09:00"을 추가. 예시 - "20:00+09:00"
    - cordonEndHour: maxLivenessDays 보다 오랜시간 리부트 되지 않은 노드에 대해새 cordon을 수행하는 시간대 의 종료 시각. 시간만 정의하며 한국시간으로 표시할 경우 뒤에"+09:00"을 추가. 예시 - "21:00+09:00"
    - rebootStartHour: 주기적으로 리부트를 수행하는 시간대 의 시작 시각. 시간만 정의하며 한국시간으로 표시할 경우 뒤에"+09:00"을 추가. 예시 - "03:00+09:00"
    - rebootEndHour: 주기적으로 리부트를 수행하는 시간대 의 종료 시각. 시간만 정의하며 한국시간으로 표시할 경우 뒤에"+09:00"을 추가. 예시 - "05:00+09:00"
    - ratio: 전체 노드 중 리부트를 수행할 최대 노드 수의 비율. 퍼센트로 입력. 20인경우 20%의 노드를 주기적으로 리부트
    - rebootBuffer: 리부트 대상 서버가 여럿일 경우, 각 리부트 간의 시간 간격. 분 단위로 입력
