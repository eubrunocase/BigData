WITH 
dicionario_raca_cor AS (
    SELECT chave AS chave_raca_cor, valor AS descricao_raca_cor
    FROM `basedosdados.br_me_caged.dicionario`
    WHERE nome_coluna = 'raca_cor' AND id_tabela = 'microdados_movimentacao'
),
dicionario_sexo AS (
    SELECT chave AS chave_sexo, valor AS descricao_sexo
    FROM `basedosdados.br_me_caged.dicionario`
    WHERE nome_coluna = 'sexo' AND id_tabela = 'microdados_movimentacao'
),
dicionario_tipo_movimentacao AS (
    SELECT chave AS chave_tipo_movimentacao, valor AS descricao_tipo_movimentacao
    FROM `basedosdados.br_me_caged.dicionario`
    WHERE nome_coluna = 'tipo_movimentacao' AND id_tabela = 'microdados_movimentacao'
)
SELECT
    dados.ano,
    dados.mes,
    dados.sigla_uf,
    dados.cnae_2_secao,
    diretorio_cnae.descricao_secao AS setor_descricao,
    descricao_sexo AS sexo,
    descricao_raca_cor AS raca_cor,
    descricao_tipo_movimentacao AS tipo_movimentacao,
    COUNT(*) AS total_movimentacoes,
    AVG(dados.salario_mensal) AS salario_medio,
    AVG(dados.idade) AS idade_media
FROM `basedosdados.br_me_caged.microdados_movimentacao` AS dados
LEFT JOIN (SELECT DISTINCT subclasse, descricao_secao FROM `basedosdados.br_bd_diretorios_brasil.cnae_2`) AS diretorio_cnae
    ON dados.cnae_2_subclasse = diretorio_cnae.subclasse
LEFT JOIN `dicionario_sexo` ON dados.sexo = chave_sexo
LEFT JOIN `dicionario_raca_cor` ON dados.raca_cor = chave_raca_cor
LEFT JOIN `dicionario_tipo_movimentacao` ON dados.tipo_movimentacao = chave_tipo_movimentacao
WHERE
    (dados.ano = 2025 AND dados.mes >= 8)
    OR (dados.ano = 2026 AND dados.mes <= 1)
GROUP BY
    dados.ano, dados.mes, dados.sigla_uf, dados.cnae_2_secao, setor_descricao,
    sexo, raca_cor, tipo_movimentacao