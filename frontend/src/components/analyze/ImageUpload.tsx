import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { captureProductPhoto } from '@native/camera';

import { useToast } from '../../hooks/useToast';
import { cx } from '../../utils/format';

interface ImageUploadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Longest edge of the stored thumbnail, in pixels. */
const MAX_EDGE = 640;
const JPEG_QUALITY = 0.72;

/**
 * Downscale on the client before storing.
 *
 * Images are persisted as data URLs, so a 4 MB phone photo would bloat both the
 * request and the database. Re-encoding to a <=640px JPEG keeps a product
 * thumbnail well under ~80 KB with no visible loss at the sizes we render.
 */
async function toDownscaledDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('That file could not be read as an image.'));
      element.src = objectUrl;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser blocked image processing.');

    // JPEG has no alpha channel, so transparent pixels would encode as black.
    // Product photos are conventionally on white, so flatten onto white first.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Drag-and-drop or click-to-browse product image field with a live preview. */
export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('image.notImage'), 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast(t('image.tooBig'), 'error');
      return;
    }

    setIsProcessing(true);
    try {
      onChange(await toDownscaledDataUrl(file));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not read that image.', 'error');
    } finally {
      setIsProcessing(false);
    }
  }

  function clearImage() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function openPicker() {
    try {
      const nativePhoto = await captureProductPhoto();
      if (nativePhoto) {
        onChange(nativePhoto);
        return;
      }
      inputRef.current?.click();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not open the camera.', 'error');
    }
  }

  return (
    <div>
      <span className="label-text" id="product-image-label">
        {t('image.label')}
      </span>

      {value ? (
        <div className="relative overflow-hidden border border-rule bg-paper">
          <img
            src={value}
            alt="Preview of the product you are analysing"
            className="mx-auto max-h-64 w-full object-contain"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 bg-paper/95 px-2.5 py-1.5 text-xs font-medium text-ink ring-1 ring-rule transition hover:text-danger-600"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            {t('image.remove')}
          </button>
        </div>
      ) : (
        <div
          data-dropzone="product-image"
          role="button"
          tabIndex={0}
          aria-labelledby="product-image-label"
          aria-describedby="product-image-hint"
          onClick={() => void openPicker()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
          className={cx(
            'flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition',
            isDragging
              ? 'border-brand-600 bg-brand-50'
              : 'border-rule bg-paper hover:border-ink/40',
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center border border-rule bg-[#faf8f3] text-brand-700">
            {isProcessing ? (
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
            )}
          </div>

          <p className="text-sm font-medium text-ink">
            {isProcessing ? t('image.processing') : t('image.drop')}
          </p>
          <p id="product-image-hint" className="text-xs text-ink-muted">
            {t('image.hint')}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-labelledby="product-image-label"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
