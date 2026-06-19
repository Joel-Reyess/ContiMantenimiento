import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Check } from 'lucide-react';
import type { VehicleImagePoint } from '@/interfaces';
import { cn } from '@/lib/utils';

interface InteractiveVehicleImageProps {
  imageUrl?: string;
  points: VehicleImagePoint[];
  selectedPointIds?: number[];
  onTogglePoint?: (point: VehicleImagePoint) => void;
  onImageClick?: (xPct: number, yPct: number) => void;
  draftPoint?: {
    xPct: number;
    yPct: number;
    radiusPct?: number;
  };
  draftPointLabel?: string;
  pointVisualMode?: 'default' | 'compact';
  showPointLabels?: boolean;
  readonly?: boolean;
  className?: string;
  emptyMessage?: string;
}

type ImageFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

const computeImageFrame = (
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number
): ImageFrame => {
  if (!containerWidth || !containerHeight) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }

  if (!naturalWidth || !naturalHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }

  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
};

export function InteractiveVehicleImage({
  imageUrl,
  points,
  selectedPointIds = [],
  onTogglePoint,
  onImageClick,
  draftPoint,
  draftPointLabel = 'Punto temporal',
  pointVisualMode = 'default',
  showPointLabels = true,
  readonly = false,
  className,
  emptyMessage = 'No hay puntos configurados para esta vista.',
}: InteractiveVehicleImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateSize());
      resizeObserver.observe(el);
    } else {
      window.addEventListener('resize', updateSize);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, []);

  const imageFrame = useMemo(
    () =>
      computeImageFrame(
        containerSize.width,
        containerSize.height,
        imageNaturalSize.width,
        imageNaturalSize.height
      ),
    [containerSize.width, containerSize.height, imageNaturalSize.width, imageNaturalSize.height]
  );

  const pctToPixel = (xPct: number, yPct: number) => ({
    x: imageFrame.left + (clampPct(xPct) / 100) * imageFrame.width,
    y: imageFrame.top + (clampPct(yPct) / 100) * imageFrame.height,
  });

  const radiusToDiameterPx = (radiusPct: number | undefined, minPx: number) => {
    const safeRadius = radiusPct && radiusPct > 0 ? radiusPct : 1.8;
    return Math.max((safeRadius * 2 * imageFrame.width) / 100, minPx);
  };

  const handleImageClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onImageClick || readonly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const frame = computeImageFrame(
      rect.width,
      rect.height,
      imageNaturalSize.width,
      imageNaturalSize.height
    );

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const x = ((localX - frame.left) / frame.width) * 100;
    const y = ((localY - frame.top) / frame.height) * 100;

    onImageClick(Number(clampPct(x).toFixed(2)), Number(clampPct(y).toFixed(2)));
  };

  const draftCenter = draftPoint ? pctToPixel(draftPoint.xPct, draftPoint.yPct) : null;
  const draftDiameterPx = draftPoint ? radiusToDiameterPx(draftPoint.radiusPct, 18) : 0;
  const showDraft = Boolean(draftPoint && draftCenter && draftPointLabel?.trim());

  return (
    <div className={cn('space-y-3 w-full', className)}>
      <div
        ref={containerRef}
        className={cn(
          'relative mx-auto w-full overflow-hidden rounded-xl border border-continental-gray-3/70 bg-white max-h-48 sm:max-h-64',
          'aspect-[16/9] sm:aspect-[4/3]',
          onImageClick && !readonly ? 'cursor-crosshair' : 'cursor-default'
        )}
        onClick={handleImageClick}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Vista de vehiculo"
            className="h-full w-full object-contain object-center bg-white"
            onLoad={(evt) =>
              setImageNaturalSize({
                width: evt.currentTarget.naturalWidth || 0,
                height: evt.currentTarget.naturalHeight || 0,
              })
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-continental-gray-5 text-sm text-continental-gray-1">
            No hay imagen disponible para este tipo de vehiculo.
          </div>
        )}

        {showDraft && (
          <>
            <div className="pointer-events-none absolute inset-0 z-20">
              <div className="absolute left-0 right-0 h-px bg-continental-blue-dark/60" style={{ top: draftCenter?.y }} />
              <div className="absolute top-0 bottom-0 w-px bg-continental-blue-dark/60" style={{ left: draftCenter?.x }} />
            </div>
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-continental-blue-dark/90 bg-continental-blue-dark/15 shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
              style={{
                left: draftCenter?.x,
                top: draftCenter?.y,
                width: draftDiameterPx,
                height: draftDiameterPx,
                minWidth: draftDiameterPx,
                minHeight: draftDiameterPx,
              }}
            />
            <div
              className="pointer-events-none absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-continental-blue-dark ring-2 ring-white"
              style={{ left: draftCenter?.x, top: draftCenter?.y }}
            />
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-continental-blue-dark shadow"
              style={{
                left: draftCenter?.x,
                top: `calc(${draftCenter?.y}px + 14px)`,
              }}
            >
              {draftPointLabel}
            </div>
          </>
        )}

        {points.map((point) => {
          const selected = selectedPointIds.includes(point.id);
          const radius = point.radiusPct && point.radiusPct > 0 ? point.radiusPct : 1.0;
          const pointLabel = point.imageFaultName || `Falla #${point.imageFaultId}`;
          const compactMode = pointVisualMode === 'compact';
          const center = pctToPixel(point.xPct, point.yPct);

          const compactMarkerPx = selected ? 14 : 11;
          const defaultMarkerPx = radiusToDiameterPx(radius, 8);
          const markerPx = compactMode ? compactMarkerPx : defaultMarkerPx;

          return (
            <div key={point.id} className="absolute" style={{ left: center.x, top: center.y }}>
              <div
                role={readonly ? undefined : 'button'}
                tabIndex={readonly ? -1 : 0}
                title={pointLabel}
                className={cn(
                  'relative -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md box-border p-0 leading-none appearance-none flex items-center justify-center transition-all duration-150',
                  readonly
                    ? 'cursor-default border-red-500/70 bg-red-500/50'
                    : selected
                      ? compactMode
                        ? 'border-continental-yellow bg-continental-yellow shadow-sm z-10 ring-1 ring-white scale-100'
                        : 'border-continental-yellow bg-continental-yellow shadow-md scale-110 z-10 ring-1 ring-white'
                      : compactMode
                        ? 'border-red-500 bg-red-500/85 hover:scale-105'
                        : 'border-red-500 bg-red-500/80 hover:scale-110'
                )}
                style={{
                  width: markerPx,
                  height: markerPx,
                  minWidth: markerPx,
                  minHeight: markerPx,
                }}
                onClick={(evt) => {
                  evt.stopPropagation();
                  if (!readonly) onTogglePoint?.(point);
                }}
                onKeyDown={(evt) => {
                  if (readonly) return;
                  if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    evt.stopPropagation();
                    onTogglePoint?.(point);
                  }
                }}
              >
                {selected && (
                  <Check
                    className={compactMode ? 'h-2 w-2 text-continental-blue-dark' : 'h-3 w-3 text-continental-blue-dark'}
                    strokeWidth={3}
                  />
                )}
              </div>
              {showPointLabels && (
                <div
                  className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 shadow"
                  style={{ marginTop: 2 }}
                >
                  {pointLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {points.length === 0 && <p className="text-sm italic text-continental-gray-1">{emptyMessage}</p>}
    </div>
  );
}

export default InteractiveVehicleImage;
