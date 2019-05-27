#!groovy

AWS_CLOUDWATCH_COLLECTOR_ARTIFACT = 'mirrorgate-aws-cloudwatch-metrics-collector.zip'

node ('global') {

    try {

        stage('Checkout') {
            checkout(scm)
        }

        stage('Build') {
            sh """
                npm install
                cd collector
                npm install --production
            """
        }

        stage('Package Zip') {
             sh """
                npm run package
            """
        }

        stage('Publish on Jenkins') {
      	    step([$class: "ArtifactArchiver", artifacts: "build/${AWS_CLOUDWATCH_COLLECTOR_ARTIFACT}", fingerprint: true])
        }

    } catch(Exception e) {
        throw e;
    }
}