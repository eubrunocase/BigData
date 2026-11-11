# ETL — Turnover Setorial (CAGED)

## Pré-requisitos
- Python 3.10+
- Banco PostgreSQL já provisionado (via Terraform) e com as tabelas do schema estrela criadas
- CSV exportado do BigQuery (resultado da query de agregação) disponível localmente

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Criar as tabelas no banco (uma vez, antes do primeiro ETL)

Rode o script SQL do schema estrela (dimensões + fato) no seu banco Postgres antes de
executar o ETL — via `psql`, DBeaver, ou o client SQL de sua preferência.

## Rodar o ETL

```bash
python etl.py
```

## O que o script faz

1. **Extract**: lê o CSV agregado (resultado da query BigQuery)
2. **Transform**:
   - Tipagem correta de colunas (ano, mês, salário médio, idade média)
   - Tratamento do código de movimentação "97" (não documentado no dicionário oficial
     do CAGED) como "Admissão" — decisão de negócio documentada no README principal
     do projeto
   - Remoção de linhas com dimensões essenciais ausentes e de duplicatas
   - Padronização de texto (trim de espaços)
3. **Load**:
   - Popula as tabelas de dimensão (`dim_tempo`, `dim_localizacao`, `dim_setor`,
     `dim_perfil`, `dim_tipo_movimentacao`), evitando duplicatas via `ON CONFLICT`
   - Popula a tabela fato (`fato_movimentacao`) com as chaves estrangeiras já resolvidas

O script é idempotente nas dimensões (pode rodar mais de uma vez sem duplicar valores
de dimensão), mas a tabela fato não tem checagem de duplicidade — rodar o ETL duas
vezes com o mesmo CSV duplica as linhas de fato. Se precisar re-rodar, trunque a tabela
fato antes: `TRUNCATE TABLE fato_movimentacao;`