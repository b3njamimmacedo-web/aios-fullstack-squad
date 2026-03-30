/**
 * Meeting Store - Armazenamento local de reuniões processadas
 * Usa JSON em disco para persistência simples
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MeetingStore {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data', 'meetings');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * Salva uma reunião completa
   */
  save(data) {
    const id = data.id || crypto.randomUUID();
    const meetingDir = path.join(this.baseDir, id);
    fs.mkdirSync(meetingDir, { recursive: true });

    const meeting = {
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: data.status || 'processed',
      metadata: data.metadata || {},
      transcript: data.transcript || null,
      analysis: data.analysis || null,
      pricing: data.pricing || null,
      proposal_path: data.proposal_path || null,
      obsidian_path: data.obsidian_path || null
    };

    fs.writeFileSync(path.join(meetingDir, 'meeting.json'), JSON.stringify(meeting, null, 2), 'utf-8');

    // Salva componentes em arquivos separados para acesso rápido
    if (meeting.transcript) {
      fs.writeFileSync(path.join(meetingDir, 'transcript.json'), JSON.stringify(meeting.transcript, null, 2), 'utf-8');
    }
    if (meeting.analysis) {
      fs.writeFileSync(path.join(meetingDir, 'analysis.json'), JSON.stringify(meeting.analysis, null, 2), 'utf-8');
    }
    if (meeting.pricing) {
      fs.writeFileSync(path.join(meetingDir, 'pricing.json'), JSON.stringify(meeting.pricing, null, 2), 'utf-8');
    }

    // Atualiza índice
    this._updateIndex(meeting);

    return meeting;
  }

  /**
   * Busca uma reunião por ID
   */
  get(id) {
    const filePath = path.join(this.baseDir, id, 'meeting.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Lista todas as reuniões
   */
  list(filters = {}) {
    const index = this._getIndex();
    let meetings = index.meetings || [];

    if (filters.date) {
      meetings = meetings.filter(m => m.date === filters.date);
    }
    if (filters.client) {
      meetings = meetings.filter(m =>
        (m.client || '').toLowerCase().includes(filters.client.toLowerCase())
      );
    }
    if (filters.status) {
      meetings = meetings.filter(m => m.status === filters.status);
    }

    return meetings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  /**
   * Atualiza uma reunião
   */
  update(id, updates) {
    const meeting = this.get(id);
    if (!meeting) throw new Error(`Reunião ${id} não encontrada`);

    const updated = { ...meeting, ...updates, updated_at: new Date().toISOString() };
    const meetingDir = path.join(this.baseDir, id);
    fs.writeFileSync(path.join(meetingDir, 'meeting.json'), JSON.stringify(updated, null, 2), 'utf-8');

    this._updateIndex(updated);
    return updated;
  }

  /**
   * Remove uma reunião
   */
  delete(id) {
    const meetingDir = path.join(this.baseDir, id);
    if (fs.existsSync(meetingDir)) {
      fs.rmSync(meetingDir, { recursive: true });
    }

    const index = this._getIndex();
    index.meetings = (index.meetings || []).filter(m => m.id !== id);
    this._saveIndex(index);
  }

  /**
   * Limpa reuniões antigas
   */
  cleanup(retentionDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const meetings = this.list();
    let removed = 0;

    for (const m of meetings) {
      if (new Date(m.created_at) < cutoff) {
        this.delete(m.id);
        removed++;
      }
    }

    console.log(`[MeetingStore] ${removed} reuniões antigas removidas (>${retentionDays} dias)`);
    return removed;
  }

  _getIndex() {
    const indexPath = path.join(this.baseDir, 'index.json');
    if (!fs.existsSync(indexPath)) return { meetings: [] };
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }

  _saveIndex(index) {
    fs.writeFileSync(path.join(this.baseDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  }

  _updateIndex(meeting) {
    const index = this._getIndex();
    const existing = (index.meetings || []).findIndex(m => m.id === meeting.id);
    const entry = {
      id: meeting.id,
      date: meeting.metadata?.date || meeting.created_at?.split('T')[0],
      client: meeting.metadata?.client || 'Desconhecido',
      status: meeting.status,
      created_at: meeting.created_at,
      platform: meeting.metadata?.platform || ''
    };

    if (existing >= 0) {
      index.meetings[existing] = entry;
    } else {
      index.meetings = index.meetings || [];
      index.meetings.push(entry);
    }

    this._saveIndex(index);
  }
}

module.exports = MeetingStore;
