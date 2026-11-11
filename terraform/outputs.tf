output "postgresql_service_uri" {
  description = "String de conexão completa do PostgreSQL"
  value       = aiven_pg.postgresql.service_uri
  sensitive   = true
}

output "postgresql_host" {
  description = "Host do banco"
  value       = aiven_pg.postgresql.service_host
}

output "postgresql_port" {
  description = "Porta do banco"
  value       = aiven_pg.postgresql.service_port
}

output "database_name" {
  description = "Nome do banco de dados criado"
  value       = aiven_pg_database.database.database_name
}

output "dashboard_ro_username" {
  description = "Usuário somente leitura do dashboard"
  value       = aiven_pg_user.dashboard_ro.username
}

output "dashboard_ro_password" {
  description = "Senha do usuário somente leitura (sensível: use apenas em dashboard/api/.env)"
  value       = aiven_pg_user.dashboard_ro.password
  sensitive   = true
}
