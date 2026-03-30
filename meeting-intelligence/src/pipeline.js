/**
 * Pipeline - Orquestrador principal do Meeting Intelligence
 * Encadeia: Captura → Transcrição → Análise → Proposta + Preço + Obsidian
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const AudioCapture = require('./capture/audio-capture');
const WhisperEngine = require('./transcription/whisper-engine');
const MeetingAnalyzer = require('./analysis/meeting-analyzer');
const SiteGenerator = require('./proposal/site-generator');
const PricingEngine = require('./proposal/pricing-engine');
const ObsidianExporter = require('./notes/obsidian-exporter');

class Pipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.audioCapture = new AudioCapture();
    this.whisper = new WhisperEngine();
    this.analyzer = new MeetingAnalyzer();
    this.siteGenerator = new SiteGenerator(options);
    this.pricingEngine = new PricingEngine(options);
    this.obsidianExporter = new ObsidianExporter(options.obsidianVaultPath);
    this.outputDir = options.outputDir || config.outputDir || './output';
  }

  /**
   * Pipeline completo: Captura ao vivo → Processa tudo
   */
  async runFull(metadata = {}) {
    this.emit('status', 'Iniciando pipeline completo...');

    // Etapa 1: Captura de áudio
    this.emit('stage', { stage: 'capture', status: 'starting' });
    console.log('\n🎙️  Iniciando captura de áudio...');
    console.log('   Pressione Ctrl+C para parar a gravação.\n');

    const audioFile = await this.audioCapture.startCapture({
      device: metadata.device || config.audioDevice,
      outputDir: path.join(this.outputDir, 'recordings')
    });

    // Aguarda parada manual (Ctrl+C) ou timeout
    await new Promise(resolve => {
      const handler = () => { resolve(); process.removeListener('SIGINT', handler); };
      process.on('SIGINT', handler);
    });

    const recordingPath = await this.audioCapture.stopCapture();
    this.emit('stage', { stage: 'capture', status: 'done', file: recordingPath });

    // Continua com processamento
    return this.processRecording(recordingPath, metadata);
  }

  /**
   * Processa uma gravação existente (sem captura)
   */
  async processRecording(audioFilePath, metadata = {}) {
    const startTime = Date.now();
    const results = {};

    try {
      // Etapa 2: Transcrição
      this.emit('stage', { stage: 'transcription', status: 'starting' });
      console.log('\n📝 Transcrevendo áudio com Whisper...');

      results.transcript = await this.whisper.transcribe(audioFilePath);
      this.emit('stage', { stage: 'transcription', status: 'done', segments: results.transcript.length });
      console.log(`   ✅ ${results.transcript.length} segmentos transcritos.\n`);

      // Etapa 3: Análise com Claude
      this.emit('stage', { stage: 'analysis', status: 'starting' });
      console.log('🧠 Analisando reunião com Claude...');

      results.analysis = await this.analyzer.analyzeTranscript(results.transcript, metadata);
      this.emit('stage', { stage: 'analysis', status: 'done' });
      console.log('   ✅ Análise completa.\n');

      // Etapa 4: Precificação
      this.emit('stage', { stage: 'pricing', status: 'starting' });
      console.log('💰 Calculando precificação...');

      results.pricing = this.pricingEngine.generatePricing(results.analysis);
      this.emit('stage', { stage: 'pricing', status: 'done' });
      console.log(`   ✅ 3 planos gerados: ${results.pricing.resumo.faixa_preco}\n`);

      // Etapa 5: Gera site de proposta
      this.emit('stage', { stage: 'site', status: 'starting' });
      console.log('🌐 Gerando site da proposta...');

      results.proposal = await this.siteGenerator.generate(results.analysis, results.pricing, metadata);
      this.emit('stage', { stage: 'site', status: 'done' });
      console.log(`   ✅ Site gerado: ${results.proposal.htmlPath}\n`);

      // Etapa 6: Exporta para Obsidian
      this.emit('stage', { stage: 'obsidian', status: 'starting' });
      console.log('📓 Exportando notas para Obsidian...');

      results.obsidian = await this.obsidianExporter.exportAll({
        analysis: results.analysis,
        pricing: results.pricing,
        metadata,
        transcript: results.transcript
      });
      this.emit('stage', { stage: 'obsidian', status: 'done' });
      console.log(`   ✅ ${results.obsidian.files.length} arquivos exportados.\n`);

      // Salva resultado completo
      const resultPath = path.join(this.outputDir, 'results', `${Date.now()}_result.json`);
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify(results, null, 2), 'utf-8');

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✨ Pipeline concluído em ${elapsed}s!`);
      console.log(`   📄 Proposta: ${results.proposal.htmlPath}`);
      console.log(`   📓 Obsidian: ${results.obsidian.directory}`);
      console.log(`   💰 Preço recomendado: ${results.pricing.resumo.valor_recomendado}`);

      this.emit('complete', results);
      return results;

    } catch (error) {
      this.emit('error', error);
      console.error(`\n❌ Erro no pipeline: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processa transcrição já pronta (pula captura e whisper)
   */
  async processTranscript(transcript, metadata = {}) {
    const startTime = Date.now();
    const results = { transcript };

    console.log('🧠 Analisando transcrição...');
    results.analysis = await this.analyzer.analyzeTranscript(transcript, metadata);
    console.log('   ✅ Análise completa.\n');

    console.log('💰 Calculando precificação...');
    results.pricing = this.pricingEngine.generatePricing(results.analysis);
    console.log(`   ✅ ${results.pricing.resumo.faixa_preco}\n`);

    console.log('🌐 Gerando site da proposta...');
    results.proposal = await this.siteGenerator.generate(results.analysis, results.pricing, metadata);
    console.log(`   ✅ ${results.proposal.htmlPath}\n`);

    console.log('📓 Exportando para Obsidian...');
    results.obsidian = await this.obsidianExporter.exportAll({
      analysis: results.analysis, pricing: results.pricing, metadata, transcript
    });
    console.log(`   ✅ ${results.obsidian.files.length} arquivos.\n`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Concluído em ${elapsed}s!`);

    this.emit('complete', results);
    return results;
  }
}

module.exports = Pipeline;
