output "db_instance_id" {
  description = "The RDS instance identifier."
  value       = aws_db_instance.this.id
}

output "db_endpoint" {
  description = "Connection endpoint (host:port) of the database."
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "Hostname of the database."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Port the database listens on."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Name of the initial database."
  value       = aws_db_instance.this.db_name
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret holding the DB credentials."
  value       = aws_secretsmanager_secret.db.arn
}

output "secret_name" {
  description = "Name of the Secrets Manager secret."
  value       = aws_secretsmanager_secret.db.name
}
