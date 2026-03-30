/**
 * Motor de Transcricao Whisper
 *
 * Transcreve arquivos de audio usando a API Whisper da OpenAI.
 * Suporta transcricao de arquivos completos e chunked (para arquivos > 25MB).
 * Detecta automaticamente o idioma (portugues e ingles suportados).
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { spawn } = require('child_process');
const config = require('../config');

class WhisperEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.openaiApiKey;
    this.model = options.model || config.models.whisper;
    this.tempDir = options.tempDir || config.paths.tempDir;

    // Limite de tamanho da API Whisper: 25MB
    this.maxFileSizeMB = config.audio.maxChunkSizeMB;

    if (!this.apiKey) {
      throw new Error(
        'Chave da API OpenAI nao configurada!\n' +
        'Defina OPENAI_API_KEY no arquivo .env'
      );
    }

    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  /**
   * Garante que o diretorio temporario existe
   */
  _ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Retorna o tamanho do arquivo em MB
   * @param {string} filePath - Caminho do arquivo
   * @returns {number} Tamanho em MB
   */
  _getFileSizeMB(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  }

  /**
   * Divide um arquivo de audio grande em chunks menores usando FFmpeg
   * Necessario para arquivos maiores que 25MB (limite da API Whisper)
   *
   * @param {string} filePath - Caminho do arquivo de audio original
   * @param {number} chunkDurationSeconds - Duracao de cada chunk em segundos
   * @returns {Promise<string[]>} Lista de caminhos dos chunks gerados
   */
  async _splitAudioFile(filePath, chunkDurationSeconds = 600) {
    this._ensureTempDir();

    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    return new Promise((resolve, reject) => {
      console.log(`[Whisper] Dividindo arquivo grande em chunks de ${chunkDurationSeconds}s...`);

      const outputPattern = path.join(this.tempDir, `${baseName}_chunk_%03d${ext}`);

      const args = [
        '-i', filePath,
        '-f', 'segment',
        '-segment_time', String(chunkDurationSeconds),
        '-c', 'copy',
        '-y',
        outputPattern,
      ];

      const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Erro ao dividir audio. FFmpeg saiu com codigo ${code}`));
          return;
        }

        // Lista os chunks gerados
        const dir = this.tempDir;
        const chunks = fs.readdirSync(dir)
          .filter(f => f.startsWith(`${baseName}_chunk_`) && f.endsWith(ext))
          .sort()
          .map(f => path.join(dir, f));

        console.log(`[Whisper] Audio dividido em ${chunks.length} chunks`);
        resolve(chunks);
      });

      proc.on('error', (error) => {
        reject(new Error(
          `Erro ao executar FFmpeg: ${error.message}\n` +
          'Verifique se o FFmpeg esta instalado e no PATH.'
        ));
      });
    });
  }

  /**
   * Transcreve um unico arquivo de audio usando a API Whisper
   *
   * @param {string} filePath - Caminho do arquivo de audio
   * @param {Object} options - Opcoes adicionais
   * @param {string} options.language - Codigo do idioma (pt, en, etc.). Se omitido, detecta automaticamente
   * @param {string} options.prompt - Texto de contexto para melhorar a transcricao
   * @returns {Promise<Object>} Resultado da transcricao com segmentos e timestamps
   */
  async transcribeFile(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo de audio nao encontrado: ${filePath}`);
    }

    const sizeMB = this._getFileSizeMB(filePath);
    console.log(`[Whisper] Transcrevendo: ${path.basename(filePath)} (${sizeMB.toFixed(1)} MB)`);

    // Se o arquivo excede o limite, divide em chunks
    if (sizeMB > this.maxFileSizeMB) {
      console.log(`[Whisper] Arquivo excede ${this.maxFileSizeMB}MB. Dividindo automaticamente...`);
      return this._transcribeLargeFile(filePath, options);
    }

    // Transcricao direta para arquivos dentro do limite
    return this._transcribeSingleFile(filePath, options);
  }

  /**
   * Transcreve um arquivo que esta dentro do limite de tamanho
   * @private
   */
  async _transcribeSingleFile(filePath, options = {}) {
    const transcriptionOptions = {
      file: fs.createReadStream(filePath),
      model: this.model,
      response_format: 'verbose_json',     // Retorna segmentos com timestamps
      timestamp_granularities: ['segment'], // Timestamps por segmento
    };

    // Idioma (se especificado)
    if (options.language) {
      transcriptionOptions.language = options.language;
    }

    // Prompt de contexto para melhorar a transcricao
    if (options.prompt) {
      transcriptionOptions.prompt = options.prompt;
    }

    try {
      const response = await this.client.audio.transcriptions.create(transcriptionOptions);

      // Formata o resultado para padrao interno
      const result = {
        text: response.text,
        language: response.language || options.language || 'detectado automaticamente',
        duration: response.duration || 0,
        segments: (response.segments || []).map((seg, index) => ({
          id: index,
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        })),
        sourceFile: filePath,
        transcribedAt: new Date().toISOString(),
      };

      console.log(`[Whisper] Transcricao concluida: ${result.segments.length} segmentos, idioma: ${result.language}`);
      return result;

    } catch (error) {
      if (error.status === 413) {
        throw new Error(
          'Arquivo muito grande para a API Whisper.\n' +
          'O limite e 25MB. Tente um arquivo menor ou verifique a configuracao.'
        );
      }
      throw new Error(`Erro na transcricao Whisper: ${error.message}`);
    }
  }

  /**
   * Transcreve arquivo grande dividindo em chunks e combinando resultados
   * @private
   */
  async _transcribeLargeFile(filePath, options = {}) {
    // Divide o arquivo em chunks de ~10 minutos (cabe em 25MB para audio wav/mp3)
    const chunks = await this._splitAudioFile(filePath, 600);

    const allSegments = [];
    let fullText = '';
    let totalDuration = 0;
    let detectedLanguage = options.language || '';
    let timeOffset = 0;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Whisper] Processando chunk ${i + 1}/${chunks.length}...`);

      const chunkResult = await this._transcribeSingleFile(chunks[i], {
        ...options,
        // Usa o final da transcricao anterior como contexto para melhorar continuidade
        prompt: fullText.slice(-200),
      });

      // Ajusta timestamps dos segmentos com o offset acumulado
      const adjustedSegments = chunkResult.segments.map((seg) => ({
        ...seg,
        id: allSegments.length + seg.id,
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
      }));

      allSegments.push(...adjustedSegments);
      fullText += (fullText ? ' ' : '') + chunkResult.text;
      totalDuration += chunkResult.duration;
      timeOffset += chunkResult.duration;

      if (!detectedLanguage && chunkResult.language) {
        detectedLanguage = chunkResult.language;
      }
    }

    // Limpa chunks temporarios
    for (const chunk of chunks) {
      try { fs.unlinkSync(chunk); } catch { /* ignora erros de limpeza */ }
    }

    return {
      text: fullText,
      language: detectedLanguage,
      duration: totalDuration,
      segments: allSegments,
      sourceFile: filePath,
      chunksProcessed: chunks.length,
      transcribedAt: new Date().toISOString(),
    };
  }

  /**
   * Transcreve multiplos arquivos (ex: chunks de captura streaming)
   * e combina em uma unica transcricao
   *
   * @param {string[]} filePaths - Lista de caminhos de arquivos de audio
   * @param {Object} options - Opcoes de transcricao
   * @returns {Promise<Object>} Transcricao combinada
   */
  async transcribeMultipleFiles(filePaths, options = {}) {
    console.log(`[Whisper] Transcrevendo ${filePaths.length} arquivos...`);

    const allSegments = [];
    let fullText = '';
    let totalDuration = 0;
    let timeOffset = 0;

    for (let i = 0; i < filePaths.length; i++) {
      console.log(`[Whisper] Arquivo ${i + 1}/${filePaths.length}: ${path.basename(filePaths[i])}`);

      const result = await this.transcribeFile(filePaths[i], {
        ...options,
        prompt: fullText.slice(-200),
      });

      const adjustedSegments = result.segments.map((seg) => ({
        ...seg,
        id: allSegments.length + seg.id,
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
      }));

      allSegments.push(...adjustedSegments);
      fullText += (fullText ? ' ' : '') + result.text;
      totalDuration += result.duration;
      timeOffset += result.duration;
    }

    return {
      text: fullText,
      language: options.language || 'auto',
      duration: totalDuration,
      segments: allSegments,
      sourceFiles: filePaths,
      transcribedAt: new Date().toISOString(),
    };
  }

  /**
   * Formata timestamps em formato legivel (HH:MM:SS)
   * @param {number} seconds - Tempo em segundos
   * @returns {string} Tempo formatado
   */
  static formatTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Exporta transcricao como texto com timestamps
   * @param {Object} transcription - Resultado da transcricao
   * @returns {string} Texto formatado com timestamps
   */
  static toTimestampedText(transcription) {
    if (!transcription.segments || transcription.segments.length === 0) {
      return transcription.text || '';
    }

    return transcription.segments
      .map(seg => `[${WhisperEngine.formatTimestamp(seg.start)}] ${seg.text}`)
      .join('\n');
  }
}

module.exports = WhisperEngine;
