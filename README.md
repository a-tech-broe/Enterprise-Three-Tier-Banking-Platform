# Enterprise-Three-Tier-Banking-Platform
A bank wants an automated platform where every environment (Dev, QA, UAT, Prod) is created from Git.  No engineer is allowed to manually create AWS resources.


Architecture
GitHub
    │
    ▼
GitHub Actions
    │
    ├── Terraform Plan
    ├── Security Scan
    ├── Manual Approval
    ├── Terraform Apply
    │
    ▼
AWS

VPC
├── Public Subnets
│      └── ALB
│
├── Private App Subnets
│      ├── EC2 Auto Scaling
│      ├── Bastion disabled
│      └── CloudWatch Agent
│
└── Private DB Subnets
       └── Multi-AZ RDS PostgreSQL

Terraform builds

* Custom VPC
* 3 Availability Zones
* Internet Gateway
* NAT Gateways
* Route Tables
* Security Groups
* IAM Roles
* KMS
* S3 backend
* DynamoDB locking
* Application Load Balancer
* Launch Template
* Auto Scaling Group
* ACM Certificate
* Route53
* RDS PostgreSQL
* Secrets Manager
* CloudWatch
* SNS Notifications

Ansible configures

When Terraform finishes:

Configure every EC2 automatically.

Install

* Docker
* CloudWatch Agent
* Node Exporter
* Amazon SSM Agent
* Fail2Ban
* Nginx
* Java
* Python
* Security updates

Then

* Deploy application
* Configure log rotation
* Configure firewall
* Configure users/groups
* Configure SSH hardening
* Disable password login
* Install monitoring agents

⸻

GitHub Actions pipeline
Pull Request

↓

terraform fmt

↓

terraform validate

↓

tflint

↓

checkov

↓

terraform plan

↓

upload artifact

↓

Approval

↓

terraform apply

↓

Run Ansible

↓

Smoke Test

↓

Notify Slack

Repository
banking-platform

terraform/
    modules/
        vpc/
        alb/
        rds/
        ec2/
        iam/
        kms/
        cloudwatch/

ansible/

    inventories/

    roles/

        common
        docker
        nginx
        java
        monitoring
        security

.github/

    workflows/

        validate.yml
        plan.yml
        deploy.yml
        destroy.yml


Skills demonstrated

* Infrastructure as Code
* Configuration Management
* Immutable Infrastructure
* GitOps
* DevSecOps
* Enterprise Networking
* Auto Scaling
* IAM
* Security
* Monitoring

       
