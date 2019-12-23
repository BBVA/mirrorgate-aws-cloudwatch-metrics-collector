#!groovy

node ('global') {

    try {

        stage('Checkout') {
            checkout(scm)
        }

        stage('Build') {
            sh """
                docker-compose -p \${BUILD_TAG} run -u \$(id -u) install
            """
        }

        stage('Package Zip') {
            sh """
                docker-compose -p \${BUILD_TAG} run -u \$(id -u) package
            """
        }

        stage('Publish on Jenkins') {
            step([$class: "ArtifactArchiver", artifacts: ".serverless/*.zip", fingerprint: true])
        }

    } finally {
        sh """
            docker-compose -p \${BUILD_TAG} down --volumes
        """
    }

}