import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";

export function QrScanner({
  onDetect,
  active,
}: {
  onDetect: (text: string) => void;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef("");

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector =
          "BarcodeDetector" in window
            ? new (window as unknown as {
                BarcodeDetector: new (opts: { formats: string[] }) => {
                  detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
                };
              }).BarcodeDetector({
                formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a"],
              })
            : null;

        const tick = async () => {
          if (stopped) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && v.readyState >= 2) {
            try {
              if (detector) {
                const codes = await detector.detect(v);
                const text = codes[0]?.rawValue;
                if (text && text !== last.current) {
                  last.current = text;
                  onDetect(text);
                }
              } else if (c) {
                c.width = v.videoWidth;
                c.height = v.videoHeight;
                const ctx = c.getContext("2d");
                if (ctx) {
                  ctx.drawImage(v, 0, 0);
                  const img = ctx.getImageData(0, 0, c.width, c.height);
                  const code = jsQR(img.data, img.width, img.height);
                  if (code?.data && code.data !== last.current) {
                    last.current = code.data;
                    onDetect(code.data);
                  }
                }
              }
            } catch {
              /* keep scanning */
            }
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        setError("Không mở được camera. Cho phép quyền camera hoặc nhập mã thủ công.");
      }
    }
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onDetect]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-surface-2 shadow-[var(--shadow-border)]">
        <video ref={videoRef} className="aspect-[3/4] w-full object-cover sm:aspect-video" playsInline muted />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-lg border-2 border-primary/80" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {error ? <p className="text-sm text-danger">{error}</p> : <p className="text-sm text-muted">Đưa mã QR / barcode vào khung.</p>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          last.current = "";
        }}
      >
        Quét tiếp
      </Button>
    </div>
  );
}
