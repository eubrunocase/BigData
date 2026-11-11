"""
ETL - Dinâmica de Emprego Formal e Turnover Setorial
Lê o CSV agregado exportado do BigQuery (Base dos Dados / Novo CAGED),
trata os dados e carrega no schema estrela do PostgreSQL (Aiven).

Uso:
    python etl.py
"""

import os
import sys
import logging

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from psycopg2.extensions import register_adapter, AsIs


def _adapt_numpy_int(numpy_int):
    return AsIs(int(numpy_int))


def _adapt_numpy_float(numpy_float):
    if np.isnan(numpy_float):
        return AsIs("NULL")
    return AsIs(float(numpy_float))


# psycopg2 não sabe nativamente converter tipos numpy (usados internamente pelo pandas)
# para tipos SQL. Registramos adaptadores explícitos para evitar o erro
# "can't adapt type 'numpy.int64'" ao inserir valores lidos do DataFrame.
register_adapter(np.int64, _adapt_numpy_int)
register_adapter(np.int32, _adapt_numpy_int)
register_adapter(np.float64, _adapt_numpy_float)
register_adapter(np.float32, _adapt_numpy_float)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

load_dotenv()

CSV_PATH = os.getenv("CSV_PATH", "./caged_agregado.csv")

DB_CONFIG = {
    "host": os.getenv("PGHOST"),
    "port": os.getenv("PGPORT", "5432"),
    "dbname": os.getenv("PGDATABASE"),
    "user": os.getenv("PGUSER"),
    "password": os.getenv("PGPASSWORD"),
    "sslmode": os.getenv("PGSSLMODE", "require"),
}


# ============================================
# 1. EXTRAÇÃO
# ============================================
def extract(csv_path: str) -> pd.DataFrame:
    log.info("Lendo CSV de %s", csv_path)
    df = pd.read_csv(csv_path)
    log.info("Linhas lidas: %d", len(df))
    return df


# ============================================
# 2. TRATAMENTO / LIMPEZA (ETL - Data Wrangling)
# ============================================
def transform(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # --- Padronização de nomes de colunas (garantia, caso venham diferentes) ---
    df.columns = [c.strip().lower() for c in df.columns]

    # --- Tipagem correta ---
    df["ano"] = df["ano"].astype(int)
    df["mes"] = df["mes"].astype(int)
    df["total_movimentacoes"] = df["total_movimentacoes"].astype(int)
    df["salario_medio"] = pd.to_numeric(df["salario_medio"], errors="coerce").round(2)
    df["idade_media"] = pd.to_numeric(df["idade_media"], errors="coerce").round(1)

    # --- Tratamento de nulos ---
    # Decisão de negócio (documentada no README): o código de tipo_movimentacao "97"
    # não possui correspondência no dicionário oficial do CAGED/Base dos Dados, e
    # concentra ~50% dos registros do recorte, enquanto os códigos oficiais de admissão
    # (10, 20, 25, 70) não aparecem nos dados. Por isso, tratamos os valores vazios de
    # tipo_movimentacao (originados do código 97) como "Admissão".
    antes_vazios = df["tipo_movimentacao"].isna().sum()
    df["tipo_movimentacao"] = df["tipo_movimentacao"].fillna("Admissão")
    log.info(
        "tipo_movimentacao: %d valores vazios preenchidos como 'Admissão' (código 97 não documentado)",
        antes_vazios,
    )

    # Decisão de negócio (documentada no README): o CAGED usa o texto "UF não identificada"
    # quando o município/UF do estabelecimento não pôde ser determinado (341 de 137.920
    # linhas no recorte, ~0,25%). Em vez de descartar essas linhas, normalizamos para um
    # código especial "XX", preservando o dado de volume/salário/idade da movimentação.
    antes_uf_nao_identificada = (df["sigla_uf"] == "UF não identificada").sum()
    df["sigla_uf"] = df["sigla_uf"].replace("UF não identificada", "XX")
    log.info(
        "sigla_uf: %d linhas com 'UF não identificada' normalizadas para código 'XX'",
        antes_uf_nao_identificada,
    )

    # Remove linhas sem setor identificado, se houver (garante qualidade da dimensão setor)
    linhas_antes = len(df)
    df = df.dropna(subset=["cnae_2_secao", "sigla_uf", "sexo", "raca_cor"])
    removidas = linhas_antes - len(df)
    if removidas:
        log.info("Removidas %d linhas com dimensões essenciais ausentes", removidas)

    # Remove duplicatas exatas (não deveria haver, dado o GROUP BY na origem, mas garante veracidade)
    linhas_antes = len(df)
    df = df.drop_duplicates()
    removidas = linhas_antes - len(df)
    if removidas:
        log.info("Removidas %d linhas duplicadas", removidas)

    # Padroniza texto (evita variações de capitalização/espaço quebrarem os agrupamentos)
    for col in ["sigla_uf", "cnae_2_secao", "setor_descricao", "sexo", "raca_cor", "tipo_movimentacao"]:
        df[col] = df[col].astype(str).str.strip()

    log.info("Linhas após tratamento: %d", len(df))
    return df


# ============================================
# 3. CARGA — DIMENSÕES E FATO
# ============================================
def get_or_create_dim(cur, table, unique_cols, extra_cols_map, rows_df):
    """
    Insere valores únicos de uma dimensão (ignorando duplicatas já existentes)
    e retorna um dicionário {tupla_valores_unicos: id_gerado}.
    """
    all_cols = unique_cols + [c for c in extra_cols_map.values() if c]
    unique_rows = (
        rows_df[all_cols]
        .drop_duplicates(subset=unique_cols)
        .reset_index(drop=True)
    )

    insert_cols = unique_cols + list(extra_cols_map.keys())
    col_names = ", ".join(insert_cols)
    placeholders = ", ".join(["%s"] * len(insert_cols))
    conflict_cols = ", ".join(unique_cols)

    values = []
    for _, row in unique_rows.iterrows():
        base_values = [row[c] for c in unique_cols]
        extra_values = [row[extra_cols_map[c]] if extra_cols_map[c] else None for c in extra_cols_map]
        values.append(tuple(base_values + extra_values))

    insert_sql = f"""
        INSERT INTO {table} ({col_names})
        VALUES %s
        ON CONFLICT ({conflict_cols}) DO NOTHING
    """
    psycopg2.extras.execute_values(cur, insert_sql, values)

    # Recupera o mapeamento completo (inclui registros que já existiam de cargas anteriores)
    cur.execute(f"SELECT id_{table.replace('dim_', '')}, {col_names} FROM {table}")
    id_col_index = 0
    mapping = {}
    for record in cur.fetchall():
        id_value = record[id_col_index]
        key = tuple(record[1 : 1 + len(unique_cols)])
        mapping[key] = id_value
    return mapping


def load(df: pd.DataFrame):
    log.info("Conectando ao PostgreSQL em %s", DB_CONFIG["host"])
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # --- dim_tempo ---
        dim_tempo_map = get_or_create_dim(
            cur, "dim_tempo", ["ano", "mes"], {}, df
        )

        # --- dim_localizacao ---
        dim_localizacao_map = get_or_create_dim(
            cur, "dim_localizacao", ["sigla_uf"], {}, df
        )

        # --- dim_setor --- (unique key é cnae_2_secao; setor_descricao é atributo)
        dim_setor_map = get_or_create_dim(
            cur, "dim_setor", ["cnae_2_secao"], {"setor_descricao": "setor_descricao"}, df
        )

        # --- dim_perfil ---
        dim_perfil_map = get_or_create_dim(
            cur, "dim_perfil", ["sexo", "raca_cor"], {}, df
        )

        # --- dim_tipo_movimentacao ---
        dim_tipo_mov_map = get_or_create_dim(
            cur, "dim_tipo_movimentacao", ["tipo_movimentacao"], {}, df
        )

        conn.commit()
        log.info("Dimensões carregadas com sucesso.")

        # --- fato_movimentacao ---
        fato_rows = []
        for _, row in df.iterrows():
            id_tempo = dim_tempo_map[(row["ano"], row["mes"])]
            id_localizacao = dim_localizacao_map[(row["sigla_uf"],)]
            id_setor = dim_setor_map[(row["cnae_2_secao"],)]
            id_perfil = dim_perfil_map[(row["sexo"], row["raca_cor"])]
            id_tipo_mov = dim_tipo_mov_map[(row["tipo_movimentacao"],)]

            fato_rows.append((
                id_tempo,
                id_localizacao,
                id_setor,
                id_perfil,
                id_tipo_mov,
                int(row["total_movimentacoes"]),
                float(row["salario_medio"]) if pd.notna(row["salario_medio"]) else None,
                float(row["idade_media"]) if pd.notna(row["idade_media"]) else None,
            ))

        insert_fato_sql = """
            INSERT INTO fato_movimentacao (
                id_tempo, id_localizacao, id_setor, id_perfil, id_tipo_movimentacao,
                total_movimentacoes, salario_medio, idade_media
            )
            VALUES %s
        """
        psycopg2.extras.execute_values(cur, insert_fato_sql, fato_rows, page_size=1000)
        conn.commit()
        log.info("Tabela fato carregada com sucesso: %d linhas inseridas.", len(fato_rows))

    except Exception:
        conn.rollback()
        log.exception("Erro durante a carga — rollback aplicado.")
        raise
    finally:
        cur.close()
        conn.close()


def main():
    if not os.path.exists(CSV_PATH):
        log.error("Arquivo CSV não encontrado em: %s", CSV_PATH)
        sys.exit(1)

    df = extract(CSV_PATH)
    df = transform(df)
    load(df)
    log.info("ETL concluído com sucesso.")


if __name__ == "__main__":
    main()