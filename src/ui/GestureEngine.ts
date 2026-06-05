import type { GestureCallbacks } from '../types';

type ListenerTarget = Pick<HTMLElement, 'addEventListener' | 'removeEventListener' | 'getBoundingClientRect'>;

interface RegisteredListener {
    type: string;
    listener: EventListener;
    options?: AddEventListenerOptions | boolean;
}

interface NormalizedPoint {
    x: number;
    y: number;
}

export class GestureEngine {
    private element: ListenerTarget;
    private callbacks: GestureCallbacks;
    private listeners: RegisteredListener[] = [];
    private isActive = false;
    private lastPoint: NormalizedPoint | null = null;
    private pinchDistance: number | null = null;

    constructor(element: HTMLElement, callbacks: GestureCallbacks) {
        this.element = element;
        this.callbacks = callbacks;
        this.bind();
    }

    destroy(): void {
        for (const entry of this.listeners) {
            this.element.removeEventListener(entry.type, entry.listener, entry.options);
        }
        this.listeners = [];
        this.isActive = false;
        this.lastPoint = null;
        this.pinchDistance = null;
    }

    private bind(): void {
        this.on('mousedown', this.handleMouseDown);
        this.on('mousemove', this.handleMouseMove);
        this.on('mouseup', this.handleMouseUp);
        this.on('mouseleave', this.handleMouseUp);
        this.on('wheel', this.handleWheel, { passive: false });
        this.on('touchstart', this.handleTouchStart, { passive: false });
        this.on('touchmove', this.handleTouchMove, { passive: false });
        this.on('touchend', this.handleTouchEnd, { passive: true });
        this.on('touchcancel', this.handleTouchEnd, { passive: true });
        this.on('dblclick', this.handleDoubleClick);
    }

    private on(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean): void {
        this.element.addEventListener(type, listener, options);
        this.listeners.push({ type, listener, options });
    }

    private handleMouseDown = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        if (mouseEvent.button !== 0 && mouseEvent.button !== 1) return;

        const point = this.getPoint(mouseEvent.clientX, mouseEvent.clientY);
        const shouldTrack = this.callbacks.onStart?.(point.x, point.y, mouseEvent.button, mouseEvent.shiftKey);
        this.isActive = shouldTrack === true;
        this.lastPoint = this.isActive ? point : null;
        if (this.isActive) mouseEvent.preventDefault?.();
    };

    private handleMouseMove = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        const point = this.getPoint(mouseEvent.clientX, mouseEvent.clientY);

        if (!this.isActive) {
            this.callbacks.onHover?.(point.x, point.y);
            return;
        }

        const previous = this.lastPoint || point;
        this.callbacks.onMove?.(point.x, point.y, point.x - previous.x, point.y - previous.y);
        this.lastPoint = point;
        mouseEvent.preventDefault?.();
    };

    private handleMouseUp = (): void => {
        if (this.isActive) this.callbacks.onEnd?.();
        this.isActive = false;
        this.lastPoint = null;
    };

    private handleWheel = (event: Event): void => {
        const wheelEvent = event as WheelEvent;
        const rect = this.getRect();
        if (rect.width <= 0) return;

        wheelEvent.preventDefault?.();
        const focusX = this.clamp((wheelEvent.clientX - rect.left) / rect.width, 0, 1);
        const delta = wheelEvent.deltaY < 0 ? 1 : -1;
        this.callbacks.onZoom?.(delta, focusX);
    };

    private handleTouchStart = (event: Event): void => {
        const touchEvent = event as TouchEvent;
        if (touchEvent.touches.length === 1) {
            const touch = touchEvent.touches[0];
            const point = this.getPoint(touch.clientX, touch.clientY);
            const shouldTrack = this.callbacks.onStart?.(point.x, point.y, 0, false);
            this.isActive = shouldTrack === true;
            this.lastPoint = this.isActive ? point : null;
        } else if (touchEvent.touches.length >= 2) {
            this.isActive = false;
            this.lastPoint = null;
            this.pinchDistance = this.getTouchDistance(touchEvent);
        }
        touchEvent.preventDefault?.();
    };

    private handleTouchMove = (event: Event): void => {
        const touchEvent = event as TouchEvent;
        if (touchEvent.touches.length >= 2) {
            const previousDistance = this.pinchDistance;
            const nextDistance = this.getTouchDistance(touchEvent);
            this.pinchDistance = nextDistance;
            if (previousDistance !== null && previousDistance > 0) {
                const centerX = (touchEvent.touches[0].clientX + touchEvent.touches[1].clientX) * 0.5;
                const rect = this.getRect();
                const focusX = rect.width > 0 ? this.clamp((centerX - rect.left) / rect.width, 0, 1) : 0.5;
                this.callbacks.onZoom?.(nextDistance > previousDistance ? 1 : -1, focusX);
            }
            touchEvent.preventDefault?.();
            return;
        }

        if (touchEvent.touches.length === 0) return;
        const touch = touchEvent.touches[0];
        const point = this.getPoint(touch.clientX, touch.clientY);

        if (!this.isActive) {
            this.callbacks.onHover?.(point.x, point.y);
            return;
        }

        const previous = this.lastPoint || point;
        this.callbacks.onMove?.(point.x, point.y, point.x - previous.x, point.y - previous.y);
        this.lastPoint = point;
        touchEvent.preventDefault?.();
    };

    private handleTouchEnd = (): void => {
        if (this.isActive) this.callbacks.onEnd?.();
        this.isActive = false;
        this.lastPoint = null;
        this.pinchDistance = null;
    };

    private handleDoubleClick = (event: Event): void => {
        const mouseEvent = event as MouseEvent;
        const point = this.getPoint(mouseEvent.clientX, mouseEvent.clientY);
        this.callbacks.onDoubleClick?.(point.x, point.y);
    };

    private getPoint(clientX: number, clientY: number): NormalizedPoint {
        const rect = this.getRect();
        return {
            x: rect.width > 0 ? this.clamp((clientX - rect.left) / rect.width, 0, 1) : 0,
            y: rect.height > 0 ? this.clamp((clientY - rect.top) / rect.height, 0, 1) : 0
        };
    }

    private getTouchDistance(event: TouchEvent): number {
        const first = event.touches[0];
        const second = event.touches[1];
        if (!first || !second) return 0;
        return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    }

    private getRect(): DOMRect {
        return this.element.getBoundingClientRect();
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }
}

export type { GestureCallbacks };
