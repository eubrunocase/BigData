terraform {
  required_providers {
    aiven = {
      source  = "aiven/aiven"
      version = "~> 4.0"
    }
  }
}

provider "aiven" {
  api_token = var.aiven_api_token
}

resource "aiven_pg" "postgresql" {
  project      = var.aiven_project_name
  service_name = var.service_name

  # A Aiven define automaticamente a cloud/região no free tier.
  # Ajuste "plan" para o nome exato encontrado no console (ex: "free").
  plan = var.plan

  # Protege o serviço contra remoção acidental via terraform destroy.
  # Deixe "true" em ambiente real; pode ser "false" durante testes iniciais.
  termination_protection = false
}

# ============================================
# Banco de dados dentro do serviço
# ============================================
resource "aiven_pg_database" "database" {
  project       = var.aiven_project_name
  service_name  = aiven_pg.postgresql.service_name
  database_name = var.database_name
}

# ============================================
# Usuário somente leitura para o dashboard
# ============================================
# O provider cria o usuário, mas NÃO gerencia GRANTs de tabela.
# Após o apply, execute os comandos de GRANT documentados em
# dashboard/README.md (seção "Usuário somente leitura").
resource "aiven_pg_user" "dashboard_ro" {
  project      = var.aiven_project_name
  service_name = aiven_pg.postgresql.service_name
  username     = var.dashboard_ro_username
}
