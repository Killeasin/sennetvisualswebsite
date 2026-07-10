const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image') as HTMLImageElement | null;
const closeButton = document.getElementById('close-image-modal');
const backdrop = document.getElementById('modal-backdrop');
const triggers = Array.from(document.querySelectorAll('[data-image-src]')) as HTMLButtonElement[];

function openModal(src: string, title: string) {
  if (!modal || !modalImage) return;

  modalImage.src = src;
  modalImage.alt = title;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

triggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const src = trigger.getAttribute('data-image-src');
    const title = trigger.getAttribute('data-image-title') || 'Portfolio Work';
    if (src) openModal(src, title);
  });
});

closeButton?.addEventListener('click', closeModal);
backdrop?.addEventListener('click', closeModal);
modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});
