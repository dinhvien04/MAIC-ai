export class StudyState {
  constructor() { this.mode = 'stopped'; this.reason = 'Chưa bật trợ lý.'; this.generation = 0; this.abort = new AbortController(); }
  set(mode, reason) {
    if (!['running', 'paused', 'stopped'].includes(mode)) throw new Error('Trạng thái không hợp lệ.');
    this.abort.abort(); this.abort = new AbortController(); this.generation++;
    this.mode = mode; this.reason = reason;
  }
  assertRunning() { if (this.mode !== 'running') throw new Error('Trợ lý chưa chạy hoặc đang tạm dừng.'); }
  checkpoint() { return { generation: this.generation, signal: this.abort.signal }; }
  valid(checkpoint) { return !checkpoint.signal.aborted && checkpoint.generation === this.generation; }
}
