import { useEffect, useRef, useState } from "react";
import { Camera, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { getDb } from "@/lib/cvp/db";
import { deletePhoto, savePhoto } from "@/lib/cvp/repo";
import { PHOTO_KINDS } from "@/lib/cvp/types";
import { useRows } from "@/lib/cvp/hooks";
import { toast } from "sonner";

export function PhotoStrip({
  ownerModule,
  ownerId,
}: {
  ownerModule: string;
  ownerId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>(PHOTO_KINDS[0]);
  const photos = useRows(
    () => getDb().photos.where("ownerId").equals(ownerId).reverse().sortBy("createdAt"),
    [ownerId],
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">Ảnh minh chứng</h3>
        <span className="font-mono text-xs tabular-nums text-muted">{photos.length}</span>
      </div>
      <div className="flex gap-2">
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="flex-1">
          {PHOTO_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" />
          Chụp
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            await savePhoto({ ownerModule, ownerId, kind, blob: file });
            toast.success("Đã lưu ảnh");
          }}
        />
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">Chưa có ảnh. Chụp để lưu minh chứng.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard key={p.id} photoId={p.id} blobId={p.blobId} kind={p.kind} createdAt={p.createdAt} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PhotoCard({
  photoId,
  blobId,
  kind,
  createdAt,
}: {
  photoId: string;
  blobId: string;
  kind: string;
  createdAt: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    void getDb()
      .blobs.get(blobId)
      .then((row) => {
        if (!row) return;
        revoke = URL.createObjectURL(row.data);
        setUrl(revoke);
      });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [blobId]);

  return (
    <li className="overflow-hidden rounded-lg bg-surface-2 shadow-[var(--shadow-border)]">
      {url ? (
        <img src={url} alt={kind} className="aspect-[4/3] w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10" />
      ) : (
        <div className="aspect-[4/3] bg-surface" />
      )}
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs">{kind}</p>
          <p className="font-mono text-[10px] text-muted tabular-nums">
            {new Date(createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 min-h-9"
            aria-label="Chia sẻ"
            onClick={async () => {
              const row = await getDb().blobs.get(blobId);
              if (!row) return;
              const file = new File([row.data], `${kind}.jpg`, { type: row.mime });
              if (navigator.share) {
                await navigator.share({ files: [file], title: kind });
              } else {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(row.data);
                a.download = file.name;
                a.click();
              }
            }}
          >
            <Share2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 min-h-9"
            aria-label="Xóa ảnh"
            onClick={async () => {
              await deletePhoto(photoId);
              toast.success("Đã xóa ảnh");
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
