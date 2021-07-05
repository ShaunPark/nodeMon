node {
     def app

     stage('Clone repository') {
         /* Let's make sure we have the repository cloned to our workspace */

         checkout scm
     }

     stage('Build image') {
         /* This builds the actual image; synonymous to
         * docker build on the command line */

         app = docker.build("coolage/node-mon")
     }

     stage('Test image') {
         sh 'npm test'
     }

     stage('Push image') {
         /* Finally, we'll push the image with two tags:
         * First, the incremental build number from Jenkins
         * Second, the 'latest' tag.
         * Pushing multiple tags is cheap, as all the layers are reused. */
         docker.withRegistry('https://registry.hub.docker.com', 'docker hub') {
             app.push("${env.BUILD_NUMBER}")
             app.push("latest")
         }
     }

    //  stage('Kubernetes deploy') {
    //     steps {
    //         kubernetesDeploy configs: "deployment.yaml", kubeconfigId: 'springboot'
    //         sh "kubectl --kubeconfig=/root/.jenkins/.kube/config rollout restart deployment/wildfly-deployment"
    //     }
    // }
 }
