import { Component, computed, effect, ElementRef, input, signal, untracked, AfterViewInit, OnDestroy } from '@angular/core';
import { Slide } from './types/slide';
import { CommonModule, NgStyle } from '@angular/common';
@Component({
  selector: 'app-imageslider',
  imports: [CommonModule],
  templateUrl: './imageslider.html',
  styleUrl: './imageslider.css',
})
export class Imageslider {
  private resizeObserver?: ResizeObserver;

ngAfterViewInit() {

    const slider = this.elRef.nativeElement
        .querySelector('.slider') as HTMLElement;

    const updateWidth = () => {

        const availableWidth = slider.getBoundingClientRect().width;

        this.actualWidth.set(
            Math.min(availableWidth, this.parentWidth())
        );

    };

    updateWidth();

    this.resizeObserver = new ResizeObserver(() => {
        updateWidth();
    });

    this.resizeObserver.observe(slider);
}

ngOnDestroy() {
    this.resizeObserver?.disconnect();

    window.clearTimeout(this.timeoutID());
}
  actualWidth = signal(0);
  slides = input.required<Slide[]>();
  parentWidth = input.required<number>();
  maxHeight = input.required<number>();
  naturalRatio = signal(1); // height / width

  darkMode = signal(false);

  sliderHeight = computed(() => {
    const calculated = this.actualWidth() * this.naturalRatio();

    return Math.min(calculated, this.maxHeight());
  });

  ngOnInit() {
    this.loadImage(this.slides()[0].url);
  }

    loadImage(url: string) {
  const img = new Image();
  img.src = url;
  img.onload = () => {
    this.naturalRatio.set(img.naturalHeight / img.naturalWidth);
  };
  }

  getStyle(slide: Slide) {
  return {
    backgroundImage: `url("${slide.url}")`,
    width: `${this.actualWidth()}px`,
    height: '100%',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    imageRendering: 'pixelated'
  };
  }
  
containerStyle() {
  const slideCount = this.slides().length;
  const position = slideCount > 1 ? this.trackIndex() : 0;

  return {
    width: `${this.extendedSlides().length * this.actualWidth()}px`,
    transform: `translateX(${
      -position * this.actualWidth() + this.dragOffset()
    }px)`
  };
}

  currentIndex = signal(0)



gotonext(): void {
  const total = this.slides().length;

  if (total <= 1 || this.isAnimating()) return;

  this.isAnimating.set(true);

  this.trackIndex.update(index => index + 1);
  this.currentIndex.update(index => (index + 1) % total);
}

gotoprev(): void {
  const total = this.slides().length;

  if (total <= 1 || this.isAnimating()) return;

  this.isAnimating.set(true);

  this.trackIndex.update(index => index - 1);
  this.currentIndex.update(index => (index - 1 + total) % total);
}
gotoslide(index: number): void {
  if (this.isAnimating()) return;

  this.currentIndex.set(index);
  this.isSnapping.set(true);
  this.trackIndex.set(index + 1);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.isSnapping.set(false);
    });
  });
}
timeoutID = signal<number | undefined>(undefined);

timeouteffect = effect(() => {
  const index = this.currentIndex();
  const dragging = this.isDragging();

  const prevID = untracked(() => this.timeoutID());
  window.clearTimeout(prevID);

  // Don't start autoplay while dragging
  if (dragging) {
    untracked(() => this.timeoutID.set(undefined));
    return;
  }

  const ID = window.setTimeout(() => {
    this.gotonext();
  }, 5000);

  untracked(() => this.timeoutID.set(ID));
});
  constructor(private elRef: ElementRef) {
    effect(() => {
      const index = this.currentIndex();
      const slide = this.slides()[index];
      if (!slide) return;

      const img = new Image();
      img.src = slide.url;
      img.onload = () => {
        this.naturalRatio.set(img.naturalHeight / img.naturalWidth);
      };
    });
    this.updateDarkMode();

    const observer = new MutationObserver(() => this.updateDarkMode());
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    effect(() => {
      const isDark = this.darkMode();
      this.syncDarkClass(isDark);
    });
  }

  updateDarkMode() {
    this.darkMode.set(!document.body.classList.contains('body-dark'));
  }

  syncDarkClass(isDark: boolean) {
    const arrows = Array.from(this.elRef.nativeElement.querySelectorAll('.arrow')) as HTMLElement[];
    const dots = Array.from(this.elRef.nativeElement.querySelectorAll('.dot')) as HTMLElement[];

    arrows.forEach(el => el.classList.toggle('dark', isDark));
    dots.forEach(el => el.classList.toggle('dark', isDark));
  }
  private touchStartX = 0;
private touchStartY = 0;

onTouchStart(event: TouchEvent): void {
  this.touchStartX = event.touches[0].clientX;
  this.touchStartY = event.touches[0].clientY;

  this.isDragging.set(true);
  this.dragOffset.set(0);
}

onTouchEnd(event: TouchEvent): void {
  if (!this.isDragging()) return;

  const offset = this.dragOffset();
  const threshold = this.actualWidth() * 0.2;

  // Stop dragging first
  this.isDragging.set(false);

  if (offset < -threshold) {
    this.gotonext();
  } else if (offset > threshold) {
    this.gotoprev();
  }

  // Always clear the temporary drag offset
  this.dragOffset.set(0);
} 
onTouchMove(event: TouchEvent): void {
  if (!this.isDragging()) return;

  const deltaX = event.touches[0].clientX - this.touchStartX;
  const deltaY = event.touches[0].clientY - this.touchStartY;

  // Ignore predominantly vertical movement
  if (Math.abs(deltaY) > Math.abs(deltaX)) return;

  const maxDrag = this.actualWidth();

  this.dragOffset.set(
    Math.max(-maxDrag, Math.min(maxDrag, deltaX))
  );
}
dragOffset = signal(0);
isDragging = signal(false); 

extendedSlides = computed(() => {
  const slides = this.slides();

  if (slides.length <= 1) {
    return slides;
  }

  return [
    slides[slides.length - 1],
    ...slides,
    slides[0]
  ];
});
private normalizeIndex(): void {
  const total = this.slides().length;

  if (total <= 1) return;

  if (this.currentIndex() >= total) {
    this.currentIndex.set(0);
  } else if (this.currentIndex() < 0) {
    this.currentIndex.set(total - 1);
  }
}

trackIndex = signal(1);

isSnapping = signal(false);
onTrackTransitionEnd(event: TransitionEvent): void {
  if (event.target !== event.currentTarget) return;
  if (event.propertyName !== 'transform') return;

  const total = this.slides().length;

  if (total <= 1) {
    this.isAnimating.set(false);
    return;
  }

  const position = this.trackIndex();

  if (position === 0) {
    // We reached the cloned last slide.
    this.snapToPosition(total);
    return;
  }

  if (position === total + 1) {
    // We reached the cloned first slide.
    this.snapToPosition(1);
    return;
  }

  this.isAnimating.set(false);
}

private snapToPosition(position: number): void {
  this.isSnapping.set(true);

  // Disable transition and move to the real slide.
  this.trackIndex.set(position);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.isSnapping.set(false);
      this.isAnimating.set(false);
    });
  });
}

isAnimating = signal(false);
  }
