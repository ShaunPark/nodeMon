import * as k8s from '@kubernetes/client-node';

export default class K8SInformer {
    protected kubeConfig: k8s.KubeConfig;
    protected k8sApi: k8s.CoreV1Api;

    constructor(private kubeConfigLoc?: string) {
        this.kubeConfig = new k8s.KubeConfig()

        if (this.kubeConfigLoc) {
            try {
                this.kubeConfig.loadFromFile(this.kubeConfigLoc)
            } catch (err) {
                this.kubeConfig.loadFromDefault();
            }
        } else {
            this.kubeConfig.loadFromDefault();
        }
        this.k8sApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    }

    protected reInit() {
        this.kubeConfig = new k8s.KubeConfig()

        if (this.kubeConfigLoc) {
            try {
                this.kubeConfig.loadFromFile(this.kubeConfigLoc)
            } catch (err) {
                this.kubeConfig.loadFromDefault();
            }
        } else {
            this.kubeConfig.loadFromDefault();
        }
        this.k8sApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    }
}