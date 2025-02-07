'use client';
import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { useEffect, useState } from 'react';

export default function AppBodyClient({
  searchParams,
}: {
  searchParams: { filename: string; callback: string };
}): JSX.Element {
  const { filename, callback } = searchParams;
  const [content, setContent] = useState<string>('');
  const [blob, setBlob] = useState<PutBlobResult | null>(null);

  useEffect(() => {
    const doUpload = async (): Promise<void> => {
      const blobResult = await upload(filename, `Hello from ${filename}`, {
        access: 'public',
        handleUploadUrl: callback,
      });
      setBlob(blobResult);
      setContent(await fetch(blobResult.url).then((r) => r.text()));
    };
    void doUpload();
  }, [filename, callback]);
  if (!blob || !content) return <div>Loading...</div>;
  return (
    <>
      <h1>App Router direct string upload example via a Client {callback}</h1>
      <p id="blob-path">{blob.pathname}</p>
      <p id="blob-content">{content}</p>
    </>
  );
}
