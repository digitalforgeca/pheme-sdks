pipeline {
    agent any
    environment {
        PATH = "/root/.cargo/bin:/usr/local/go/bin:/usr/share/dotnet:${env.PATH}"
        DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    }
    stages {
        stage('TypeScript') {
            parallel {
                stage('Pheme TS') {
                    steps {
                        dir('typescript/pheme') {
                            sh 'npm ci && npm run typecheck && npm run lint && npm test && npm run build'
                        }
                    }
                }
                stage('KYA TS') {
                    steps {
                        dir('typescript/kya') {
                            sh 'npm ci && npm run typecheck && npm run lint && npm test && npm run build'
                        }
                    }
                }
            }
        }
        stage('Python') {
            parallel {
                stage('Pheme Py') {
                    steps {
                        dir('python/pheme') {
                            sh 'python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && python -m pytest'
                        }
                    }
                }
                stage('KYA Py') {
                    steps {
                        dir('python/kya') {
                            sh 'python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && python -m pytest'
                        }
                    }
                }
            }
        }
        stage('Go') {
            parallel {
                stage('Pheme Go') {
                    steps {
                        dir('go/pheme') {
                            sh 'go vet ./... && go build ./... && go test ./...'
                        }
                    }
                }
                stage('KYA Go') {
                    steps {
                        dir('go/kya') {
                            sh 'go vet ./... && go build ./... && go test ./...'
                        }
                    }
                }
            }
        }
        stage('Rust') {
            parallel {
                stage('Pheme Rust') {
                    steps {
                        dir('rust/pheme') {
                            sh 'cargo check && cargo clippy -- -D warnings && cargo test'
                        }
                    }
                }
                stage('KYA Rust') {
                    steps {
                        dir('rust/kya') {
                            sh 'cargo check && cargo clippy -- -D warnings && cargo test'
                        }
                    }
                }
            }
        }
        stage('C#') {
            parallel {
                stage('Pheme C#') {
                    steps {
                        dir('csharp/pheme') {
                            sh 'dotnet restore && dotnet build --no-restore && dotnet test --no-build'
                        }
                    }
                }
                stage('KYA C#') {
                    steps {
                        dir('csharp/kya') {
                            sh 'dotnet restore && dotnet build --no-restore && dotnet test --no-build'
                        }
                    }
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
