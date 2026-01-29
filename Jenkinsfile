// Jenkinsfile (Declarative Pipeline)
pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
    }

    environment {
        DOCKER_BUILDKIT = '1'
        PIPELINE_SKIP = 'false'
        PIPELINE_SKIP_REASON = ''
    }

    parameters {
        string(name: 'IMAGE_NAME', defaultValue: 'fullstack-template', description: 'Docker 镜像名称')
        string(name: 'CONTAINER_NAME', defaultValue: 'fullstack-template', description: 'Docker 容器名称')
        string(name: 'APP_PORT_MAPPING', defaultValue: '3000:3000', description: '主机端口:容器端口，传给 docker run -p')
        string(name: 'ENV_CREDENTIAL_ID', defaultValue: 'env-production', description: 'Jenkins Credential ID，存放 Secret file 作为 .env.production 文件')
        string(name: 'DOCKER_NETWORK', defaultValue: '1panel-network', description: '可选：容器加入的 Docker 网络，留空则使用默认网络')
    }

    stages {
        stage('检出代码') {
            steps {
                echo '▶ 正在拉取 Git 仓库...'
                checkout scm
                echo '✔️ 代码检出完成'
            }
        }

        stage('评估提交') {
            steps {
                script {
                    // 获取并分析提交信息
                    def commitMsg = sh(returnStdout: true, script: 'git log -1 --pretty=%B').trim()
                    def analysis = evaluateCommitMessage(commitMsg)

                    if (analysis.skip) {
                        echo "ℹ️ 本次流水线因 ${analysis.reason} 被跳过"
                        env.PIPELINE_SKIP = 'true'
                        env.PIPELINE_SKIP_REASON = analysis.reason
                        currentBuild.description = "跳过：${analysis.summary}"
                        currentBuild.result = 'NOT_BUILT'
                        error("流水线根据规则跳过：${analysis.reason}")
                    } else {
                        echo 'ℹ️ 未匹配到跳过规则，继续执行流水线'
                    }
                }
            }
        }

        stage('构建 Docker 镜像') {
            when {
                expression { shouldExecutePipeline() }
            }
            steps {
                script {
                    def imageTag = "${params.IMAGE_NAME}:${env.BUILD_NUMBER}"
                    def envCredentialId = params.ENV_CREDENTIAL_ID?.trim()

                    // 从 Jenkins Credentials 获取 .env.production 文件并复制到构建目录
                    if (envCredentialId) {
                        withCredentials([file(credentialsId: envCredentialId, variable: 'ENV_FILE')]) {
                            sh 'cp "${ENV_FILE}" .env.production'
                        }
                        echo "✔️ 已从 Credentials [${envCredentialId}] 注入 .env.production"
                    } else {
                        echo '⚠️ 未配置 ENV_CREDENTIAL_ID，将使用代码仓库中的默认配置'
                    }

                    echo "▶ 开始构建镜像：${imageTag}"
                    docker.build(imageTag, '.')

                    // 构建完成后删除敏感文件
                    sh 'rm -f .env.production'

                    echo "✔️ 镜像构建完成：${imageTag}"
                }
            }
        }

        stage('部署容器') {
            when {
                expression { shouldExecutePipeline() }
            }
            steps {
                script {
                    def imageTag = "${params.IMAGE_NAME}:${env.BUILD_NUMBER}"
                    def containerName = params.CONTAINER_NAME
                    def portMapping = params.APP_PORT_MAPPING
                    def networkName = params.DOCKER_NETWORK?.trim()
                    def networkArg = networkName ? "--network ${networkName}" : ''

                    echo "▶ 停止并删除旧容器：${containerName}"
                    sh """
                        #!/bin/bash
                        set -e
                        docker ps -aq -f name=${containerName} | xargs -r docker stop
                        docker ps -aq -f name=${containerName} | xargs -r docker rm
                    """

                    echo "▶ 启动新容器：${containerName}（镜像：${imageTag}）"
                    sh """
                        #!/bin/bash
                        set -e
                        docker run -d --name ${containerName} -p ${portMapping} ${networkArg} --restart unless-stopped ${imageTag}
                    """

                    echo "✔️ 新容器已启动：${containerName}"
                }
            }
        }

        stage('清理旧镜像') {
            when {
                expression { shouldExecutePipeline() }
            }
            steps {
                script {
                    echo '▶ 清理旧镜像...'
                    def oldImages = sh(
                        returnStdout: true,
                        script: """
                            docker images ${params.IMAGE_NAME} --format '{{.Repository}}:{{.Tag}}' | grep -v '${params.IMAGE_NAME}:${env.BUILD_NUMBER}' | grep -v '<none>' || true
                        """
                    ).trim()

                    if (oldImages) {
                        echo "ℹ️ 找到旧镜像：\n${oldImages}"
                        sh "echo '${oldImages}' | xargs -r docker rmi"
                        echo '✔️ 旧镜像清理完成'
                    } else {
                        echo 'ℹ️ 未找到需要清理的旧镜像，跳过'
                    }
                }
            }
        }
    }

    post {
        always {
            echo '🏁 流水线执行结束'
        }
        success {
            echo '✅ 流水线执行成功'
        }
        aborted {
            script {
                if (env.PIPELINE_SKIP == 'true') {
                    echo "ℹ️ 流水线根据规则被跳过：${env.PIPELINE_SKIP_REASON ?: '无具体原因'}"
                    currentBuild.result = 'NOT_BUILT'
                } else {
                    echo '⚠️ 流水线被手动终止'
                }
            }
        }
        failure {
            script {
                if (env.PIPELINE_SKIP == 'true') {
                    echo "ℹ️ 流水线根据规则被跳过：${env.PIPELINE_SKIP_REASON ?: '无具体原因'}"
                    currentBuild.result = 'NOT_BUILT'
                } else {
                    echo '❌ 流水线执行失败，请检查日志'
                }
            }
        }
    }
}

@NonCPS
Map evaluateCommitMessage(String commitMsg) {
    // 提取首行并组合需要跳过的原因
    def lines = commitMsg.readLines().collect { line -> line?.trim() }.findAll { line -> line }
    def firstLine = lines ? lines.first() : ''
    def reasons = []

    if (firstLine?.toLowerCase()?.startsWith('chore')) {
        reasons << '提交类型为 chore'
    }
    if (commitMsg ==~ /(?s).*\[(?i)(ci skip|skip ci)\].*/) {
        reasons << '提交信息包含 [ci skip] 标记'
    }

    return [
        skip   : !reasons.isEmpty(),
        reason : reasons.join('，'),
        summary: firstLine?.take(60) ?: ''
    ]
}

boolean shouldExecutePipeline() {
    // 判断是否继续执行构建相关阶段
    return env.PIPELINE_SKIP != 'true'
}
