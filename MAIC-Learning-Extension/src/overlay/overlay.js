import styles from './overlay.css';
export class Overlay {
  constructor(doc, command) { this.doc = doc; this.command = command; }
  mount() {
    if (this.host?.isConnected) return;
    this.events = new this.doc.defaultView.AbortController();
    this.host = this.doc.createElement('div'); this.host.dataset.maicExtension = 'overlay';
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style'); style.textContent = styles; shadow.append(style);
    const panel = this.doc.createElement('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'MAIC Learning Assistant'); shadow.append(panel);
    const header = this.doc.createElement('header'); panel.append(header);
    const title = this.doc.createElement('strong'); title.textContent = 'MAIC · HỖ TRỢ HỌC'; header.append(title);
    const collapse = this.button('−', () => { this.body.hidden = !this.body.hidden; collapse.textContent = this.body.hidden ? '+' : '−'; });
    collapse.setAttribute('aria-label', 'Thu gọn / mở rộng'); header.append(collapse);
    this.body = this.doc.createElement('div'); this.body.className = 'body'; panel.append(this.body);
    this.count = this.doc.createElement('p'); this.count.className = 'count'; this.body.append(this.count);
    this.status = this.doc.createElement('p'); this.status.className = 'status'; this.status.setAttribute('aria-live', 'polite'); this.body.append(this.status);
    const actions = this.doc.createElement('div'); actions.className = 'buttons'; this.body.append(actions);
    for (const [label, action] of [['← Trước', 'PREVIOUS'], ['Sau →', 'NEXT'], ['Ghi chú', 'NOTES'], ['Tạm dừng', 'PAUSE'], ['Tiếp tục', 'RESUME'], ['Dừng', 'STOP']]) actions.append(this.button(label, () => this.command(action)));
    let drag;
    const signal = this.events.signal;
    header.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      const rect = this.host.getBoundingClientRect(); drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      header.setPointerCapture(event.pointerId);
    }, { signal });
    header.addEventListener('pointermove', event => {
      if (!drag) return;
      this.host.style.right = 'auto';
      this.host.style.left = `${Math.max(0, Math.min(this.doc.defaultView.innerWidth - 254, event.clientX - drag.x))}px`;
      this.host.style.top = `${Math.max(0, Math.min(this.doc.defaultView.innerHeight - 50, event.clientY - drag.y))}px`;
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, () => { drag = null; }, { signal });
    this.doc.documentElement.append(this.host);
  }
  button(label, callback) {
    const button = this.doc.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => Promise.resolve(callback()).catch(error => { if (this.status) this.status.textContent = error.message; }), { signal: this.events.signal });
    return button;
  }
  update(slide, reason) { this.count.textContent = `${slide?.slideNumber ?? '?'} / ${slide?.totalSlides ?? '?'}`; this.status.textContent = reason; }
  remove() { this.events?.abort(); this.host?.remove(); this.host = null; }
}
