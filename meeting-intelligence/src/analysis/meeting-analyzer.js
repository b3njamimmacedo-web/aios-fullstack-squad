/**
 * Analisador de Reunioes com Claude
 *
 * Modulo principal que utiliza a API do Claude (Anthropic) para analisar
 * transcricoes de reunioes e extrair informacoes estruturadas como:
 * resumo executivo, mapa mental, itens negociados, proximos passos,
 * requisitos tecnicos, orcamento, arquitetura proposta, riscos e cronograma.
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class MeetingAnalyzer {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.anthropicApiKey;
    this.model = options.model || config.models.claude;

    if (!this.apiKey) {
      throw new Error(
        'Chave da API Anthropic nao configurada!\n' +
        'Defina ANTHROPIC_API_KEY no arquivo .env'
      );
    }

    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  /**
   * Analisa uma transcricao completa de reuniao e retorna dados estruturados
   *
   * @param {Object} transcription - Objeto de transcricao do WhisperEngine
   * @param {string} transcription.text - Texto completo da transcricao
   * @param {Array} transcription.segments - Segmentos com timestamps
   * @param {Object} context - Contexto adicional sobre a reuniao
   * @param {string} context.clientName - Nome do cliente
   * @param {string} context.meetingType - Tipo de reuniao (descoberta, alinhamento, etc.)
   * @param {string} context.date - Data da reuniao
   * @returns {Promise<Object>} Analise estruturada completa
   */
  async analyze(transcription, context = {}) {
    const transcriptText = transcription.text || '';
    const clientName = context.clientName || 'Cliente';
    const meetingDate = context.date || new Date().toISOString().split('T')[0];
    const meetingType = context.meetingType || 'reuniao de descoberta';

    if (!transcriptText || transcriptText.trim().length < 50) {
      throw new Error('Transcricao muito curta ou vazia para analise significativa.');
    }

    console.log(`[Analisador] Iniciando analise com Claude (${this.model})...`);
    console.log(`[Analisador] Cliente: ${clientName} | Tipo: ${meetingType} | Data: ${meetingDate}`);
    console.log(`[Analisador] Tamanho da transcricao: ${transcriptText.length} caracteres`);

    const prompt = this._buildAnalysisPrompt(transcriptText, {
      clientName,
      meetingDate,
      meetingType,
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = response.content[0].text;

      // Extrai o JSON da resposta (pode vir com markdown code block)
      const jsonStr = this._extractJSON(responseText);
      const analysis = JSON.parse(jsonStr);

      // Adiciona metadados
      analysis.metadata = {
        clientName,
        meetingDate,
        meetingType,
        analyzedAt: new Date().toISOString(),
        model: this.model,
        transcriptionLength: transcriptText.length,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      };

      console.log(`[Analisador] Analise concluida com sucesso!`);
      console.log(`[Analisador] Tokens usados - Entrada: ${analysis.metadata.inputTokens} | Saida: ${analysis.metadata.outputTokens}`);

      return analysis;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          'Erro ao interpretar a resposta do Claude. ' +
          'O modelo nao retornou JSON valido. Tente novamente.'
        );
      }
      throw new Error(`Erro na analise com Claude: ${error.message}`);
    }
  }

  /**
   * Constroi o prompt detalhado para analise da reuniao
   * @private
   */
  _buildAnalysisPrompt(transcriptText, context) {
    return `Voce e um analista de negocios experiente especializado em reunioes de tecnologia e desenvolvimento de software.

Analise a transcricao da reuniao abaixo e retorne EXCLUSIVAMENTE um objeto JSON valido (sem texto adicional, sem markdown, sem code blocks) com a seguinte estrutura:

{
  "resumoExecutivo": {
    "titulo": "Titulo descritivo da reuniao (maximo 10 palavras)",
    "resumo": "Resumo executivo de 3-5 paragrafos cobrindo os principais pontos discutidos, decisoes tomadas e alinhamentos realizados. Deve ser suficientemente detalhado para que alguem que nao participou da reuniao entenda o contexto completo.",
    "participantes": ["Lista dos participantes identificados na transcricao"],
    "duracaoEstimada": "Duracao estimada da reuniao baseada no conteudo",
    "sentimentoGeral": "positivo|neutro|negativo|misto - Avaliacao do tom geral da reuniao",
    "nivelEngajamento": "alto|medio|baixo - Nivel de engajamento dos participantes"
  },

  "mapaMental": {
    "topicoCentral": "Tema principal da reuniao",
    "ramos": [
      {
        "titulo": "Nome do ramo principal",
        "subitens": [
          {
            "titulo": "Sub-topico",
            "detalhes": ["Detalhe 1", "Detalhe 2"]
          }
        ]
      }
    ],
    "markdown": "Mapa mental completo formatado em markdown com indentacao usando listas (- e  -)"
  },

  "itensNegociados": {
    "acordos": [
      {
        "item": "Descricao do que foi acordado",
        "detalhes": "Detalhes adicionais do acordo",
        "responsavel": "Quem ficou responsavel (se mencionado)",
        "status": "acordado|pendente|em_discussao"
      }
    ],
    "pontosAbertos": [
      {
        "item": "Ponto que ficou em aberto",
        "contexto": "Contexto do ponto em aberto",
        "acaoNecessaria": "O que precisa ser feito para resolver"
      }
    ],
    "concessoes": ["Lista de concessoes feitas por qualquer parte"]
  },

  "proximosPassos": [
    {
      "acao": "Descricao da acao a ser tomada",
      "responsavel": "Quem deve executar",
      "prazo": "Prazo mencionado ou sugerido",
      "prioridade": "alta|media|baixa",
      "dependencias": ["Lista de dependencias desta acao"]
    }
  ],

  "requisitosCliente": {
    "funcionais": [
      {
        "id": "RF001",
        "titulo": "Nome do requisito",
        "descricao": "Descricao detalhada do requisito funcional",
        "prioridade": "essencial|importante|desejavel",
        "complexidade": "alta|media|baixa"
      }
    ],
    "naoFuncionais": [
      {
        "id": "RNF001",
        "titulo": "Nome do requisito nao-funcional",
        "descricao": "Descricao do requisito (performance, seguranca, etc.)",
        "categoria": "performance|seguranca|usabilidade|escalabilidade|disponibilidade"
      }
    ],
    "restricoes": ["Lista de restricoes mencionadas pelo cliente"],
    "premissas": ["Lista de premissas identificadas"]
  },

  "orcamentoDiscutido": {
    "valorMencionado": "Valor ou faixa de orcamento mencionada na reuniao (ou 'nao mencionado')",
    "expectativaCliente": "Expectativa de investimento do cliente",
    "modeloComercial": "Tipo de modelo discutido (projeto fechado, hora tecnica, retainer, etc.)",
    "condicoesEspeciais": ["Condicoes especiais de pagamento discutidas"],
    "observacoes": "Observacoes adicionais sobre orcamento"
  },

  "requisitosTecnicos": {
    "tecnologiasExigidas": ["Tecnologias especificamente solicitadas"],
    "tecnologiasSugeridas": ["Tecnologias sugeridas durante a reuniao"],
    "integracoes": [
      {
        "sistema": "Nome do sistema/servico",
        "tipo": "API|webhook|importacao|exportacao|SSO",
        "detalhes": "Detalhes da integracao"
      }
    ],
    "infraestrutura": "Requisitos de infraestrutura mencionados",
    "seguranca": ["Requisitos de seguranca discutidos"],
    "volumetria": "Dados sobre volume de usuarios, dados, transacoes, etc."
  },

  "arquiteturaProposta": {
    "visaoGeral": "Descricao da arquitetura proposta para a solucao",
    "componentes": [
      {
        "nome": "Nome do componente",
        "descricao": "Funcao do componente",
        "tecnologia": "Tecnologia sugerida"
      }
    ],
    "diagramaASCII": "Diagrama ASCII simples da arquitetura (usando caracteres | - + > [ ])",
    "justificativa": "Por que essa arquitetura foi sugerida"
  },

  "avaliacaoRiscos": [
    {
      "risco": "Descricao do risco identificado",
      "probabilidade": "alta|media|baixa",
      "impacto": "alto|medio|baixo",
      "mitigacao": "Estrategia de mitigacao sugerida",
      "categoria": "tecnico|comercial|prazo|escopo|recurso"
    }
  ],

  "estimativaCronograma": {
    "duracaoTotal": "Estimativa de duracao total do projeto",
    "fases": [
      {
        "fase": "Nome da fase",
        "duracao": "Duracao estimada",
        "entregaveis": ["Lista de entregaveis da fase"],
        "marcos": ["Marcos importantes"]
      }
    ],
    "dataInicioSugerida": "Data de inicio sugerida ou mencionada",
    "dataEntregaDesejada": "Data de entrega desejada pelo cliente (se mencionada)",
    "observacoes": "Observacoes sobre o cronograma"
  },

  "insightsAdicionais": {
    "oportunidades": ["Oportunidades de upsell ou servicos adicionais identificadas"],
    "alertas": ["Alertas ou preocupacoes que merecem atencao"],
    "citacoesImportantes": [
      {
        "fala": "Citacao literal importante da reuniao",
        "contexto": "Contexto da citacao",
        "relevancia": "Por que essa citacao e importante"
      }
    ]
  }
}

INSTRUCOES IMPORTANTES:
1. Retorne APENAS o JSON, sem nenhum texto antes ou depois
2. Nao use markdown code blocks (sem \`\`\`json)
3. Se alguma informacao nao foi discutida na reuniao, coloque valores vazios ou "nao mencionado"
4. Todos os textos devem estar em portugues do Brasil
5. Seja detalhado e extraia o maximo de informacao possivel
6. Para requisitos, tente categorizar e priorizar baseado no tom e enfase dos participantes
7. Para a arquitetura, proponha algo realista baseado nos requisitos discutidos
8. Para riscos, identifique tanto os explicitos quanto os implicitos

CONTEXTO DA REUNIAO:
- Cliente: ${context.clientName}
- Data: ${context.meetingDate}
- Tipo: ${context.meetingType}

TRANSCRICAO COMPLETA:
---
${transcriptText}
---

Retorne o JSON completo agora:`;
  }

  /**
   * Extrai JSON de uma string que pode conter markdown code blocks
   * @private
   */
  _extractJSON(text) {
    // Tenta extrair de code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Tenta encontrar o JSON diretamente (primeiro { ate ultimo })
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    // Se nao encontrou nenhum padrao, retorna o texto completo
    return text.trim();
  }

  /**
   * Analise rapida - retorna apenas resumo e proximos passos
   * Util para analise em tempo real durante a reuniao
   *
   * @param {string} partialText - Texto parcial da transcricao
   * @returns {Promise<Object>} Resumo rapido
   */
  async quickAnalysis(partialText) {
    if (!partialText || partialText.trim().length < 20) {
      return { resumo: '', proximosPassos: [] };
    }

    console.log('[Analisador] Executando analise rapida...');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analise rapidamente este trecho de reuniao e retorne APENAS um JSON com:
{
  "resumo": "Resumo rapido em 2-3 frases do que foi discutido ate agora",
  "topicos": ["Lista de topicos abordados"],
  "proximosPassos": ["Acoes ja identificadas"],
  "pontosAbertos": ["Questoes ainda sem resposta"]
}

Texto:
${partialText}

Retorne apenas o JSON, sem formatacao adicional:`,
        },
      ],
    });

    const jsonStr = this._extractJSON(response.content[0].text);
    return JSON.parse(jsonStr);
  }
}

module.exports = MeetingAnalyzer;
