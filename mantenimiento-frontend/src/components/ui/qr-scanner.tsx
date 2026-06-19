import { useRef, useState } from 'react';
import { Camera, ScanLine, Upload, X } from 'lucide-react';
import { Button } from './button';

interface QrScannerButtonProps {
  onResult: (code: string) => Promise<void> | void;
  className?: string;
}

export function QrScannerButton({ onResult, className }: QrScannerButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopVideo = () => {
    const v = videoRef.current;
    if (v?.srcObject instanceof MediaStream) {
      v.srcObject.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setPreviewActive(false);
    setErrorMsg('');
  };

  const handleManual = async () => {
    const code = window.prompt('Ingresa el codigo del vehiculo (desde QR):');
    if (code) {
      await onResult(code.trim());
    }
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const video = videoRef.current;
      if (!video) throw new Error('No hay elemento de video');

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader() as any;
      setPreviewActive(true);
      setErrorMsg('');

      const code = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reader.reset();
          stopVideo();
          reject(new Error('No se detecto codigo (timeout)'));
        }, 12000);

        reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result: any, err: any) => {
          if (result) {
            clearTimeout(timeout);
            reader.reset();
            stopVideo();
            resolve(result.getText());
          } else if (err && err.name !== 'NotFoundException') {
            console.error(err);
            setErrorMsg('No se detecto codigo, intenta acercarte o usar buena iluminacion.');
          }
        });
      });

      await onResult(code);
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo escanear. Revisa permisos de camara o usa foto/codigo manual.');
      stopVideo();
    } finally {
      setScanning(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setScanning(true);
    setErrorMsg('');
    
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      
      // Crear una imagen para asegurar que esté cargada antes de procesar
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      try {
        // decodeFromImageElement es más confiable que decodeFromImageUrl en algunos navegadores
        const result = await reader.decodeFromImageElement(img);
        if (result) {
          await onResult(result.getText());
        } else {
          throw new Error('No se pudo decodificar el contenido');
        }
      } catch (decodeErr) {
        console.warn('Fallo decodificación directa, intentando con decodeFromImageUrl', decodeErr);
        // Fallback al método anterior si el nuevo falla
        const result = await reader.decodeFromImageUrl(url);
        await onResult(result.getText());
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error al procesar imagen:', err);
      setErrorMsg('No se detectó código en la imagen. Asegúrate de que sea nítida y el código esté visible.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning} className="flex items-center gap-2">
          {scanning ? (
            <>
              <ScanLine className="h-4 w-4 animate-pulse" />
              Escaneando...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              Escanear QR
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 text-continental-gray-1"
        >
          <Upload className="h-4 w-4" />
          Subir foto
        </Button>
        <Button variant="ghost" size="sm" onClick={handleManual} className="flex items-center gap-2 text-continental-gray-1">
          <X className="h-4 w-4" />
          Codigo manual
        </Button>
      </div>

      {/* Overlay de camara */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity ${
          previewActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative w-80 max-w-[90vw] aspect-square overflow-hidden rounded-2xl bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          <div className="absolute inset-4 rounded-xl border-2 border-white/70" />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-white text-xs">
            <span>Alinea el QR dentro del marco</span>
            <Button variant="ghost" size="sm" onClick={stopVideo} className="text-white hover:text-white">
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
