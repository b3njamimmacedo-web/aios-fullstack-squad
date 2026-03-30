/**
 * Conector Zoom
 *
 * Integra com a Zoom API para acessar gravacoes em nuvem de reunioes.
 *
 * === Configuracao necessaria (Zoom Marketplace) ===
 *
 * 1. Acesse https://marketplace.zoom.us/ > Develop > Build App
 * 2. Escolha "Server-to-Server OAuth" (recomendado) ou "OAuth"
 * 3. Preencha as informacoes do aplicativo
 *
 * 4. Em "Scopes", adicione:
 *    - recording:read (Visualizar gravacoes)
 *    - meeting:read (Visualizar reunioes)
 *    - user:read (Informacoes do usuario)
 *
 * 5. Configure as variaveis de ambiente:
 *    ZOOM_ACCOUNT_ID=<Account ID>
 *    ZOOM_CLIENT_ID=<Client ID>
 *    ZOOM_CLIENT_SECRET=<Client Secret>
 *
 * === Dependencias ===
 *  Nenhuma dependencia adicional (usa node-fetch ou fetch nativo)
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');

// --- Constantes ---
const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const ZOOM_AUTH_URL = 'https://zoom.us/oauth/token';

// --- Estado interno ---
let accessToken = null;
let tokenExpiry = null;

/**
 * Wrapper para fetch compativel com Node.js
 * @private
 */
async function _fetch(url, opcoes = {}) {
  try {
    const fetch = globalThis.fetch || require('node-fetch');
    return await fetch(url, opcoes);
  } catch (erro) {
    throw new Error(`Falha na requisicao HTTP: ${erro.message}`);
  }
}

/**
 * Faz uma requisicao autenticada para a Zoom API
 * @private
 */
async function _zoomRequest(endpoint, opcoes = {}) {
  if (!accessToken) {
    throw new Error('Nao autenticado. Execute authenticate() antes de fazer requisicoes.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${ZOOM_API_BASE}${endpoint}`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...opcoes.headers,
  };

  const resposta = await _fetch(url, {
    method: opcoes.method || 'GET',
    headers,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  if (resposta.status === 401) {
    // Token expirado, tenta renovar
    console.log('[Zoom] Token expirado, renovando...');
    await authenticate();
    return _zoomRequest(endpoint, opcoes);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Erro na Zoom API [${resposta.status}]: ${corpo}`);
  }

  if (opcoes.raw) {
    return resposta;
  }

  const contentType = resposta.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return resposta.json();
  }

  return resposta;
}

/**
 * Verifica se o token atual ainda e valido
 * @private
 */
function _tokenValido() {
  return accessToken && tokenExpiry && Date.now() < tokenExpiry;
}

/**
 * Autentica com a Zoom API usando Server-to-Server OAuth
 *
 * @param {Object} [opcoes] - Opcoes de autenticacao
 * @param {string} [opcoes.accountId] - ID da conta Zoom (sobrescreve env)
 * @param {string} [opcoes.clientId] - ID do cliente (sobrescreve env)
 * @param {string} [opcoes.clientSecret] - Segredo do cliente (sobrescreve env)
 * @returns {Promise<{ sucesso: boolean, expiraEm: Date }>}
 */
async function authenticate(opcoes = {}) {
  if (opcoes.accountId) process.env.ZOOM_ACCOUNT_ID = opcoes.accountId;
  if (opcoes.clientId) process.env.ZOOM_CLIENT_ID = opcoes.clientId;
  if (opcoes.clientSecret) process.env.ZOOM_CLIENT_SECRET = opcoes.clientSecret;

  // Valida configuracao
  const campos = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
  const ausentes = campos.filter(c => !process.env[c]);
  if (ausentes.length > 0) {
    throw new Error(
      `Variaveis de ambiente ausentes para Zoom: ${ausentes.join(', ')}. ` +
      'Consulte os comentarios no topo deste arquivo para instrucoes de configuracao.'
    );
  }

  if (_tokenValido()) {
    console.log('[Zoom] Token existente ainda valido, reutilizando.');
    return { sucesso: true, expiraEm: new Date(tokenExpiry) };
  }

  try {
    const credenciais = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: process.env.ZOOM_ACCOUNT_ID,
    });

    const resposta = await _fetch(ZOOM_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credenciais}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      throw new Error(`Resposta de autenticacao: ${resposta.status} - ${corpo}`);
    }

    const dados = await resposta.json();

    if (!dados.access_token) {
      throw new Error('Token de acesso nao recebido na resposta.');
    }

    accessToken = dados.access_token;
    // Token do Zoom expira em ~1 hora; usa margem de seguranca de 5 min
    tokenExpiry = Date.now() + (dados.expires_in - 300) * 1000;

    console.log('[Zoom] Autenticacao realizada com sucesso.');
    return {
      sucesso: true,
      expiraEm: new Date(tokenExpiry),
    };
  } catch (erro) {
    accessToken = null;
    tokenExpiry = null;
    throw new Error(`Falha na autenticacao com Zoom: ${erro.message}`);
  }
}

/**
 * Lista gravacoes em nuvem disponíveis no Zoom
 *
 * @param {Object} [filtros] - Filtros de busca
 * @param {string} [filtros.userId] - ID do usuario (padrao: 'me')
 * @param {string|Date} [filtros.de] - Data inicial (YYYY-MM-DD)
 * @param {string|Date} [filtros.ate] - Data final (YYYY-MM-DD)
 * @param {number} [filtros.pageSize] - Itens por pagina (padrao: 30, max: 300)
 * @param {string} [filtros.nextPageToken] - Token para paginacao
 * @returns {Promise<{ reunioes: Array, total: number, nextPageToken: string|null }>}
 */
async function listRecordings(filtros = {}) {
  const {
    userId = 'me',
    de,
    ate,
    pageSize = 30,
    nextPageToken,
  } = filtros;

  console.log('[Zoom] Buscando gravacoes...');

  // Monta parametros de consulta
  const params = new URLSearchParams();
  params.set('page_size', Math.min(pageSize, 300).toString());

  if (de) {
    const dataInicio = de instanceof Date ? de.toISOString().split('T')[0] : de;
    params.set('from', dataInicio);
  } else {
    // Padrao: ultimos 30 dias
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    params.set('from', trintaDiasAtras.toISOString().split('T')[0]);
  }

  if (ate) {
    const dataFim = ate instanceof Date ? ate.toISOString().split('T')[0] : ate;
    params.set('to', dataFim);
  }

  if (nextPageToken) {
    params.set('next_page_token', nextPageToken);
  }

  try {
    const dados = await _zoomRequest(
      `/users/${userId}/recordings?${params.toString()}`
    );

    const reunioes = (dados.meetings || []).map(_formatarReuniao);

    console.log(`[Zoom] ${reunioes.length} gravacao(oes) encontrada(s) (total: ${dados.total_records || 0}).`);

    return {
      reunioes,
      total: dados.total_records || reunioes.length,
      nextPageToken: dados.next_page_token || null,
    };
  } catch (erro) {
    throw new Error(`Erro ao listar gravacoes do Zoom: ${erro.message}`);
  }
}

/**
 * Baixa uma gravacao especifica do Zoom
 *
 * @param {string} downloadUrl - URL de download da gravacao
 * @param {string} [destino] - Caminho do diretorio de destino
 * @param {Object} [opcoes] - Opcoes adicionais
 * @param {string} [opcoes.tipo] - Tipo de gravacao: 'audio' ou 'video' (padrao: 'audio')
 * @returns {Promise<{ caminho: string, tamanho: number, formato: string }>}
 */
async function downloadRecording(downloadUrl, destino, opcoes = {}) {
  if (!downloadUrl) {
    throw new Error('URL de download da gravacao e obrigatoria.');
  }

  const dirDestino = destino || config.paths.tempDir;
  if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
  }

  console.log('[Zoom] Baixando gravacao...');

  try {
    // Adiciona token de acesso a URL
    const urlComToken = downloadUrl.includes('?')
      ? `${downloadUrl}&access_token=${accessToken}`
      : `${downloadUrl}?access_token=${accessToken}`;

    const resposta = await _fetch(urlComToken, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!resposta.ok) {
      throw new Error(`Falha no download: HTTP ${resposta.status}`);
    }

    const contentType = resposta.headers.get('content-type') || '';
    const extensao = _detectarExtensao(contentType, opcoes.tipo);
    const nomeArquivo = `zoom_${Date.now()}${extensao}`;
    const caminhoArquivo = path.join(dirDestino, nomeArquivo);

    // Escreve o conteudo em disco usando streams
    const buffer = Buffer.from(await resposta.arrayBuffer());
    fs.writeFileSync(caminhoArquivo, buffer);

    const tamanho = buffer.length;
    console.log(
      `[Zoom] Gravacao baixada: ${nomeArquivo} (${(tamanho / 1024 / 1024).toFixed(2)} MB)`
    );

    return {
      caminho: caminhoArquivo,
      tamanho,
      formato: extensao.replace('.', ''),
    };
  } catch (erro) {
    throw new Error(`Erro ao baixar gravacao do Zoom: ${erro.message}`);
  }
}

/**
 * Obtem informacoes detalhadas de uma reuniao especifica do Zoom
 *
 * @param {string} meetingId - ID da reuniao no Zoom
 * @returns {Promise<Object>} Detalhes completos da reuniao
 */
async function getMeetingInfo(meetingId) {
  if (!meetingId) {
    throw new Error('ID da reuniao e obrigatorio.');
  }

  console.log(`[Zoom] Obtendo informacoes da reuniao ${meetingId}...`);

  try {
    // Busca detalhes da reuniao
    const detalhes = await _zoomRequest(`/meetings/${meetingId}`);

    // Tenta buscar participantes (pode requerer permissoes adicionais)
    let participantes = [];
    try {
      const dadosParticipantes = await _zoomRequest(
        `/past_meetings/${meetingId}/participants?page_size=300`
      );
      participantes = (dadosParticipantes.participants || []).map(p => ({
        nome: p.name || 'Desconhecido',
        email: p.user_email || '',
        duracaoSegundos: p.duration || 0,
        entrou: p.join_time || null,
        saiu: p.leave_time || null,
      }));
    } catch {
      // Participantes podem nao estar disponiveis para reunioes futuras
    }

    // Busca gravacoes desta reuniao
    let gravacoes = [];
    try {
      const dadosGravacoes = await _zoomRequest(
        `/meetings/${meetingId}/recordings`
      );
      gravacoes = (dadosGravacoes.recording_files || []).map(g => ({
        id: g.id,
        tipo: g.recording_type || 'desconhecido',
        tamanho: g.file_size || 0,
        downloadUrl: g.download_url || null,
        playUrl: g.play_url || null,
        formato: g.file_extension || '',
        status: g.status || '',
      }));
    } catch {
      // Gravacoes podem nao existir
    }

    const resultado = {
      id: detalhes.id || meetingId,
      uuid: detalhes.uuid || null,
      assunto: detalhes.topic || 'Sem titulo',
      tipo: _traduzirTipoReuniao(detalhes.type),
      inicio: detalhes.start_time || null,
      duracao: detalhes.duration || 0,
      fusoHorario: detalhes.timezone || 'America/Sao_Paulo',
      organizador: {
        id: detalhes.host_id || '',
        email: detalhes.host_email || '',
      },
      participantes,
      totalParticipantes: participantes.length,
      gravacoes,
      linkReuniao: detalhes.join_url || null,
      senha: detalhes.password ? '***' : null,
      plataforma: 'zoom',
      metadados: {
        criadoEm: detalhes.created_at || null,
        agenda: detalhes.agenda || '',
        autoGravacao: detalhes.settings?.auto_recording || 'none',
      },
    };

    console.log(`[Zoom] Informacoes obtidas: "${resultado.assunto}"`);
    return resultado;
  } catch (erro) {
    throw new Error(`Erro ao obter informacoes da reuniao: ${erro.message}`);
  }
}

// --- Funcoes auxiliares (privadas) ---

/**
 * Formata uma reuniao do Zoom para o formato padrao
 * @private
 */
function _formatarReuniao(meeting) {
  const gravacoes = (meeting.recording_files || []).map(f => ({
    id: f.id,
    tipo: f.recording_type,
    tamanho: f.file_size || 0,
    downloadUrl: f.download_url || null,
    formato: f.file_extension || '',
    status: f.status || '',
  }));

  // Separa gravacoes de audio
  const gravacoesAudio = gravacoes.filter(
    g => g.tipo === 'audio_only' || g.formato === 'M4A'
  );

  return {
    id: meeting.id || meeting.uuid,
    uuid: meeting.uuid,
    assunto: meeting.topic || 'Sem titulo',
    inicio: meeting.start_time,
    duracao: meeting.duration || 0,
    totalGravacoes: gravacoes.length,
    totalAudios: gravacoesAudio.length,
    tamanhoTotal: meeting.total_size || 0,
    organizador: meeting.host_email || '',
    gravacoes,
    gravacoesAudio,
    plataforma: 'zoom',
  };
}

/**
 * Traduz o tipo numerico de reuniao do Zoom
 * @private
 */
function _traduzirTipoReuniao(tipo) {
  const tipos = {
    1: 'instantanea',
    2: 'agendada',
    3: 'recorrente_sem_horario',
    4: 'sala_pessoal',
    8: 'recorrente_com_horario',
  };
  return tipos[tipo] || 'desconhecido';
}

/**
 * Detecta extensao do arquivo baseado no content-type e tipo preferido
 * @private
 */
function _detectarExtensao(contentType, tipoPreferido) {
  if (tipoPreferido === 'audio') return '.m4a';
  if (!contentType) return '.mp4';
  if (contentType.includes('audio/mp4') || contentType.includes('audio/m4a')) return '.m4a';
  if (contentType.includes('audio/mpeg')) return '.mp3';
  if (contentType.includes('audio/wav')) return '.wav';
  if (contentType.includes('video/mp4')) return '.mp4';
  return '.mp4';
}

module.exports = {
  authenticate,
  listRecordings,
  downloadRecording,
  getMeetingInfo,
};
