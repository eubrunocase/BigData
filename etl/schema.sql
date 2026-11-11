-- ============================================
-- Schema estrela - Turnover Setorial (CAGED)
-- Rode este script uma vez no banco antes do ETL
-- ============================================

-- ============================================
-- DIMENSÕES
-- ============================================

CREATE TABLE IF NOT EXISTS dim_tempo (
    id_tempo SERIAL PRIMARY KEY,
    ano SMALLINT NOT NULL,
    mes SMALLINT NOT NULL,
    UNIQUE (ano, mes)
);

CREATE TABLE IF NOT EXISTS dim_localizacao (
    id_localizacao SERIAL PRIMARY KEY,
    sigla_uf CHAR(2) NOT NULL,
    UNIQUE (sigla_uf)
);

CREATE TABLE IF NOT EXISTS dim_setor (
    id_setor SERIAL PRIMARY KEY,
    cnae_2_secao VARCHAR(5) NOT NULL,
    setor_descricao VARCHAR(255),
    UNIQUE (cnae_2_secao)
);

CREATE TABLE IF NOT EXISTS dim_perfil (
    id_perfil SERIAL PRIMARY KEY,
    sexo VARCHAR(20) NOT NULL,
    raca_cor VARCHAR(50) NOT NULL,
    UNIQUE (sexo, raca_cor)
);

CREATE TABLE IF NOT EXISTS dim_tipo_movimentacao (
    id_tipo_movimentacao SERIAL PRIMARY KEY,
    -- VARCHAR(100): alguns valores do CAGED são longos,
    -- ex: "Desligamento Por Acordo Entre Empregado E Empregador"
    tipo_movimentacao VARCHAR(100) NOT NULL,
    UNIQUE (tipo_movimentacao)
);

-- ============================================
-- FATO
-- ============================================

CREATE TABLE IF NOT EXISTS fato_movimentacao (
    id_fato BIGSERIAL PRIMARY KEY,
    id_tempo INT NOT NULL REFERENCES dim_tempo(id_tempo),
    id_localizacao INT NOT NULL REFERENCES dim_localizacao(id_localizacao),
    id_setor INT NOT NULL REFERENCES dim_setor(id_setor),
    id_perfil INT NOT NULL REFERENCES dim_perfil(id_perfil),
    id_tipo_movimentacao INT NOT NULL REFERENCES dim_tipo_movimentacao(id_tipo_movimentacao),
    total_movimentacoes INT NOT NULL,
    salario_medio NUMERIC(10,2),
    idade_media NUMERIC(4,1)
);

-- Índices para acelerar os filtros cruzados do dashboard
CREATE INDEX IF NOT EXISTS idx_fato_tempo ON fato_movimentacao(id_tempo);
CREATE INDEX IF NOT EXISTS idx_fato_localizacao ON fato_movimentacao(id_localizacao);
CREATE INDEX IF NOT EXISTS idx_fato_setor ON fato_movimentacao(id_setor);
CREATE INDEX IF NOT EXISTS idx_fato_perfil ON fato_movimentacao(id_perfil);
CREATE INDEX IF NOT EXISTS idx_fato_tipo_mov ON fato_movimentacao(id_tipo_movimentacao);