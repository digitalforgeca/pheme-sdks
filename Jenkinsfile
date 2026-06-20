pipeline {
    agent any
    stages {
        stage('TypeScript - Pheme') {
            steps {
                dir('typescript/pheme') {
                    sh 'npm ci && npm run typecheck && npm run lint && npm test && npm run build'
                }
            }
        }
        stage('TypeScript - KYA') {
            steps {
                dir('typescript/kya') {
                    sh 'npm ci && npm run typecheck && npm run lint && npm test && npm run build'
                }
            }
        }
        stage('Python - Pheme') {
            steps {
                dir('python/pheme') {
                    sh 'python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && python -m pytest'
                }
            }
        }
        stage('Python - KYA') {
            steps {
                dir('python/kya') {
                    sh 'python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && python -m pytest'
                }
            }
        }
        stage('Go - Pheme') {
            steps { dir('go/pheme') { sh 'go vet ./... && go build ./... && go test ./...' } }
        }
        stage('Go - KYA') {
            steps { dir('go/kya') { sh 'go vet ./... && go build ./... && go test ./...' } }
        }
        stage('Rust - Pheme') {
            steps { dir('rust/pheme') { sh 'cargo check && cargo clippy -- -D warnings && cargo test' } }
        }
        stage('Rust - KYA') {
            steps { dir('rust/kya') { sh 'cargo check && cargo clippy -- -D warnings && cargo test' } }
        }
        stage('C# - Pheme') {
            steps { dir('csharp/pheme') { sh 'dotnet restore && dotnet build --no-restore && dotnet test --no-build' } }
        }
        stage('C# - KYA') {
            steps { dir('csharp/kya') { sh 'dotnet restore && dotnet build --no-restore && dotnet test --no-build' } }
        }
    }
}
