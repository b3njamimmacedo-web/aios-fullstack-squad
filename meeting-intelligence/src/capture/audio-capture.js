/**
 * Modulo de Captura de Audio
 *
 * Captura audio do sistema usando FFmpeg no Windows.
 * Suporta dispositivos de audio virtual como VB-Cable para gravar
 * audio de reunioes no Teams, Zoom e Google Meet.
 *
 * === CONFIGURACAO DO VB-CABLE PARA REUNIOES ===
 *
 * 1. INSTALAR O VB-CABLE:
 *    - Baixe em: https://vb-audio.com/Cable/
 *    - Execute o instalador como Administrador
 *    - Reinicie o computador apos a instalacao
 *
 * 2. CONFIGURAR O WINDOWS:
 *    - Abra Configuracoes de Som do Windows (clicar no icone de som na bandeja)
 *    - Em "Saida de som", selecione "CABLE Input (VB-Audio Virtual Cable)"
 *    - Isso direciona todo audio do sistema para o cabo virtual
 *
 * 3. CONFIGURAR O APLICATIVO DE REUNIAO (Teams/Zoom/Meet):
 *    - Nas configuracoes de audio do app, defina:
 *      - Saida de audio (alto-falante): "CABLE Input (VB-Audio Virtual Cable)"
 *    - Isso garante que o audio da reuniao passe pelo cabo virtual
 *
 * 4. PARA OUVIR ENQUANTO GRAVA:
 *    - Abra as propriedades do "CABLE Output" no Painel de Controle de Som
 *    - Na aba "Ouvir", marque "Ouvir este dispositivo"
 *    - Selecione seus fones/caixas de som reais como dispositivo de reproducao
 *    - Assim voce ouve a reuniao E grava simultaneamente
 *
 * 5. DICA PARA GOOGLE MEET:
 *    - O Meet roda no navegador, entao a saida de audio segue o padrao do Windows
 *    - Basta configurar a saida padrao do Windows para o VB-Cable
 *
 * 6. DICA PARA ZOOM:
 *    - Em Zoom > Configuracoes > Audio, selecione "CABLE Input" como alto-falante
 *    - Marque tambem "Usar dispositivo de audio separado para tocar ringtone" se quiser
 *
 * 7. DICA PARA TEAMS:
 *    - Em Teams > Configuracoes > Dispositivos, selecione "CABLE Input" como alto-falante
 *    - O Teams pode precisar ser reiniciado para detectar novos dispositivos
 *
 * === REQUISITOS ===
 * - FFmpeg instalado e no PATH do sistema (https://ffmpeg.org/download.html)
 * - VB-Cable instalado (https://vb-audio.com/Cable/)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const config = require('../config');

class AudioCapture extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuracoes de captura
    this.device = options.device || config.audio.device;
    this.format = options.format || config.audio.format;
    this.sampleRate = options.sampleRate || config.audio.sampleRate;
    this.channels = options.channels || config.audio.channels;
    this.outputDir = options.outputDir || config.paths.tempDir;
    this.chunkDuration = options.chunkDuration || config.audio.chunkDurationSeconds;

    // Estado interno
    this.process = null;
    this.isRecording = false;
    this.startTime = null;
    this.outputFile = null;
    this.chunks = [];
  }

  /**
   * Lista todos os dispositivos de audio disponiveis no Windows
   * Usa o FFmpeg para enumerar dispositivos DirectShow
   * @returns {Promise<{ audio: string[], video: string[] }>}
   */
  static async getAvailableDevices() {
    return new Promise((resolve, reject) => {
      try {
        // O FFmpeg lista dispositivos com -list_devices
        // No Windows, usa o formato dshow (DirectShow)
        const result = execSync(
          'ffmpeg -list_devices true -f dshow -i dummy 2>&1',
          { encoding: 'utf-8', timeout: 10000 }
        );

        const audioDevices = [];
        const videoDevices = [];
        let currentType = null;

        for (const line of result.split('\n')) {
          if (line.includes('DirectShow audio devices')) {
            currentType = 'audio';
          } else if (line.includes('DirectShow video devices')) {
            currentType = 'video';
          } else if (line.includes('"') && currentType) {
            // Extrai nome do dispositivo entre aspas
            const match = line.match(/"([^"]+)"/);
            if (match) {
              if (currentType === 'audio') {
                audioDevices.push(match[1]);
              } else {
                videoDevices.push(match[1]);
              }
            }
          }
        }

        resolve({ audio: audioDevices, video: videoDevices });
      } catch (error) {
        // O FFmpeg retorna erro (exit code 1) mesmo quando lista com sucesso
        // porque o -i dummy falha, mas os dispositivos sao listados no stderr
        const output = error.stdout || error.stderr || error.message || '';
        const audioDevices = [];
        let inAudio = false;

        for (const line of output.split('\n')) {
          if (line.includes('DirectShow audio devices')) {
            inAudio = true;
          } else if (line.includes('DirectShow video devices')) {
            inAudio = false;
          } else if (inAudio && line.includes('"')) {
            const match = line.match(/"([^"]+)"/);
            if (match && !match[1].includes('Alternative name')) {
              audioDevices.push(match[1]);
            }
          }
        }

        if (audioDevices.length > 0) {
          resolve({ audio: audioDevices, video: [] });
        } else {
          reject(new Error(
            'Nao foi possivel listar dispositivos de audio.\n' +
            'Verifique se o FFmpeg esta instalado e no PATH do sistema.\n' +
            'Baixe em: https://ffmpeg.org/download.html'
          ));
        }
      }
    });
  }

  /**
   * Garante que o diretorio de saida existe
   */
  _ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Gera nome de arquivo baseado na data/hora atual
   * @returns {string} Caminho completo do arquivo de saida
   */
  _generateFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `reuniao_${timestamp}.${this.format}`;
    return path.join(this.outputDir, filename);
  }

  /**
   * Inicia a captura de audio do dispositivo configurado
   *
   * @param {Object} options - Opcoes adicionais
   * @param {number} options.maxDuration - Duracao maxima em segundos (0 = sem limite)
   * @param {boolean} options.streamMode - Se true, salva chunks separados para processamento em tempo real
   * @returns {Promise<string>} Caminho do arquivo sendo gravado
   */
  async startCapture(options = {}) {
    if (this.isRecording) {
      throw new Error('Ja existe uma gravacao em andamento. Use stopCapture() primeiro.');
    }

    this._ensureOutputDir();
    this.outputFile = this._generateFileName();
    this.startTime = Date.now();
    this.chunks = [];

    // Monta os argumentos do FFmpeg para captura no Windows via DirectShow
    const args = [
      '-f', 'dshow',                              // Formato DirectShow (Windows)
      '-i', `audio=${this.device}`,                // Dispositivo de entrada
      '-ar', String(this.sampleRate),              // Taxa de amostragem
      '-ac', String(this.channels),                // Numero de canais (mono)
      '-y',                                        // Sobrescrever arquivo se existir
    ];

    // Se tem duracao maxima, adiciona limite
    if (options.maxDuration && options.maxDuration > 0) {
      args.push('-t', String(options.maxDuration));
    }

    // Formato de saida
    if (this.format === 'wav') {
      args.push('-acodec', 'pcm_s16le');           // Codec PCM 16-bit para WAV
    } else if (this.format === 'mp3') {
      args.push('-acodec', 'libmp3lame', '-b:a', '128k'); // MP3 128kbps
    }

    args.push(this.outputFile);

    return new Promise((resolve, reject) => {
      console.log(`[Captura] Iniciando gravacao do dispositivo: ${this.device}`);
      console.log(`[Captura] Arquivo de saida: ${this.outputFile}`);
      console.log(`[Captura] Formato: ${this.format} | Taxa: ${this.sampleRate}Hz | Canais: ${this.channels}`);

      this.process = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.isRecording = true;
      this.emit('start', { file: this.outputFile, device: this.device });

      this.process.stderr.on('data', (data) => {
        const msg = data.toString();
        // FFmpeg envia informacoes de progresso pelo stderr
        if (msg.includes('size=') || msg.includes('time=')) {
          this.emit('progress', { message: msg.trim() });
        }
      });

      this.process.on('close', (code) => {
        this.isRecording = false;
        const duration = (Date.now() - this.startTime) / 1000;

        if (code === 0 || code === 255) {
          // Codigo 255 e normal quando o processo e finalizado com SIGTERM
          console.log(`[Captura] Gravacao finalizada. Duracao: ${duration.toFixed(1)}s`);
          this.emit('stop', { file: this.outputFile, duration });
        } else {
          const error = new Error(`FFmpeg encerrou com codigo ${code}`);
          this.emit('error', error);
          reject(error);
        }
      });

      this.process.on('error', (error) => {
        this.isRecording = false;
        if (error.code === 'ENOENT') {
          reject(new Error(
            'FFmpeg nao encontrado! Instale o FFmpeg e adicione ao PATH.\n' +
            'Download: https://ffmpeg.org/download.html\n' +
            'Tutorial Windows: https://www.wikihow.com/Install-FFmpeg-on-Windows'
          ));
        } else {
          reject(error);
        }
      });

      // Resolve imediatamente com o caminho do arquivo
      // A gravacao continua em background ate stopCapture() ser chamado
      setTimeout(() => {
        if (this.isRecording) {
          resolve(this.outputFile);
        }
      }, 500);
    });
  }

  /**
   * Para a captura de audio em andamento
   * @returns {Promise<{ file: string, duration: number }>}
   */
  async stopCapture() {
    if (!this.isRecording || !this.process) {
      throw new Error('Nenhuma gravacao em andamento.');
    }

    return new Promise((resolve) => {
      const duration = (Date.now() - this.startTime) / 1000;

      this.process.on('close', () => {
        resolve({
          file: this.outputFile,
          duration,
        });
      });

      // Envia 'q' para o FFmpeg encerrar graciosamente
      // Isso garante que o arquivo seja finalizado corretamente
      try {
        this.process.stdin.write('q');
      } catch {
        // Se stdin nao estiver acessivel, mata o processo
        this.process.kill('SIGTERM');
      }
    });
  }

  /**
   * Inicia captura em modo streaming - salva chunks periodicos
   * Util para processamento em tempo real durante a reuniao
   *
   * @param {Object} options - Opcoes
   * @param {number} options.chunkDuration - Duracao de cada chunk em segundos
   * @param {Function} options.onChunk - Callback chamado a cada chunk salvo
   * @returns {Promise<void>}
   */
  async startStreamCapture(options = {}) {
    const chunkDuration = options.chunkDuration || this.chunkDuration;
    const onChunk = options.onChunk || (() => {});

    this._ensureOutputDir();
    this.isRecording = true;
    this.startTime = Date.now();
    this.chunks = [];
    let chunkIndex = 0;

    console.log(`[Captura Streaming] Iniciando captura em chunks de ${chunkDuration}s`);
    this.emit('streamStart', { chunkDuration });

    // Loop de gravacao de chunks
    const recordChunk = async () => {
      if (!this.isRecording) return;

      const chunkFile = path.join(
        this.outputDir,
        `chunk_${String(chunkIndex).padStart(4, '0')}.${this.format}`
      );

      const args = [
        '-f', 'dshow',
        '-i', `audio=${this.device}`,
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-t', String(chunkDuration),
        '-y',
      ];

      if (this.format === 'wav') {
        args.push('-acodec', 'pcm_s16le');
      }
      args.push(chunkFile);

      return new Promise((resolve) => {
        const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

        proc.on('close', (code) => {
          if (code === 0 || code === 255) {
            this.chunks.push(chunkFile);
            console.log(`[Captura Streaming] Chunk ${chunkIndex} salvo: ${chunkFile}`);
            this.emit('chunk', { index: chunkIndex, file: chunkFile });
            onChunk({ index: chunkIndex, file: chunkFile });
            chunkIndex++;

            // Grava proximo chunk se ainda estiver gravando
            if (this.isRecording) {
              recordChunk().then(resolve);
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        });

        proc.on('error', () => resolve());

        // Armazena referencia para poder parar
        this.process = proc;
      });
    };

    // Inicia a gravacao de chunks em background
    recordChunk();
  }

  /**
   * Para a captura em modo streaming
   * @returns {{ chunks: string[], duration: number }}
   */
  stopStreamCapture() {
    this.isRecording = false;
    const duration = (Date.now() - this.startTime) / 1000;

    if (this.process) {
      try {
        this.process.stdin.write('q');
      } catch {
        this.process.kill('SIGTERM');
      }
    }

    console.log(`[Captura Streaming] Parada. ${this.chunks.length} chunks salvos. Duracao: ${duration.toFixed(1)}s`);
    this.emit('streamStop', { chunks: this.chunks, duration });

    return { chunks: [...this.chunks], duration };
  }

  /**
   * Retorna o tempo de gravacao atual em segundos
   * @returns {number}
   */
  getElapsedTime() {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 1000;
  }
}

module.exports = AudioCapture;
