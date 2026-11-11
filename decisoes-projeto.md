# Entrega Técnica Fase 2 — Unificação, Tratamento, Modelagem e Armazenamento dos Dados

**Tema:** Dinâmica de Emprego Formal e Turnover Setorial
**Disciplina:** Big Data e Analytics

---

## 1. Entregável: Base de Dados Tratada

### 1.1 Origem dos dados

- **Fonte oficial:** Novo CAGED (Cadastro Geral de Empregados e Desempregados), Ministério do Trabalho e Emprego (MTE), divulgado via PDET.
- **Camada de acesso:** [Base dos Dados](https://basedosdados.org/dataset/562b56a3-0b01-4735-a049-eeac5681f056), plataforma que republica os microdados oficiais do CAGED tratados no Google BigQuery.
- **Tabela consultada:** `basedosdados.br_me_caged.microdados_movimentacao`, com apoio das tabelas `basedosdados.br_me_caged.dicionario` (tradução de códigos) e `basedosdados.br_bd_diretorios_brasil.cnae_2` / `.uf` / `.municipio` (diretórios de setor e localização).

### 1.2 Versão original utilizada

- **Recorte temporal:** agosto/2025 a janeiro/2026 (6 meses), Brasil inteiro — janela definida para caber no limite de 1 GB do free tier do PostgreSQL (Aiven), tendo janeiro/2026 como o mês mais recente disponível na fonte no momento da coleta.
- **Volume bruto no recorte:** **25.004.635 linhas** (uma linha por movimentação individual de trabalhador).
- **Decisão de agregação:** em vez de extrair os microdados individuais, os dados foram **agregados diretamente no BigQuery**, por combinação de (ano, mês, UF, setor/CNAE-seção, sexo, raça/cor, tipo de movimentação), com contagem de movimentações e médias de salário e idade por grupo.
- **Justificativa (5 V's — Volume):** a agregação sacrifica a granularidade individual (não é mais possível calcular mediana exata ou desvio-padrão por trabalhador), mas preserva integralmente os cruzamentos necessários aos KPIs do projeto (turnover por setor, por sexo, por raça/cor, e gap salarial entre grupos), respeitando o limite de armazenamento da infraestrutura.
- **Volume agregado resultante (CSV de entrada do ETL):** **137.920 linhas**, exportadas do BigQuery para `caged.csv`.

### 1.3 Versão resultante após o tratamento

- **137.920 linhas** carregadas na base final (nenhuma linha foi perdida no tratamento — todas as inconsistências encontradas foram normalizadas, não descartadas, exceto quando explicitamente justificado).
- Dados armazenados em schema relacional estrela no PostgreSQL (Aiven), detalhado na Seção 3.

### 1.4 Principais decisões tomadas e justificativas

| # | Inconsistência encontrada | Decisão tomada | Justificativa |
|---|---|---|---|
| 1 | Volume bruto (25M linhas) excede o limite de 1 GB do banco free tier | Agregação por dimensões de negócio diretamente no BigQuery, antes da extração | Reduz o volume em ~99,4% (25M → 137,9K linhas) sem perda dos cruzamentos necessários aos KPIs do projeto; é a prática correta de engenharia de dados diante de uma restrição real de infraestrutura (V de Volume) |
| 2 | Campo `tipo_movimentacao` vazio em 25.655 das 137.920 linhas (18,6%) | Investigação confirmou que o código de origem é `97`, não documentado no dicionário oficial do CAGED/Base dos Dados, e que nenhum código oficial de admissão (`10`, `20`, `25`, `70`) aparece no recorte. O valor vazio foi preenchido como **"Admissão"** | Decisão de negócio documentada e assumida conscientemente diante da ausência de confirmação oficial — alternativa de simplesmente descartar as linhas eliminaria 18,6% da base sem justificativa técnica melhor (V de Veracidade) |
| 3 | Campo `sigla_uf` com o valor textual `"UF não identificada"` em 341 linhas (0,25%) | Normalizado para o código especial **`"XX"`**, mantendo a linha na base em vez de removê-la | Preserva o dado de volume/salário/idade da movimentação mesmo sem a dimensão geográfica completa; volume residual (0,25%) não compromete a análise agregada por UF (V de Veracidade) |
| 4 | Textos longos do CAGED (ex: "Desligamento Por Acordo Entre Empregado E Empregador") excediam o tamanho de coluna inicialmente definido no schema | Colunas `tipo_movimentacao` (VARCHAR 30→100) e `raca_cor` (VARCHAR 30→50) alargadas no schema | Ajuste técnico de modelagem para acomodar os valores reais de texto do dicionário oficial sem truncamento |
| 5 | Padronização geral | Tipagem explícita de colunas numéricas (ano, mês, total de movimentações, salário médio, idade média), remoção de duplicatas exatas e de linhas com dimensões essenciais ausentes (UF, setor, sexo, raça/cor), trim de espaços em colunas de texto | Garante veracidade e consistência antes da carga no banco relacional |

---

## 2. Entregável: Processo de Tratamento dos Dados

### 2.1 Ferramentas utilizadas

- **Extração e agregação:** SQL no Google BigQuery (via Base dos Dados), reduzindo volume na origem antes de qualquer download
- **Tratamento (ETL):** Python (pandas para limpeza/tipagem, psycopg2 para carga no PostgreSQL)
- **Armazenamento:** PostgreSQL gerenciado (Aiven, free tier), provisionado via Terraform (Infraestrutura como Código)

### 2.2 Código do processo

O processo está disponível no repositório, na pasta `/etl`:

- **`etl.py`** — script principal, com três etapas claras:
  1. **Extract**: leitura do CSV agregado exportado do BigQuery
  2. **Transform**: tipagem, tratamento das inconsistências descritas na Seção 1.4 (com logging explícito de cada decisão aplicada), remoção de duplicatas
  3. **Load**: carga das 5 tabelas de dimensão (idempotente, via `ON CONFLICT DO NOTHING`) seguida da tabela fato
- **`schema.sql`** — definição completa do schema relacional (Seção 3)
- **`requirements.txt`** — dependências Python (pandas, psycopg2-binary, python-dotenv)
- **`README.md`** — instruções de execução

### 2.3 Decisões técnicas adotadas no processo

- **Agregação feita na origem (BigQuery), não no Python**: evita baixar 25M de linhas para depois agregar localmente — mais eficiente e compatível com o free tier.
- **Dimensões carregadas antes do fato, com resolução de chaves em memória**: o script primeiro insere os valores únicos de cada dimensão (com `ON CONFLICT DO NOTHING` para permitir reexecução sem duplicar dimensões), recupera os IDs gerados, e só então monta e insere a tabela fato já com as chaves estrangeiras resolvidas.
- **Logging de cada decisão de tratamento**: o script registra no console quantas linhas foram afetadas por cada regra de limpeza (ex: "25.655 valores vazios preenchidos como Admissão"), tornando o processo auditável.
- **Transação única por carga**: todas as inserções de uma execução ocorrem dentro de uma transação (`commit`/`rollback`), evitando estado parcial no banco em caso de erro.

---

## 3. Entregável: Base Armazenada em Banco de Dados

### 3.1 Infraestrutura

- **Serviço:** PostgreSQL gerenciado na Aiven (plano free tier, 1 GB)
- **Provisionamento:** Terraform (Infraestrutura como Código), com o serviço sob controle do state do Terraform
- **Banco:** `turnover_setorial`

### 3.2 Estratégia de modelagem: Modelo Estrela (Star Schema)

**Justificativa da escolha:** o modelo estrela foi escolhido por otimizar leitura — essencial para um dashboard analítico com filtros cruzados e drill-down. As dimensões (poucas linhas: ~27 UFs, ~21 setores, poucas combinações de sexo×raça/cor) ficam separadas da tabela fato (que concentra os volumes e métricas), reduzindo redundância de texto repetido e permitindo índices eficientes nas chaves estrangeiras mais consultadas pelo dashboard.

### 3.3 Entidades e estrutura

| Tabela | Tipo | Campos | Chave |
|---|---|---|---|
| `dim_tempo` | Dimensão | `id_tempo` (SERIAL, PK), `ano` (SMALLINT), `mes` (SMALLINT) | UNIQUE(ano, mes) |
| `dim_localizacao` | Dimensão | `id_localizacao` (SERIAL, PK), `sigla_uf` (CHAR(2)) | UNIQUE(sigla_uf) |
| `dim_setor` | Dimensão | `id_setor` (SERIAL, PK), `cnae_2_secao` (VARCHAR(5)), `setor_descricao` (VARCHAR(255)) | UNIQUE(cnae_2_secao) |
| `dim_perfil` | Dimensão | `id_perfil` (SERIAL, PK), `sexo` (VARCHAR(20)), `raca_cor` (VARCHAR(50)) | UNIQUE(sexo, raca_cor) |
| `dim_tipo_movimentacao` | Dimensão | `id_tipo_movimentacao` (SERIAL, PK), `tipo_movimentacao` (VARCHAR(100)) | UNIQUE(tipo_movimentacao) |
| `fato_movimentacao` | Fato | `id_fato` (BIGSERIAL, PK), `id_tempo` (INT, FK), `id_localizacao` (INT, FK), `id_setor` (INT, FK), `id_perfil` (INT, FK), `id_tipo_movimentacao` (INT, FK), `total_movimentacoes` (INT), `salario_medio` (NUMERIC(10,2)), `idade_media` (NUMERIC(4,1)) | — |

### 3.4 Relacionamentos

A tabela `fato_movimentacao` se relaciona com cada uma das 5 dimensões por chave estrangeira (1:N — cada combinação de dimensões pode ter uma linha de fato por mês/UF/setor/perfil/tipo de movimentação). Índices foram criados em todas as chaves estrangeiras da tabela fato (`idx_fato_tempo`, `idx_fato_localizacao`, `idx_fato_setor`, `idx_fato_perfil`, `idx_fato_tipo_mov`) para acelerar os filtros cruzados que o dashboard dinâmico vai executar.

### 3.5 Quantidade de dados armazenados

- **Tabela fato (`fato_movimentacao`):** **137.920 linhas** (100% do CSV agregado, nenhuma linha perdida no tratamento)
- **Dimensões:** populadas dinamicamente a partir dos valores únicos encontrados nos dados (ordem de grandeza: dezenas de UFs, dezenas de setores, poucas combinações de perfil demográfico e de tipo de movimentação)

---

## 4. Resumo executivo das decisões (para apresentação)

1. 25 milhões de registros brutos → agregados no BigQuery → 137.920 linhas, preservando todos os cruzamentos necessários para os KPIs
2. Duas inconsistências de dados identificadas e tratadas de forma documentada (não descartadas sem critério): código de movimentação não documentado (`97` → "Admissão") e UF não identificada (→ código `"XX"`)
3. Schema estrela relacional, com 5 dimensões + 1 fato, provisionado via Terraform e populado via ETL Python idempotente nas dimensões
4. 100% dos dados do CSV agregado foram carregados com sucesso no banco final