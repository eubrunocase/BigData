variable "aiven_api_token" {
  description = "Token de API da Aiven (NUNCA commitar o valor real no Git)"
  type        = string
  sensitive   = true
}

variable "aiven_project_name" {
  description = "Nome do projeto já criado no console da Aiven"
  type        = string
}

variable "service_name" {
  description = "Nome do serviço PostgreSQL a ser criado"
  type        = string
  default     = "turnover-pg"
}

variable "database_name" {
  description = "Nome do banco de dados dentro do serviço"
  type        = string
  default     = "turnover_setorial"
}

variable "plan" {
  description = "Nome do plano do serviço (confirme o nome exato do plano free no console da Aiven)"
  type        = string
  default     = "free"
}

variable "cloud_name" {
  description = "Região da infraestrutura"
  type        = string
  default     = "do-ams"
}

variable "dashboard_ro_username" {
  description = "Nome do usuário somente leitura usado pela API do dashboard"
  type        = string
  default     = "dashboard_ro"
}